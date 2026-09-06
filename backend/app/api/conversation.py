"""Conversation API with short-term and long-term memory."""
from __future__ import annotations

from typing import Any
import re

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.dependencies import get_llm_provider
from app.core.logging import get_logger
from app.providers.base import LLMProvider
from app.services.memory import memory_store

router = APIRouter(prefix="/api/conversation", tags=["conversation"])
logger = get_logger(__name__)

# A lightweight intake state keeps the conversational planner focused on the
# essentials before the expensive multi-agent workflow is started.
_trip_intakes: dict[str, dict[str, str]] = {}
_INTAKE_FIELDS = ("destination", "origin", "duration", "travelers", "budget")
_INTAKE_QUESTION = (
    "To start planning, please share the destination, departure city, trip length, number of travellers, "
    "and total budget in one message. For example: Kashmir, from Hyderabad, 4 days, 2 people, ₹3 lakh."
)


def _looks_like_trip_request(message: str) -> bool:
    return bool(re.search(r"\b(plan(?:ning)?|book|trip|travel|holiday|vacation|visit|go(?:ing)?\s+to)\b", message, re.I))


def _extract_initial_details(message: str) -> dict[str, str]:
    """Pull only obvious facts from a first request; follow-up answers use order."""
    found: dict[str, str] = {}
    destination = re.search(r"\b(?:to|visit|plan|book)\s+(?:a\s+trip\s+to\s+|my\s+)?([A-Za-z][A-Za-z .'-]+?)(?=\s+(?:from|for|with|under|budget)\b|[,.!?]|$)", message, re.I)
    origin = re.search(r"\b(?:from|starting\s+(?:in|from))\s+([A-Za-z][A-Za-z .'-]+?)(?=\s+(?:to|for|with|under|budget)\b|[,.!?]|$)", message, re.I)
    duration = re.search(r"\b(\d+\s*[- ]?\s*(?:days?|nights?|weeks?))\b", message, re.I)
    travelers = re.search(r"\b(\d+\s*(?:people|persons?|adults?|travellers?|travelers?))\b|\b(solo|couple|family)\b", message, re.I)
    budget = re.search(r"(?:₹|\$|€|£|INR|USD|EUR|Rs\.?)[\s]*[\d,]+|\b\d+(?:\.\d+)?\s*(?:lakhs?|lacs?|k)\b|\b(?:under|budget(?:\s+of)?)[\s]*(?:₹|\$|€|£|INR|USD|EUR|Rs\.?)?[\s]*[\d,]+", message, re.I)
    if destination: found["destination"] = destination.group(1).strip()
    if origin: found["origin"] = origin.group(1).strip()
    if duration: found["duration"] = duration.group(1).strip()
    if travelers: found["travelers"] = travelers.group(0).strip()
    if budget: found["budget"] = budget.group(0).strip()
    return found


def _handle_trip_intake(conversation_id: str, message: str) -> tuple[str, bool, str] | None:
    intake = _trip_intakes.get(conversation_id)
    if intake is None:
        if not _looks_like_trip_request(message):
            return None
        intake = _extract_initial_details(message)
        intake["request"] = message
        _trip_intakes[conversation_id] = intake
    else:
        intake.update(_extract_initial_details(message))

    missing_fields = [field for field in _INTAKE_FIELDS if field not in intake]
    
    # If the user explicitly mentions they don't know or aren't sure, we can set budget to flexible
    if 'budget' in missing_fields and re.search(r'\b(not sure|don\'?t know|no idea|decide later|not decided|skip)\b', message, re.I):
        intake['budget'] = 'flexible'
        missing_fields.remove('budget')

    if missing_fields:
        if len(missing_fields) == len(_INTAKE_FIELDS):
            return _INTAKE_QUESTION, False, ""
        
        friendly_names = {
            "destination": "destination",
            "origin": "departure city",
            "duration": "trip length",
            "travelers": "number of travellers",
            "budget": "total budget"
        }
        missing_names = [friendly_names[f] for f in missing_fields]
        
        if len(missing_names) == 1:
            missing_str = missing_names[0]
        else:
            missing_str = ", ".join(missing_names[:-1]) + ", and " + missing_names[-1]
            
        return f"To continue planning, please share the {missing_str}.", False, ""

    query = (
        f"Plan a trip to {intake['destination']} from {intake['origin']} for "
        f"{intake['duration']} for {intake['travelers']} with a total budget of {intake['budget']}."
    )
    return (
        "I have the essentials. **Your trip brief is ready.** "
        "Generate the itinerary when you are ready.",
        True,
        query,
    )


class ConversationMessageRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=200)
    conversation_id: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=4000)
    remember: bool = True


class IntakeExtraction(BaseModel):
    """LLM-extracted fields for the conversational planning intake."""
    destination: str | None = None
    origin: str | None = None
    duration: str | None = None
    travelers: str | None = None
    budget: str | None = None


class ClearMemoryRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=200)


def fallback_response(message: str, memory: Any) -> str:
    if memory.preferences:
        preferences = ", ".join(f"{key.replace('_', ' ')}: {value}" for key, value in memory.preferences.items())
        return f"I remember your {preferences}. I can use that to tailor your next trip. What would you like to plan?"
    if memory.facts:
        return f"I remember that {memory.facts[-1].lower()}. I will keep it in mind for your travel plans."
    return "I can help with destinations, budgets, stays, transport, and itineraries. Tell me what kind of journey you have in mind."


@router.post("/message")
async def send_message(
    request: ConversationMessageRequest,
    llm: LLMProvider = Depends(get_llm_provider),
) -> dict[str, Any]:
    memory = memory_store.get_long_term(request.user_id)
    short_term = memory_store.add_turn(request.conversation_id, "user", request.message)
    if request.remember:
        memory = memory_store.remember(request.user_id, request.message)

    # The orchestrator LLM understands short answers such as "Kashmir" and
    # fills the shared trip brief. It is deliberately limited to extraction;
    # workflow agents, not this chat, produce the actual itinerary.
    if llm.status.available:
        try:
            extraction: IntakeExtraction = await llm.complete_structured(
                system_prompt=(
                    "You are the intake layer for a travel-planning orchestrator. Extract only trip facts from the latest "
                    "user message and recent conversation. Never invent missing values. Do not create an itinerary, give travel "
                    "advice, prices, bookings, or recommendations. A single destination name such as 'Kashmir' is a destination."
                ),
                user_message="Recent conversation:\n" + "\n".join(
                    f"{turn['role']}: {turn['content']}" for turn in short_term
                ),
                output_schema=IntakeExtraction,
                temperature=0.0,
            )
            intake = _trip_intakes.setdefault(request.conversation_id, {})
            for field in _INTAKE_FIELDS:
                value = getattr(extraction, field)
                if value:
                    intake[field] = value.strip()
            intake["request"] = intake.get("request", request.message)
        except Exception as exc:
            logger.warning("conversation_intake_extraction_failed", error=str(exc))

    intake_result = _handle_trip_intake(request.conversation_id, request.message)
    planning_ready = False
    planning_query = ""
    if intake_result:
        response, planning_ready, planning_query = intake_result
    else:
        # This endpoint is intentionally not an itinerary chat. Keeping it
        # deterministic prevents old conversation context from leaking plans.
        response = "Tell me the destination you want to plan, and I will collect the essential trip details."
    memory_store.add_turn(request.conversation_id, "assistant", response)
    return {
        "response": response,
        "conversation_id": request.conversation_id,
        "short_term": memory_store.get_short_term(request.conversation_id),
        "long_term": memory.model_dump(mode="json"),
        "planning_ready": planning_ready,
        "planning_query": planning_query or None,
    }


@router.get("/{user_id}/memory")
async def get_memory(user_id: str, conversation_id: str | None = None) -> dict[str, Any]:
    return {
        "long_term": memory_store.get_long_term(user_id).model_dump(mode="json"),
        "short_term": memory_store.get_short_term(conversation_id) if conversation_id else [],
    }


@router.delete("/{user_id}/memory")
async def clear_memory(user_id: str) -> dict[str, str]:
    memory_store.forget_long_term(user_id)
    return {"status": "memory_cleared"}
