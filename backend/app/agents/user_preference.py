"""
User Preference Agent.
Extracts structured travel preferences from natural language using Mistral small model.
"""
from __future__ import annotations

import re
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
    PlanningStatus,
)
from app.providers.base import LLMProvider
from app.services.event_bus import publish_event
from app.services.memory import memory_store

logger = get_logger(__name__)

SYSTEM_PROMPT = """
You are a travel preference extraction engine. Your job is to extract structured information
from natural language travel requests.

Extract ALL information you can infer from the user's message. Be smart about inference:
- "couple" → adults: 2
- "family" → look for children mentions
- "under ₹60,000" → budget_amount: 60000, budget_currency: "INR"
- "budget trip" or "budget-friendly" → accommodation_type: "budget", pace: "moderate", budget_amount: 1000, budget_currency: "USD" (use sensible low-end default)
- "mid-range budget" or "comfortable" → accommodation_type: "moderate", budget_amount: 2000, budget_currency: "USD" (sensible mid-range default)
- "luxury" or "high-end" or "cost is not a concern" → accommodation_type: "luxury", budget_amount: 5000, budget_currency: "USD" (sensible luxury default)
- "relaxed" or "no rush" → pace: "relaxed"
- "7 days" → duration_days: 7
- "mountains, photography, local food" → interests: ["mountains", "photography", "local food"]

IMPORTANT: When a qualitative budget style is given (budget/mid-range/luxury) but no
currency is specified, use USD as the default currency and pick a sensible numeric
default for budget_amount as shown above. Never leave budget_amount null when a budget
style was clearly provided.

If information is not present at all, use null.
Never invent destination, origin, or travel dates not present in the user's message.
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
    budget_currency: str | None = None
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

        # Memory integration for currency & origin
        memory = memory_store.get_long_term(state.user_id) if state.user_id else None
        
        # Determine budget currency
        if not extracted.budget_currency and not state.budget_currency:
            if memory and "home_currency" in memory.preferences:
                extracted.budget_currency = memory.preferences["home_currency"]
            else:
                # Check for explicit Indian signals to default to INR
                origin_lower = (extracted.origin or "").lower()
                if "india" in origin_lower or "₹" in query or "inr" in query_lower or "rs" in query_lower:
                    extracted.budget_currency = "INR"

        if extracted.budget_currency and not state.budget_currency:
            state.budget_currency = extracted.budget_currency
            
        # Determine origin
        if not extracted.origin and not state.origin:
            if memory and "home_country" in memory.preferences:
                extracted.origin = memory.preferences["home_country"]
                
        if extracted.origin and not state.origin:
            state.origin = extracted.origin

        # Save to memory immediately if we have the info
        if memory:
            if state.budget_currency:
                memory.preferences["home_currency"] = state.budget_currency
            if state.origin:
                memory.preferences["home_country"] = state.origin
            memory_store.save_long_term(memory)

        # Apply extracted data to TripState, preserving any pre-populated fields
        if extracted.destinations_requested:
            state.destinations_requested = extracted.destinations_requested
        if extracted.origin:
            state.origin = extracted.origin
        if extracted.budget_amount:
            state.budget_amount = extracted.budget_amount

        start_d = _parse_date(extracted.start_date) or state.dates.start
        end_d = _parse_date(extracted.end_date) or state.dates.end
        dur_d = extracted.duration_days or state.dates.duration_days

        state.dates = DateRange(
            start=start_d,
            end=end_d,
            flexible=extracted.dates_flexible or state.dates.flexible,
            duration_days=dur_d,
        )

        state.travelers = TravelerInfo(
            adults=extracted.adults if extracted.adults > 1 else (state.travelers.adults or 1),
            children=extracted.children or state.travelers.children,
            infants=extracted.infants or state.travelers.infants,
        )

        extracted_accom = _safe_enum(AccommodationType, extracted.accommodation_type, None)
        final_accom = extracted_accom if (extracted_accom and extracted_accom != AccommodationType.ANY) else state.preferences.accommodation_type

        state.preferences = TripPreferences(
            interests=extracted.interests or state.preferences.interests,
            pace=_safe_enum(TravelPace, extracted.pace, state.preferences.pace or TravelPace.MODERATE),
            accommodation_type=final_accom or AccommodationType.ANY,
            preferred_transport=_safe_enum(TransportMode, extracted.preferred_transport, state.preferences.preferred_transport or TransportMode.ANY),
            dietary_requirements=extracted.dietary_requirements or state.preferences.dietary_requirements,
            avoid=extracted.avoid or state.preferences.avoid,
            wake_time_earliest=extracted.wake_time_earliest or state.preferences.wake_time_earliest,
            sleep_time_latest=extracted.sleep_time_latest or state.preferences.sleep_time_latest,
            requires_accessibility=extracted.requires_accessibility or state.preferences.requires_accessibility,
            currency=state.budget_currency,
            raw_constraints=list(set(state.preferences.raw_constraints + extracted.raw_constraints)),
        )

        # If qualitative budget was provided but no numeric budget_amount was set,
        # compute a realistic baseline budget amount so all downstream agents have a target.
        if not state.budget_amount:
            curr = state.budget_currency or "USD"
            dur = state.dates.duration_days or 5
            pax = state.travelers.adults or 1
            accom_val = state.preferences.accommodation_type.value.lower() if state.preferences.accommodation_type else "any"
            
            is_luxury = accom_val == "luxury" or "luxury" in query.lower()
            is_budget = accom_val == "budget" or any(w in query.lower() for w in ["budget", "cheap", "economical", "hostel"])
            is_moderate = accom_val in ("moderate", "medium") or any(w in query.lower() for w in ["mid-range", "medium", "comfortable"])
            
            if is_luxury:
                rate_per_day = 25000 if curr == "INR" else 500
                state.budget_amount = float(rate_per_day * dur * pax)
            elif is_budget:
                rate_per_day = 5000 if curr == "INR" else 100
                state.budget_amount = float(rate_per_day * dur * pax)
            elif is_moderate:
                rate_per_day = 12000 if curr == "INR" else 250
                state.budget_amount = float(rate_per_day * dur * pax)

        state.touch()

        questions = _build_clarifying_questions(extracted, state, query)
        state.pending_preference_questions = questions
        if questions:
            # Critical info is still missing — ask the user before continuing.
            state.planning_status = PlanningStatus.AWAITING_PREFERENCE_ANSWERS
            await publish_event(TripEvent(
                trip_id=state.trip_id,
                run_id=state.planning_run_id,
                type=EventType.PREFERENCE_QUESTIONS,
                agent=agent_name,
                status=AgentStatus.RUNNING,
                message="A few details would help tailor your trip",
                data={"questions": questions},
            ))
            return state

        # All required info is present — signal completion so the next agent can start.
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
                "pending_questions": state.pending_preference_questions,
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
        state.pending_preference_questions = _build_clarifying_questions(ExtractedPreferences(), state, query)
        state.planning_status = PlanningStatus.AWAITING_PREFERENCE_ANSWERS
        await publish_event(TripEvent(
            trip_id=state.trip_id,
            run_id=state.planning_run_id,
            type=EventType.AGENT_FAILED,
            agent=agent_name,
            status=AgentStatus.FAILED,
            message="Could not fully understand your requirements — using what was provided",
            data={"error": str(exc)},
        ))
        await publish_event(TripEvent(
            trip_id=state.trip_id,
            run_id=state.planning_run_id,
            type=EventType.PREFERENCE_QUESTIONS,
            agent=agent_name,
            status=AgentStatus.RUNNING,
            message="Please answer a few essentials before I start planning",
            data={"questions": state.pending_preference_questions},
        ))

    return state


def _build_clarifying_questions(extracted: ExtractedPreferences, state: TripState, query: str) -> list[dict[str, Any]]:
    """Create a short, data-driven set of choices from fields absent in the prompt.
    
    Only ask about fields that are genuinely unknown. Qualitative signals (accommodation
    type, pace keywords) count as knowing the budget intent — don't interrogate the user
    about a specific number if they already communicated their budget preference.
    """
    questions = []

    # Determine if the user gave any budget signal at all (numeric or qualitative).
    # A non-default accommodation_type means a budget style was already communicated.
    state_accom = state.preferences.accommodation_type.value if state.preferences and state.preferences.accommodation_type else "any"
    has_budget_signal = (
        bool(extracted.budget_amount)
        or bool(state.budget_amount)
        or extracted.accommodation_type not in ("any", None, "")
        or state_accom not in ("any", None, "")
        or bool(re.search(
            r"\b(budget|cheap|economical|affordable|mid.?range|moderate|comfortable|"
            r"luxury|high.?end|premium|splurge|backpacker|hostel|five.?star|5.?star)\b",
            query, re.IGNORECASE
        ))
    )

    if not extracted.origin and not state.origin:
        questions.append({
            "id": "origin",
            "prompt": "Which city are you starting your trip from?",
            "question": "Which city are you starting your trip from?",
            "options": ["New York", "London", "New Delhi", "Sydney"],
        })

    if not extracted.destinations_requested and not state.destinations_requested:
        questions.append({
            "id": "destination",
            "prompt": "Where would you like to go?",
            "question": "Where would you like to go?",
            "options": ["Surprise me!", "Beach destination", "Mountains", "Cultural city"],
        })

    # Only ask for currency if we also need a budget number AND have no currency signal.
    # Avoid bothering the user about currency when budget style was already given.
    if not has_budget_signal and not extracted.budget_currency and not state.budget_currency:
        questions.append({
            "id": "currency",
            "prompt": "Which currency should we plan your budget in?",
            "question": "Which currency should we plan your budget in?",
            "options": ["USD", "EUR", "INR", "GBP"],
        })

    if not has_budget_signal:
        # Generate budget range dynamically based on known currency
        curr = state.budget_currency or extracted.budget_currency or "USD"
        symbols = {"USD": "$", "EUR": "€", "INR": "₹", "GBP": "£"}
        sym = symbols.get(curr, curr)

        if curr == "INR":
            options = ["Under ₹50k", "₹50k - ₹1 Lakh", "Above ₹1 Lakh", "Not sure"]
        elif curr == "USD":
            options = ["Under $1,000", "$1,000 - $3,000", "Above $3,000", "Not sure"]
        elif curr == "EUR":
            options = ["Under €1,000", "€1,000 - €3,000", "Above €3,000", "Not sure"]
        else:
            options = [f"Under {sym}1,000", f"{sym}1,000 - {sym}3,000", f"Above {sym}3,000", "Not sure"]

        questions.append({
            "id": "budget",
            "prompt": "What is your approximate budget per person?",
            "question": "What is your approximate budget per person?",
            "options": options,
        })

    if not extracted.duration_days and not state.dates.duration_days:
        questions.append({
            "id": "duration",
            "prompt": "How many days are you planning to travel?",
            "question": "How many days are you planning to travel?",
            "options": ["3 days", "5 days", "1 week", "2 weeks"],
        })

    return questions


def _travellers_are_explicit(query: str) -> bool:
    return bool(re.search(r"\b(?:\d+|one|two|three|four|five|solo|couple|family|group)\s+(?:adult|person|people|travell?er|friend|guest)s?\b", query, re.IGNORECASE))


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
