"""
Hotel Agent.
Searches hotel options using web research and provider abstraction.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from pydantic import BaseModel, Field

from app.core.logging import get_logger
from app.models.events import AgentName, AgentStatus, EventType, TripEvent
from app.models.trip_state import (
    AccommodationType,
    DataSource,
    HotelOption,
    HotelOptions,
    TripState,
)
from app.providers.base import HotelProvider, LLMProvider, SearchProvider
from app.services.event_bus import publish_event
from app.services.geocoding import geocode

logger = get_logger(__name__)

HOTEL_EXTRACTION_PROMPT = """
You are a hotel research assistant. Extract hotel information from the search results.

For each hotel mentioned, extract:
- name: full hotel name
- rating: numeric rating (e.g., 4.2) or null if not mentioned
- location: area/locality
- price_per_night: numeric price per night in the requested currency (ESTIMATE a realistic price based on category if not explicitly mentioned)
- amenities: list of mentioned amenities
- category: "budget", "mid_range", or "luxury" based on price/description
- breakfast_included: true/false
- free_cancellation: true/false
- booking_url: URL if mentioned

Only include hotels with enough information. Provide a realistic estimated price if exact pricing is missing. Do NOT invent ratings not in the search results.
"""


class ExtractedHotelList(BaseModel):
    hotels: list[dict] = Field(default_factory=list)


async def run_hotel_agent(
    state: TripState,
    hotel_provider: HotelProvider,
    llm: LLMProvider,
    search: SearchProvider,
) -> TripState:
    """Find hotel options for the selected destination."""

    destination = (
        state.selected_destination.name
        if state.selected_destination
        else (state.destinations_requested[0] if state.destinations_requested else None)
    )
    if not destination:
        return state

    agent_name = AgentName.HOTEL

    await publish_event(TripEvent(
        trip_id=state.trip_id,
        run_id=state.planning_run_id,
        type=EventType.AGENT_STARTED,
        agent=agent_name,
        status=AgentStatus.RUNNING,
        message=f"Searching hotels in {destination}",
    ))

    nights = state.dates.duration_days or 3
    from datetime import date, timedelta
    check_in = state.dates.start.isoformat() if state.dates.start else (date.today() + timedelta(days=30)).isoformat()
    check_out = state.dates.end.isoformat() if state.dates.end else (date.today() + timedelta(days=30 + max(state.dates.duration_days or 3, 1))).isoformat()

    all_hotels: list[HotelOption] = []
    mock_fallback_hotels: list[HotelOption] = []

    # Try provider first
    try:
        provider_hotels = await hotel_provider.search_hotels(
            destination=destination,
            check_in=check_in,
            check_out=check_out,
            adults=state.travelers.adults,
            currency=state.budget_currency or "INR",
            preferences=state.preferences,
        )
        for h in provider_hotels:
            if type(hotel_provider).__name__ == "MockHotelProvider":
                h.source = "mock"
                mock_fallback_hotels.append(h)
            else:
                all_hotels.append(h)
                
        if all_hotels:
            await publish_event(TripEvent(
                trip_id=state.trip_id,
                run_id=state.planning_run_id,
                type=EventType.SEARCH_COMPLETED,
                agent=agent_name,
                status=AgentStatus.RUNNING,
                message=f"Found {len(all_hotels)} hotel options from provider",
            ))
    except Exception as exc:
        logger.warning("hotel_provider_failed", error=str(exc))

    # Supplement with web search if search is available
    if search.status.available:
        try:
            budget_str = f"under {state.budget_currency} {int(state.budget_amount / nights):,} per night" if state.budget_amount else ""
            accom_type = state.preferences.accommodation_type.value if state.preferences.accommodation_type else "any"
            
            # Use current year dynamically instead of hardcoded 2024
            current_year = date.today().year
            query = f"best hotels in {destination} {accom_type} {budget_str} {current_year}"

            await publish_event(TripEvent(
                trip_id=state.trip_id,
                run_id=state.planning_run_id,
                type=EventType.SEARCH_STARTED,
                agent=agent_name,
                status=AgentStatus.RUNNING,
                message=f"Searching for {accom_type} hotels in {destination}",
            ))

            search_response = await search.search(query, max_results=8, search_depth="advanced")
            search_results = search_response.get("results", [])
            search_images = search_response.get("images", [])
            context = "\n\n".join([
                f"[{r['title']}]\n{r['content']}"
                for r in search_results if r.get("content")
            ])

            # Run LLM extraction if we have search context
            if context:
                try:
                    extraction: ExtractedHotelList = await llm.complete_structured(
                        system_prompt=HOTEL_EXTRACTION_PROMPT,
                        user_message=f"DESTINATION: {destination}\nBUDGET: {budget_str}\n\nSEARCH RESULTS:\n{context}",
                        output_schema=ExtractedHotelList,
                        temperature=0.2,
                    )
                    
                    seen_names = {h.name.lower().strip() for h in all_hotels}
                    
                    for item in extraction.hotels:
                        name = item.get("name")
                        
                        price_raw = item.get("price_per_night")
                        if isinstance(price_raw, str):
                            import re
                            match = re.search(r"[\d,]+(?:\.\d+)?", price_raw)
                            if match:
                                price_raw = float(match.group(0).replace(",", ""))
                            else:
                                price_raw = 0.0
                        
                        try:
                            price = float(price_raw or 0.0)
                        except ValueError:
                            price = 0.0
                        
                        # Skip if missing name or price
                        if not name or not price:
                            continue
                            
                        normalized_name = name.lower().strip()
                        if normalized_name in seen_names:
                            continue
                            
                        seen_names.add(normalized_name)
                            
                        try:
                            cat_str = (item.get("category") or "any").lower()
                            cat = AccommodationType.ANY
                            for enum_val in AccommodationType:
                                if enum_val.value == cat_str:
                                    cat = enum_val
                                    break
                            hotel_opt = HotelOption(
                                name=name,
                                category=cat,
                                rating=float(item.get("rating") or 4.0),
                                location=item.get("location") or destination,
                                price_per_night=price,
                                total_price=price * nights,
                                currency=state.budget_currency or "INR",
                                nights=nights,
                                amenities=item.get("amenities") or [],
                                breakfast_included=bool(item.get("breakfast_included", False)),
                                free_cancellation=bool(item.get("free_cancellation", False)),
                                source="web_search",
                                is_available=True,
                                booking_url=item.get("booking_url"),
                                provenance="estimated",
                            )
                            all_hotels.append(hotel_opt)
                        except Exception as e:
                            logger.error(f"Failed to parse extracted hotel {item}: {e}")
                            continue
                except Exception as ext_exc:
                    logger.warning("hotel_extraction_failed", error=str(ext_exc))

            hotels_needing_images = [h for h in all_hotels[:4] if not h.image_url]
            if hotels_needing_images:
                image_tasks = [
                    search.search(
                        f"{hotel.name} {hotel.location} hotel exterior room photo",
                        max_results=2,
                        search_depth="basic",
                    )
                    for hotel in hotels_needing_images
                ]
                image_results = await asyncio.gather(*image_tasks, return_exceptions=True)
                used_images: set[str] = set()
                
                for hotel, result in zip(hotels_needing_images, image_results):
                    if isinstance(result, dict) and "images" in result:
                        for img in result["images"]:
                            image_url = img.get("url")
                            if image_url and image_url not in used_images:
                                hotel.image_url = image_url
                                used_images.add(image_url)
                                break
                                
                    # Fallback to generic image pool if dedicated search failed
                    if not hotel.image_url and search_images:
                        hotel_name_lower = hotel.name.lower().replace(" ", "")
                        hotel_name_raw = hotel.name.lower()
                        for img in search_images:
                            desc_lower = img.get("description", "").lower()
                            url_lower = img.get("url", "").lower()
                            if hotel_name_raw in desc_lower or hotel_name_lower in url_lower:
                                image_url = img.get("url")
                                if image_url and image_url not in used_images:
                                    hotel.image_url = image_url
                                    used_images.add(image_url)
                                    break

            # Track sources
            for r in search_results:
                if r.get("url"):
                    state.add_source(DataSource(
                        title=str(r.get("title") or r.get("url") or "Hotel Source"),
                        provider="Tavily Search",
                        url=r["url"],
                        data_category="hotels",
                        retrieved_at=datetime.now(timezone.utc),
                        is_live=True,
                    ))

        except Exception as exc:
            logger.warning("hotel_search_failed", error=str(exc))

    # If neither provider nor web search found anything, fallback to mock hotels
    if not all_hotels and mock_fallback_hotels:
        all_hotels.extend(mock_fallback_hotels)

    if state.budget_amount and nights > 0:
        ceiling_per_night = (state.budget_amount * 0.5) / nights
        affordable = []
        expensive = []
        for h in all_hotels:
            if h.price_per_night > ceiling_per_night:
                h.fit_reason = "This is above your typical budget for this trip"
                expensive.append(h)
            else:
                affordable.append(h)
        all_hotels = affordable + expensive

    # Geocode all hotels
    if all_hotels:
        geocode_tasks = [geocode(f"{hotel.name}, {hotel.location}") for hotel in all_hotels]
        coords = await asyncio.gather(*geocode_tasks, return_exceptions=True)
        for hotel, coord in zip(all_hotels, coords):
            if isinstance(coord, tuple) and len(coord) == 2:
                hotel.latitude, hotel.longitude = coord

    state.hotels = HotelOptions(
        options=all_hotels,
        provider_available=hotel_provider.status.available,
        last_searched=datetime.now(timezone.utc),
    )
    state.touch()

    await publish_event(TripEvent(
        trip_id=state.trip_id,
        run_id=state.planning_run_id,
        type=EventType.HOTELS_FOUND,
        agent=agent_name,
        status=AgentStatus.COMPLETED,
        message=f"Found {len(all_hotels)} hotels matching your preferences",
        items_found=len(all_hotels),
        data={"hotels": [h.model_dump(mode="json") for h in all_hotels]},
    ))

    return state
