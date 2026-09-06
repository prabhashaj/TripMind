"""
Activity Agent.
Uses Tavily search + Mistral to find attractions, experiences, and restaurants.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from pydantic import BaseModel, Field

from app.core.logging import get_logger
from app.models.events import AgentName, AgentStatus, EventType, TripEvent
from app.models.trip_state import ActivityItem, DataSource, TripState
from app.providers.base import LLMProvider, SearchProvider
from app.services.event_bus import publish_event

logger = get_logger(__name__)

ACTIVITY_EXTRACTION_PROMPT = """
You are a travel activity researcher. Extract structured activity information from search results.

For each attraction or experience found, provide:
- name: full name
- type: one of "attraction", "experience", "tour", "museum", "adventure", "food", "event", "nature"
- description: 1-2 sentence vivid description
- location: specific area/address
- rating: numeric (e.g., 4.5) or null
- duration_hours: approximate visit duration (e.g., 2.0)
- price_per_person: admission/activity cost in INR (0 if free, null if unknown)
- opening_hours: hours string or null (e.g., "09:00-17:00")
- tags: relevant tags matching user interests

RULES:
- Only include activities from search result content
- Never invent prices, ratings, or hours
- Prioritize activities matching the user's interests
- Include a mix of free and paid activities
- Include at least one food experience if available
"""


class ActivityExtractionResult(BaseModel):
    activities: list[dict] = Field(default_factory=list)


async def run_activity_agent(
    state: TripState,
    llm: LLMProvider,
    search: SearchProvider,
) -> TripState:
    """Find activities and attractions for the selected destination."""

    destination = (
        state.selected_destination.name
        if state.selected_destination
        else (state.destinations_requested[0] if state.destinations_requested else None)
    )
    if not destination:
        return state

    agent_name = AgentName.ACTIVITY

    await publish_event(TripEvent(
        trip_id=state.trip_id,
        run_id=state.planning_run_id,
        type=EventType.AGENT_STARTED,
        agent=agent_name,
        status=AgentStatus.RUNNING,
        message=f"Discovering experiences and attractions in {destination}",
    ))

    interests = state.preferences.interests
    duration = state.dates.duration_days or 5

    # Build parallel search queries
    queries = _build_activity_queries(destination, interests, duration, state.budget_currency)

    await publish_event(TripEvent(
        trip_id=state.trip_id,
        run_id=state.planning_run_id,
        type=EventType.SEARCH_STARTED,
        agent=agent_name,
        status=AgentStatus.RUNNING,
        message=f"Searching activities and local experiences in {destination}",
    ))

    search_tasks = [
        search.search(q, max_results=6, search_depth="advanced")
        for q in queries
    ]
    results_list = await asyncio.gather(*search_tasks, return_exceptions=True)

    all_results: list[dict] = []
    for r in results_list:
        if isinstance(r, list):
            all_results.extend(r)
            for item in r:
                if isinstance(item, dict) and item.get("url"):
                    state.add_source(DataSource(
                        title=str(item.get("title") or item.get("url") or "Activity Source"),
                        provider="Tavily Search",
                        url=item["url"],
                        data_category="activities",
                        retrieved_at=datetime.now(timezone.utc),
                        is_live=True,
                    ))

    await publish_event(TripEvent(
        trip_id=state.trip_id,
        run_id=state.planning_run_id,
        type=EventType.SEARCH_COMPLETED,
        agent=agent_name,
        status=AgentStatus.RUNNING,
        message=f"Analysing {len(all_results)} results for experiences",
    ))

    context = "\n\n---\n\n".join([
        f"[{r.get('title', '')}]\nURL: {r.get('url', '')}\n{r.get('content', '')}"
        for r in all_results[:20]
    ])

    user_brief = (
        f"Destination: {destination}\n"
        f"Interests: {', '.join(interests) if interests else 'general sightseeing'}\n"
        f"Trip duration: {duration} days\n"
        f"Pace: {state.preferences.pace}\n"
        f"Budget currency: {state.budget_currency}"
    )

    try:
        extraction: ActivityExtractionResult = await llm.complete_structured(
            system_prompt=ACTIVITY_EXTRACTION_PROMPT,
            user_message=f"USER TRIP:\n{user_brief}\n\nSEARCH RESULTS:\n{context}",
            output_schema=ActivityExtractionResult,
            temperature=0.2,
        )

        activities = []
        for item in extraction.activities:
            try:
                activity = ActivityItem(
                    name=item.get("name", ""),
                    type=item.get("type", "attraction"),
                    description=item.get("description", ""),
                    location=item.get("location", destination),
                    rating=item.get("rating"),
                    duration_hours=item.get("duration_hours"),
                    price_per_person=item.get("price_per_person") or 0.0,
                    currency=state.budget_currency,
                    opening_hours=item.get("opening_hours"),
                    source="Tavily Search",
                    retrieved_at=datetime.now(timezone.utc),
                    tags=item.get("tags", []),
                )
                activities.append(activity)
            except Exception:
                continue

        image_tasks = [
            search.search(
                f"{activity.name} {activity.location} {destination} travel attraction photo",
                max_results=2,
                search_depth="basic",
            )
            for activity in activities[:8]
        ]
        image_results = await asyncio.gather(*image_tasks, return_exceptions=True)
        used_images: set[str] = set()
        for activity, result in zip(activities, image_results):
            if not isinstance(result, list):
                continue
            for item in result:
                image_url = item.get("image_url")
                if image_url and image_url not in used_images:
                    activity.image_url = image_url
                    used_images.add(image_url)
                    break

        state.activities = activities
        state.touch()

        await publish_event(TripEvent(
            trip_id=state.trip_id,
            run_id=state.planning_run_id,
            type=EventType.ACTIVITIES_FOUND,
            agent=agent_name,
            status=AgentStatus.COMPLETED,
            message=f"Found {len(activities)} experiences and attractions",
            items_found=len(activities),
            data={"activities": [a.model_dump(mode="json") for a in activities]},
        ))

    except Exception as exc:
        logger.error("activity_extraction_failed", error=str(exc))
        await publish_event(TripEvent(
            trip_id=state.trip_id,
            run_id=state.planning_run_id,
            type=EventType.AGENT_FAILED,
            agent=agent_name,
            status=AgentStatus.FAILED,
            message="Activity research encountered an issue",
            data={"error": str(exc)},
        ))

    return state


def _build_activity_queries(
    destination: str,
    interests: list[str],
    duration: int,
    currency: str,
) -> list[str]:
    queries = [
        f"top things to do in {destination} attractions",
        f"best local food experiences restaurants {destination}",
    ]
    if interests:
        interest_str = " ".join(interests[:3])
        queries.append(f"{destination} {interest_str} activities experiences")
    queries.append(f"hidden gems off beaten path {destination} travel")
    return queries
