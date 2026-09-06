"""
Destination Research Agent.
Uses Tavily web search + Mistral to find and rank destination candidates.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from pydantic import BaseModel, Field

from app.core.logging import get_logger
from app.models.events import AgentName, AgentStatus, EventType, TripEvent
from app.models.trip_state import DataSource, DestinationCandidate, TripState
from app.providers.base import LLMProvider, SearchProvider
from app.services.event_bus import publish_event

logger = get_logger(__name__)

RESEARCH_SYSTEM_PROMPT = """
You are an expert travel researcher and destination analyst.

Based on the user's travel request and search results, recommend 3-5 travel destinations.

For each destination provide:
- name: city/region name
- country: country name
- state: state/province if applicable
- description: 2-3 sentence vivid description
- estimated_cost_min: minimum estimated total trip cost in the requested currency (be realistic)
- estimated_cost_max: maximum estimated total trip cost in the requested currency
- recommended_duration_days: ideal days to spend
- highlights: list of 4-6 key highlights
- best_for: list of traveler types this suits
- travel_time_hours: approximate travel time from origin
- why_it_matches: 1-2 sentence explanation of why this fits the user's requirements
- match_score: 0.0-1.0 relevance score

CRITICAL RULES:
- Base ALL information on the search results provided
- Never invent prices, ratings, or availability
- Prioritize destinations matching budget, duration, and interests
- If a destination appears in the user's query, include it
"""


class DestinationList(BaseModel):
    destinations: list[DestinationCandidate] = Field(default_factory=list)


async def run_destination_agent(
    state: TripState,
    llm: LLMProvider,
    search: SearchProvider,
) -> TripState:
    """Research and rank destination candidates."""
    agent_name = AgentName.DESTINATION

    await publish_event(TripEvent(
        trip_id=state.trip_id,
        run_id=state.planning_run_id,
        type=EventType.AGENT_STARTED,
        agent=agent_name,
        status=AgentStatus.RUNNING,
        message="Researching destinations that match your requirements",
    ))

    try:
        # Build search queries in parallel
        queries = _build_search_queries(state)

        await publish_event(TripEvent(
            trip_id=state.trip_id,
            run_id=state.planning_run_id,
            type=EventType.SEARCH_STARTED,
            agent=agent_name,
            status=AgentStatus.RUNNING,
            message=f"Searching {len(queries)} destination queries",
        ))

        search_tasks = [
            search.search(q, max_results=6, search_depth="advanced")
            for q in queries
        ]
        results_list = await asyncio.gather(*search_tasks, return_exceptions=True)

        # Aggregate results, skip failed searches
        all_results: list[dict] = []
        for i, result in enumerate(results_list):
            if isinstance(result, list):
                all_results.extend(result)
            else:
                logger.warning("search_failed", query=queries[i], error=str(result))

        await publish_event(TripEvent(
            trip_id=state.trip_id,
            run_id=state.planning_run_id,
            type=EventType.SEARCH_COMPLETED,
            agent=agent_name,
            status=AgentStatus.RUNNING,
            message=f"Analysing {len(all_results)} search results",
        ))

        # Build LLM context from search results
        context = _build_context(all_results)

        user_brief = _build_user_brief(state)

        destination_list: DestinationList = await llm.complete_structured(
            system_prompt=RESEARCH_SYSTEM_PROMPT,
            user_message=f"USER TRAVEL REQUEST:\n{user_brief}\n\nSEARCH RESULTS:\n{context}",
            output_schema=DestinationList,
            temperature=0.3,
        )

        # Sort by match score
        destinations = sorted(
            destination_list.destinations,
            key=lambda d: d.match_score,
            reverse=True,
        )

        # First, try to extract images from the main search results
        used_images: set[str] = set()
        for destination in destinations[:5]:
            # Look for images in search results that mention this destination
            dest_name_lower = destination.name.lower()
            for r in all_results:
                if dest_name_lower in r.get("title", "").lower() or dest_name_lower in r.get("content", "").lower():
                    image_url = r.get("image_url")
                    if image_url and image_url not in used_images:
                        destination.image_url = image_url
                        used_images.add(image_url)
                        break

        # If we didn't get enough images, do dedicated image searches
        destinations_needing_images = [d for d in destinations[:5] if not d.image_url]
        if destinations_needing_images:
            image_tasks = [
                search.search(
                    f"{destination.name} {destination.state or ''} {destination.country} travel landscape photo high quality",
                    max_results=5,
                    search_depth="advanced",
                )
                for destination in destinations_needing_images
            ]
            image_results = await asyncio.gather(*image_tasks, return_exceptions=True)
            for destination, result in zip(destinations_needing_images, image_results):
                if not isinstance(result, list):
                    continue
                for item in result:
                    image_url = item.get("image_url")
                    if image_url and image_url not in used_images:
                        destination.image_url = image_url
                        used_images.add(image_url)
                        break

        state.candidate_destinations = destinations

        # Extract sources
        for r in all_results:
            if r.get("url"):
                state.add_source(DataSource(
                    title=str(r.get("title") or r.get("url") or "Destination Source"),
                    provider="Tavily Search",
                    url=r["url"],
                    data_category="destinations",
                    retrieved_at=datetime.now(timezone.utc),
                    is_live=True,
                ))

        state.touch()

        await publish_event(TripEvent(
            trip_id=state.trip_id,
            run_id=state.planning_run_id,
            type=EventType.DESTINATIONS_FOUND,
            agent=agent_name,
            status=AgentStatus.COMPLETED,
            message=f"Found {len(destinations)} destinations matching your requirements",
            items_found=len(destinations),
            data={"destinations": [d.model_dump() for d in destinations]},
        ))

        logger.info("destinations_found", count=len(destinations), trip_id=state.trip_id)

    except Exception as exc:
        logger.error("destination_agent_failed", error=str(exc), trip_id=state.trip_id)
        await publish_event(TripEvent(
            trip_id=state.trip_id,
            run_id=state.planning_run_id,
            type=EventType.AGENT_FAILED,
            agent=agent_name,
            status=AgentStatus.FAILED,
            message="Destination research encountered an issue",
            data={"error": str(exc)},
        ))

    return state


def _build_search_queries(state: TripState) -> list[str]:
    origin = state.origin or "India"
    budget = f"under {state.budget_currency} {int(state.budget_amount):,}" if state.budget_amount else "budget"
    duration = f"{state.dates.duration_days} day" if state.dates.duration_days else "week"
    interests = ", ".join(state.preferences.interests[:3]) if state.preferences.interests else "sightseeing"

    queries = [
        f"best {duration} trip destinations from {origin} {budget} {interests}",
    ]

    # If user named specific destinations, research them directly
    for dest in state.destinations_requested[:2]:
        queries.append(f"{dest} travel guide {duration} trip from {origin} budget cost {budget}")

    if not state.destinations_requested:
        queries.append(f"top travel destinations India {duration} trip {interests} {budget}")

    return queries


def _build_context(results: list[dict]) -> str:
    if not results:
        return "No search results available."
    parts = []
    for i, r in enumerate(results[:15], 1):
        parts.append(f"[{i}] {r.get('title', '')}\nURL: {r.get('url', 'N/A')}\n{r.get('content', '')}")
    return "\n\n---\n\n".join(parts)


def _build_user_brief(state: TripState) -> str:
    lines = [f"Original request: {state.original_query}"]
    if state.origin:
        lines.append(f"Origin: {state.origin}")
    if state.destinations_requested:
        lines.append(f"Destinations requested: {', '.join(state.destinations_requested)}")
    if state.budget_amount:
        lines.append(f"Budget: {state.budget_currency} {state.budget_amount:,.0f}")
    if state.dates.duration_days:
        lines.append(f"Duration: {state.dates.duration_days} days")
    if state.travelers.total > 1:
        lines.append(f"Travelers: {state.travelers.adults} adults, {state.travelers.children} children")
    if state.preferences.interests:
        lines.append(f"Interests: {', '.join(state.preferences.interests)}")
    if state.preferences.pace:
        lines.append(f"Pace: {state.preferences.pace}")
    return "\n".join(lines)
