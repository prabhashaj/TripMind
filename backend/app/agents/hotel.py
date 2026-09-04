"""
Hotel Agent.
Searches hotel options using web research and provider abstraction.
"""
from __future__ import annotations

import asyncio
from datetime import datetime

from pydantic import BaseModel, Field

from app.core.logging import get_logger
from app.models.events import AgentName, AgentStatus, EventType, TripEvent
from app.models.trip_state import (
    DataSource,
    HotelOption,
    HotelOptions,
    TripState,
)
from app.providers.base import HotelProvider, LLMProvider, SearchProvider
from app.services.event_bus import publish_event

logger = get_logger(__name__)

HOTEL_EXTRACTION_PROMPT = """
You are a hotel research assistant. Extract hotel information from the search results.

For each hotel mentioned, extract:
- name: full hotel name
- rating: numeric rating (e.g., 4.2) or null if not mentioned
- location: area/locality
- price_per_night: numeric price per night in the requested currency (null if not mentioned)
- amenities: list of mentioned amenities
- category: "budget", "mid_range", or "luxury" based on price/description
- breakfast_included: true/false
- free_cancellation: true/false
- booking_url: URL if mentioned

Only include hotels with enough information. Do NOT invent prices or ratings not in the search results.
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
    check_in = state.dates.start.isoformat() if state.dates.start else "2024-12-15"
    check_out = state.dates.end.isoformat() if state.dates.end else "2024-12-18"

    all_hotels: list[HotelOption] = []

    # Try provider first
    try:
        provider_hotels = await hotel_provider.search_hotels(
            destination=destination,
            check_in=check_in,
            check_out=check_out,
            adults=state.travelers.adults,
            currency=state.budget_currency,
            preferences=state.preferences,
        )
        all_hotels.extend(provider_hotels)
        await publish_event(TripEvent(
            trip_id=state.trip_id,
            run_id=state.planning_run_id,
            type=EventType.SEARCH_COMPLETED,
            agent=agent_name,
            status=AgentStatus.RUNNING,
            message=f"Found {len(provider_hotels)} hotel options",
        ))
    except Exception as exc:
        logger.warning("hotel_provider_failed", error=str(exc))

    # Supplement with web search if search is available
    if search.status.available:
        try:
            budget_str = f"under ₹{int(state.budget_amount / nights):,} per night" if state.budget_amount else ""
            accom_type = state.preferences.accommodation_type.value if state.preferences.accommodation_type else "any"
            query = f"best hotels in {destination} {accom_type} {budget_str} 2024"

            await publish_event(TripEvent(
                trip_id=state.trip_id,
                run_id=state.planning_run_id,
                type=EventType.SEARCH_STARTED,
                agent=agent_name,
                status=AgentStatus.RUNNING,
                message=f"Searching for {accom_type} hotels in {destination}",
            ))

            search_results = await search.search(query, max_results=8, search_depth="advanced")
            image_tasks = [
                search.search(
                    f"{hotel.name} {hotel.location} hotel exterior room photo",
                    max_results=2,
                    search_depth="basic",
                )
                for hotel in all_hotels[:4] if not hotel.image_url
            ]
            image_results = await asyncio.gather(*image_tasks, return_exceptions=True)
            used_images: set[str] = set()
            image_index = 0
            for hotel in all_hotels:
                if hotel.image_url or image_index >= len(image_results):
                    continue
                result = image_results[image_index]
                image_index += 1
                if isinstance(result, Exception):
                    continue
                for item in result:
                    image_url = item.get("image_url")
                    if image_url and image_url not in used_images:
                        hotel.image_url = image_url
                        used_images.add(image_url)
                        break
            context = "\n\n".join([
                f"[{r['title']}]\n{r['content']}"
                for r in search_results if r.get("content")
            ])

            # Track sources
            for r in search_results:
                if r.get("url"):
                    state.add_source(DataSource(
                        title=r.get("title", r["url"]),
                        provider="Tavily Search",
                        url=r["url"],
                        data_category="hotels",
                        retrieved_at=datetime.utcnow(),
                        is_live=True,
                    ))

        except Exception as exc:
            logger.warning("hotel_search_failed", error=str(exc))

    state.hotels = HotelOptions(
        options=all_hotels,
        provider_available=hotel_provider.status.available,
        last_searched=datetime.utcnow(),
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
