"""
Itinerary Agent.
Creates a realistic, geographically-feasible day-by-day itinerary
using Mistral large model with full trip context.
"""
from __future__ import annotations

from datetime import date, timedelta

from pydantic import BaseModel, Field

from app.core.logging import get_logger
from app.models.events import AgentName, AgentStatus, EventType, TripEvent
from app.models.trip_state import (
    Itinerary,
    ItineraryDay,
    ItineraryItem,
    ItineraryItemType,
    TripState,
)
from app.providers.base import LLMProvider
from app.services.event_bus import publish_event

logger = get_logger(__name__)

ITINERARY_SYSTEM_PROMPT = """
You are an expert travel itinerary planner with deep knowledge of Indian destinations.

Create a realistic, day-by-day itinerary based on the provided trip details.

CRITICAL RULES:
1. All activities must be geographically feasible — do NOT place back-to-back items in locations that are far apart
2. Respect the user's wake time (don't schedule anything before their earliest wake time)
3. Respect the user's pace:
   - relaxed: max 2-3 activities per day, longer meal breaks, afternoon rest
   - moderate: 3-4 activities per day
   - packed: 4-5 activities per day
4. Include realistic travel time between locations (build in 30-60min buffer)
5. Include meal breaks at realistic times
6. Opening hours: don't schedule visits to closed attractions
7. First day: factor in travel/transit time from origin
8. Last day: factor in return journey time
9. Only include activities from the provided activity list
10. Never create an impossible schedule

Output format per day:
- day_number: int
- title: descriptive day title
- location: primary location for the day
- items: list of itinerary items with:
  - type: transport|activity|meal|check_in|check_out|rest|free_time|transfer
  - time: "HH:MM"
  - title: item name
  - description: brief description
  - location: specific location
  - duration_minutes: estimated duration
  - estimated_cost: cost in local currency
  - is_flexible: true/false
"""


class ItineraryDayPlan(BaseModel):
    day_number: int
    title: str
    location: str
    items: list[dict] = Field(default_factory=list)


class ItineraryPlan(BaseModel):
    days: list[ItineraryDayPlan] = Field(default_factory=list)


async def run_itinerary_agent(
    state: TripState,
    llm: LLMProvider,
) -> TripState:
    """Generate a day-by-day itinerary from the current TripState."""

    agent_name = AgentName.ITINERARY

    await publish_event(TripEvent(
        trip_id=state.trip_id,
        run_id=state.planning_run_id,
        type=EventType.AGENT_STARTED,
        agent=agent_name,
        status=AgentStatus.RUNNING,
        message="Building your day-by-day itinerary",
    ))

    try:
        context = _build_itinerary_context(state)

        plan: ItineraryPlan = await llm.complete_structured(
            system_prompt=ITINERARY_SYSTEM_PROMPT,
            user_message=context,
            output_schema=ItineraryPlan,
            temperature=0.4,
            model=None,  # Use large model for complex planning
        )

        days = []
        start_date = state.dates.start

        for day_plan in plan.days:
            day_date = None
            if start_date:
                day_date = start_date + timedelta(days=day_plan.day_number - 1)

            items = []
            for item_dict in day_plan.items:
                try:
                    item = ItineraryItem(
                        type=_parse_item_type(item_dict.get("type", "activity")),
                        time=item_dict.get("time", "09:00"),
                        title=item_dict.get("title", ""),
                        description=item_dict.get("description"),
                        location=item_dict.get("location"),
                        duration_minutes=item_dict.get("duration_minutes"),
                        estimated_cost=item_dict.get("estimated_cost", 0.0),
                        currency=state.budget_currency,
                        is_flexible=item_dict.get("is_flexible", True),
                    )
                    items.append(item)
                except Exception:
                    continue

            day = ItineraryDay(
                day_number=day_plan.day_number,
                date=day_date,
                title=day_plan.title,
                location=day_plan.location,
                items=items,
                total_cost=sum(i.estimated_cost for i in items),
            )
            days.append(day)

        state.itinerary = Itinerary(
            days=days,
            total_duration_days=len(days),
        )
        state.touch()

        await publish_event(TripEvent(
            trip_id=state.trip_id,
            run_id=state.planning_run_id,
            type=EventType.ITINERARY_CREATED,
            agent=agent_name,
            status=AgentStatus.COMPLETED,
            message=f"Built a {len(days)}-day itinerary",
            items_found=len(days),
            data={"itinerary": state.itinerary.model_dump(mode="json")},
        ))

    except Exception as exc:
        logger.error("itinerary_agent_failed", error=str(exc), trip_id=state.trip_id)
        await publish_event(TripEvent(
            trip_id=state.trip_id,
            run_id=state.planning_run_id,
            type=EventType.AGENT_FAILED,
            agent=agent_name,
            status=AgentStatus.FAILED,
            message="Itinerary generation encountered an issue",
            data={"error": str(exc)},
        ))

    return state


def _build_itinerary_context(state: TripState) -> str:
    lines = [f"TRIP REQUEST: {state.original_query}\n"]

    lines.append(f"Origin: {state.origin or 'Not specified'}")
    dest = state.selected_destination
    if dest:
        lines.append(f"Destination: {dest.name}, {dest.country}")
    lines.append(f"Duration: {state.dates.duration_days or 5} days")
    if state.dates.start:
        lines.append(f"Start date: {state.dates.start}")
    lines.append(f"Travelers: {state.travelers.adults} adults, {state.travelers.children} children")
    lines.append(f"Pace: {state.preferences.pace}")
    if state.preferences.wake_time_earliest:
        lines.append(f"No activities before: {state.preferences.wake_time_earliest}")
    if state.preferences.interests:
        lines.append(f"Interests: {', '.join(state.preferences.interests)}")

    # Selected transport
    selected_transport = None
    for leg in state.transport.intercity:
        if leg.id == state.transport.selected_intercity_id:
            selected_transport = leg
            break
    if state.transport.intercity:
        t = selected_transport or state.transport.intercity[0]
        lines.append(f"\nSELECTED TRANSPORT: {t.carrier or t.mode} departing {t.departure_time}, arriving {t.arrival_time}")

    # Selected hotel
    selected_hotel = None
    for h in state.hotels.options:
        if h.id == state.hotels.selected_id:
            selected_hotel = h
            break
    if state.hotels.options:
        h = selected_hotel or state.hotels.options[0]
        lines.append(f"\nHOTEL: {h.name}, {h.location}")

    # Available activities
    if state.activities:
        lines.append(f"\nAVAILABLE ACTIVITIES ({len(state.activities)}):")
        for a in state.activities[:20]:
            cost_str = f"₹{a.price_per_person:.0f}/person" if a.price_per_person else "Free"
            hours_str = f"{a.duration_hours}h" if a.duration_hours else "?"
            lines.append(
                f"  - {a.name} | {a.type} | {hours_str} | {cost_str} | "
                f"Opens: {a.opening_hours or 'unknown'} | {a.location}"
            )

    return "\n".join(lines)


def _parse_item_type(type_str: str) -> ItineraryItemType:
    mapping = {
        "transport": ItineraryItemType.TRANSPORT,
        "check_in": ItineraryItemType.CHECK_IN,
        "check_out": ItineraryItemType.CHECK_OUT,
        "activity": ItineraryItemType.ACTIVITY,
        "meal": ItineraryItemType.MEAL,
        "rest": ItineraryItemType.REST,
        "free_time": ItineraryItemType.FREE_TIME,
        "transfer": ItineraryItemType.TRANSFER,
    }
    return mapping.get(type_str.lower(), ItineraryItemType.ACTIVITY)
