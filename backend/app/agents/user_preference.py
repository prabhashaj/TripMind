"""
User Preference Agent.
Extracts structured travel preferences from natural language using Mistral small model.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.core.logging import get_logger
from app.models.events import AgentName, AgentStatus, EventType, TripEvent
from app.models.trip_state import (
    AccommodationType,
    DateRange,
    TravelPace,
    TransportMode,
    TravelerInfo,
    TripPreferences,
    TripState,
)
from app.providers.base import LLMProvider
from app.services.event_bus import publish_event

logger = get_logger(__name__)

SYSTEM_PROMPT = """
You are a travel preference extraction engine. Your job is to extract structured information
from natural language travel requests.

Extract ALL information you can infer from the user's message. Be smart about inference:
- "couple" → adults: 2
- "family" → look for children mentions
- "under ₹60,000" → budget_amount: 60000, budget_currency: "INR"
- "budget trip" → accommodation_type: "budget", pace: "moderate"
- "don't wake me before 9" → wake_time_earliest: "09:00"
- "relaxed" or "no rush" → pace: "relaxed"
- "7 days" → duration_days: 7
- "mountains, photography, local food" → interests: ["mountains", "photography", "local food"]

If information is not present, use null.
Never invent information not present in the user's message.
"""


class ExtractedPreferences(BaseModel):
    origin: str | None = None
    destinations_requested: list[str] = Field(default_factory=list)
    start_date: str | None = None  # ISO date string
    end_date: str | None = None
    duration_days: int | None = None
    dates_flexible: bool = False
    adults: int = 1
    children: int = 0
    infants: int = 0
    budget_amount: float | None = None
    budget_currency: str = "INR"
    interests: list[str] = Field(default_factory=list)
    pace: str = "moderate"
    accommodation_type: str = "any"
    preferred_transport: str = "any"
    dietary_requirements: list[str] = Field(default_factory=list)
    avoid: list[str] = Field(default_factory=list)
    wake_time_earliest: str | None = None
    sleep_time_latest: str | None = None
    requires_accessibility: bool = False
    raw_constraints: list[str] = Field(default_factory=list)


async def run_user_preference_agent(
    state: TripState,
    llm: LLMProvider,
) -> TripState:
    """
    Extract structured preferences from the user's natural language query.
    Updates TripState with all extractable information.
    """
    agent_name = AgentName.USER_PREFERENCE

    await publish_event(TripEvent(
        trip_id=state.trip_id,
        run_id=state.planning_run_id,
        type=EventType.AGENT_STARTED,
        agent=agent_name,
        status=AgentStatus.RUNNING,
        message="Understanding your travel requirements",
    ))

    try:
        # Validate query before processing
        query = state.original_query.strip()
        query_lower = query.lower()
        
        # List of common greetings and non-travel queries
        greetings = ['hi', 'hello', 'hey', 'heya', 'hii', 'greetings', 'what\'s up', 'whats up', 
                     'how are you', 'howdy', 'yo', 'hey there', 'good morning', 'good evening']
        
        # Check if it's a greeting or too short to be meaningful
        if query_lower in greetings or (len(query.split()) <= 1 and not any(char.isdigit() for char in query_lower)):
            await publish_event(TripEvent(
                trip_id=state.trip_id,
                run_id=state.planning_run_id,
                type=EventType.AGENT_FAILED,
                agent=agent_name,
                status=AgentStatus.FAILED,
                message="Please enter a valid travel request. For example: 'Plan a 7-day trip to Goa for 2 people with a budget of ₹50,000'",
                data={"error": "invalid_query_too_vague"},
            ))
            state.planning_status = PlanningStatus.FAILED
            return state
        
        extracted: ExtractedPreferences = await llm.complete_structured(
            system_prompt=SYSTEM_PROMPT,
            user_message=state.original_query,
            output_schema=ExtractedPreferences,
            temperature=0.1,
        )

        questions = _build_clarifying_questions(extracted)
        if questions:
            await publish_event(TripEvent(
                trip_id=state.trip_id,
                run_id=state.planning_run_id,
                type=EventType.PREFERENCE_QUESTIONS,
                agent=agent_name,
                status=AgentStatus.RUNNING,
                message="A few details would help tailor your trip",
                data={"questions": questions},
            ))

        # Apply extracted data to TripState
        state.origin = extracted.origin
        state.destinations_requested = extracted.destinations_requested
        state.budget_amount = extracted.budget_amount
        state.budget_currency = extracted.budget_currency

        state.dates = DateRange(
            start=_parse_date(extracted.start_date),
            end=_parse_date(extracted.end_date),
            flexible=extracted.dates_flexible,
            duration_days=extracted.duration_days,
        )

        state.travelers = TravelerInfo(
            adults=extracted.adults,
            children=extracted.children,
            infants=extracted.infants,
        )

        state.preferences = TripPreferences(
            interests=extracted.interests,
            pace=_safe_enum(TravelPace, extracted.pace, TravelPace.MODERATE),
            accommodation_type=_safe_enum(AccommodationType, extracted.accommodation_type, AccommodationType.ANY),
            preferred_transport=_safe_enum(TransportMode, extracted.preferred_transport, TransportMode.ANY),
            dietary_requirements=extracted.dietary_requirements,
            avoid=extracted.avoid,
            wake_time_earliest=extracted.wake_time_earliest,
            sleep_time_latest=extracted.sleep_time_latest,
            requires_accessibility=extracted.requires_accessibility,
            currency=extracted.budget_currency,
            raw_constraints=extracted.raw_constraints,
        )

        state.touch()

        await publish_event(TripEvent(
            trip_id=state.trip_id,
            run_id=state.planning_run_id,
            type=EventType.PREFERENCES_EXTRACTED,
            agent=agent_name,
            status=AgentStatus.COMPLETED,
            message="Travel requirements understood",
            data={
                "origin": state.origin,
                "destinations": state.destinations_requested,
                "budget": state.budget_amount,
                "currency": state.budget_currency,
                "duration_days": state.dates.duration_days,
                "travelers": state.travelers.total,
                "interests": state.preferences.interests,
                "pace": state.preferences.pace,
            },
        ))

        logger.info(
            "preferences_extracted",
            trip_id=state.trip_id,
            origin=state.origin,
            budget=state.budget_amount,
            duration=state.dates.duration_days,
        )

    except Exception as exc:
        logger.error("user_preference_agent_failed", error=str(exc), trip_id=state.trip_id)
        await publish_event(TripEvent(
            trip_id=state.trip_id,
            run_id=state.planning_run_id,
            type=EventType.AGENT_FAILED,
            agent=agent_name,
            status=AgentStatus.FAILED,
            message="Could not fully understand your requirements — using what was provided",
            data={"error": str(exc)},
        ))

    return state


def _build_clarifying_questions(extracted: ExtractedPreferences) -> list[dict[str, Any]]:
    """Create a short, data-driven set of choices from fields absent in the prompt."""
    questions: list[dict[str, Any]] = []
    if not extracted.start_date and not extracted.end_date and not extracted.dates_flexible:
        questions.append({"id": "dates", "prompt": "When would you like to travel?", "options": ["Flexible dates", "Next month", "This season"], "allow_text": True})
    if not extracted.duration_days:
        questions.append({"id": "duration", "prompt": "How many days should we plan?", "options": ["3 days", "5 days", "7 days", "10 days"], "allow_text": False})
    if not extracted.budget_amount:
        questions.append({"id": "budget", "prompt": "What is your total trip budget?", "options": ["₹25,000", "₹60,000", "₹1,00,000", "₹1,50,000+"], "allow_text": True})
    if not extracted.interests:
        questions.append({"id": "style", "prompt": "What should the trip feel like?", "options": ["Slow and scenic", "Beach and food", "Culture and history", "Adventure"], "allow_text": False})
    return questions[:3]


def _parse_date(date_str: str | None):
    if not date_str:
        return None
    try:
        from datetime import date
        return date.fromisoformat(date_str)
    except ValueError:
        return None


def _safe_enum(enum_class, value: str, default):
    try:
        return enum_class(value)
    except ValueError:
        return default
