"""
Replanning Agent / Engine.
Intelligently re-runs only the affected agents when the user modifies the trip.
"""
from __future__ import annotations

from pydantic import BaseModel, Field

from app.core.logging import get_logger
from app.models.events import AgentName, AgentStatus, EventType, TripEvent
from app.models.trip_state import TripState, TripPreferences, DateRange
from app.providers.base import FlightProvider, HotelProvider, LLMProvider, SearchProvider, TrainProvider
from app.services.event_bus import publish_event

logger = get_logger(__name__)

REPLAN_INTENT_PROMPT = """
You are a travel trip modification classifier.

Given a user's modification request to an existing trip, identify which agents need to re-run.

Agents available:
- "user_preference": only if the user's core preferences change (dates, travelers, etc.)
- "destination": only if the user wants a completely different destination
- "transport": if the user changes transport mode, wants cheaper/faster transport, or changes dates
- "hotel": if the user wants a different hotel (cheaper, better rating, different area)
- "activity": if the user wants to add/remove activities or interests change
- "itinerary": if the daily schedule needs to change (pace, wake time, adding/removing days)
- "budget": always re-run when any cost component changes
- "verification": always re-run

Output a JSON object with agents_to_rerun: list of agent names, and explanation: string.
"""


class ReplanDecision(BaseModel):
    agents_to_rerun: list[str] = Field(default_factory=list)
    explanation: str = ""
    state_changes: dict = Field(default_factory=dict)


async def determine_replan_scope(
    modification_request: str,
    state: TripState,
    llm: LLMProvider,
) -> ReplanDecision:
    """
    Determine which agents need to re-run for a given modification request.
    This is the core of the targeted replanning system.
    """
    duration = getattr(state.dates, "duration_days", None) if state.dates else None
    if duration is None and isinstance(state.dates, dict):
        duration = state.dates.get("duration_days", 7)

    context = (
        f"Current trip: {state.original_query}\n"
        f"Destination: {state.selected_destination.name if state.selected_destination else 'not selected'}\n"
        f"Duration: {duration or 7} days\n"
        f"Budget: {state.budget_currency} {state.budget_amount}\n"
        f"Hotel: {state.hotels.options[0].name if state.hotels.options else 'none'}\n"
        f"\nUSER MODIFICATION REQUEST: {modification_request}"
    )

    decision: ReplanDecision = await llm.complete_structured(
        system_prompt=REPLAN_INTENT_PROMPT,
        user_message=context,
        output_schema=ReplanDecision,
        temperature=0.1,
    )

    # Always include budget and verification
    always_run = {"budget", "verification"}
    decision.agents_to_rerun = list(set(decision.agents_to_rerun) | always_run)

    return decision


async def apply_modification_to_state(
    modification_request: str,
    decision: ReplanDecision,
    state: TripState,
    llm: LLMProvider,
) -> TripState:
    """
    Apply state changes based on the modification request before re-running agents.
    For example: "Make it cheaper" might lower budget preference.
    """
    # Ensure state.preferences and state.dates are proper models if they were stored as dicts
    if isinstance(state.preferences, dict):
        try:
            state.preferences = TripPreferences(**state.preferences)
        except Exception:
            pass
    if isinstance(state.dates, dict):
        try:
            state.dates = DateRange(**state.dates)
        except Exception:
            pass

    MODIFICATION_PROMPT = """
    Given the user's trip modification and current trip state, output the exact changes to make
    to the trip state as JSON. Only output fields that change.

    Available fields to modify:
    - budget_amount: new budget number
    - preferences.pace: "relaxed"|"moderate"|"packed"
    - preferences.accommodation_type: "budget"|"mid_range"|"luxury"|"any"
    - preferences.preferred_transport: "flight"|"train"|"bus"|"any"
    - preferences.wake_time_earliest: "HH:MM" or null
    - dates.duration_days: new duration
    - preferences.interests: list of interests

    Output format: {"changes": {"field": value, ...}}
    """

    class StateChanges(BaseModel):
        changes: dict = Field(default_factory=dict)

    duration_val = getattr(state.dates, "duration_days", 7) if state.dates else 7
    if isinstance(state.dates, dict):
        duration_val = state.dates.get("duration_days", 7)

    pace_val = getattr(state.preferences, "pace", "moderate") if state.preferences else "moderate"
    if isinstance(state.preferences, dict):
        pace_val = state.preferences.get("pace", "moderate")

    transport_val = getattr(state.preferences, "preferred_transport", "any") if state.preferences else "any"
    if isinstance(state.preferences, dict):
        transport_val = state.preferences.get("preferred_transport", "any")

    changes: StateChanges = await llm.complete_structured(
        system_prompt=MODIFICATION_PROMPT,
        user_message=(
            f"Current state summary: duration={duration_val}d, "
            f"budget={state.budget_amount} {state.budget_currency}, "
            f"pace={pace_val}, "
            f"transport={transport_val}\n"
            f"\nModification request: {modification_request}"
        ),
        output_schema=StateChanges,
        temperature=0.1,
    )

    # Apply changes to state
    for field, value in changes.changes.items():
        try:
            if "." in field:
                parent, child = field.split(".", 1)
                parent_obj = getattr(state, parent, None)
                if isinstance(parent_obj, dict):
                    parent_obj[child] = value
                elif parent_obj is not None:
                    setattr(parent_obj, child, value)
            elif field == "preferences" and isinstance(value, dict):
                if not isinstance(state.preferences, TripPreferences):
                    state.preferences = TripPreferences(**(state.preferences if isinstance(state.preferences, dict) else {}))
                for k, v in value.items():
                    setattr(state.preferences, k, v)
            elif field == "dates" and isinstance(value, dict):
                if not isinstance(state.dates, DateRange):
                    state.dates = DateRange(**(state.dates if isinstance(state.dates, dict) else {}))
                for k, v in value.items():
                    setattr(state.dates, k, v)
            else:
                setattr(state, field, value)
        except Exception as exc:
            logger.warning("state_change_failed", field=field, error=str(exc))

    # Add modification to conversation history
    state.conversation_history.append({
        "role": "user",
        "content": modification_request,
    })

    # Generate new run ID for this replan
    import uuid
    state.planning_run_id = str(uuid.uuid4())
    state.touch()

    return state
