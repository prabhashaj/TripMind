"""Conversation API with short-term and long-term memory."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.dependencies import get_llm_provider
from app.core.logging import get_logger
from app.providers.base import LLMProvider
from app.services.memory import memory_store

router = APIRouter(prefix="/api/conversation", tags=["conversation"])
logger = get_logger(__name__)

# Accumulated intake fields per conversation (persists across turns).
_trip_intakes: dict[str, dict[str, str]] = {}
_INTAKE_FIELDS = ("destination", "origin", "duration", "travelers", "budget")

# ---------------------------------------------------------------------------
# System prompt — single source of truth for what this endpoint may claim.
# ---------------------------------------------------------------------------
_SYSTEM_PROMPT = """\
You are TripMind's conversation assistant helping a user fill in the essential \
details needed to start a real trip-planning workflow.

STRICT RULES — follow every one of these exactly:
1. You do NOT have the ability to start, track, or check on trip planning yourself. \
   Trip planning only happens through a separate backend workflow that is triggered \
   when the user provides enough information. Never say or imply that a trip brief \
   is ready, that planning has started, that research is in progress, or that any \
   agents are working — you have no way of knowing any of that and it is never \
   true from this endpoint.
2. Your ONLY job is to collect five trip facts: destination, origin (departure city), \
   duration, number of travellers, and budget. Once you have all five (or the user \
   says they don't mind about budget), acknowledge naturally and say you are ready \
   to hand off to the planner.
3. If the user's message contains a destination AND at least one other signal \
   (duration, date, traveller count, or budget), treat it as a trip request even \
   without trigger words like "plan" or "book". Do not demand they restate the \
   information in a different form.
4. Ask only for genuinely missing fields, one or two at a time. Keep replies short.
5. Never give travel advice, recommend hotels, invent prices, or describe an \
   itinerary — that is the planner's job.
6. If the message is completely unrelated to travel planning, respond briefly and \
   steer back: "I'm here to help plan your trip — what destination are you \
   considering?"
"""


class ConversationMessageRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=200)
    conversation_id: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=4000)
    remember: bool = True


class IntakeExtraction(BaseModel):
    """
    LLM output: extracted trip facts + routing decision.

    `planning_ready` must be True only when destination, origin, duration,
    travelers AND budget are all known (budget may be "flexible").
    `assistant_reply` is what the user sees; it must comply with the system
    prompt rules (no fake planning progress claims).
    `planning_query` is a compact, self-contained sentence for the planning
    workflow — only populated when planning_ready is True.
    """
    destination: str | None = None
    origin: str | None = None
    duration: str | None = None
    travelers: str | None = None
    budget: str | None = None
    planning_ready: bool = False
    assistant_reply: str = ""
    planning_query: str | None = None


class ClearMemoryRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=200)


def _build_user_prompt(conversation_history: list[dict], current_message: str, intake: dict) -> str:
    """Build the prompt the LLM sees on each turn."""
    history_lines = "\n".join(
        f"{turn['role'].capitalize()}: {turn['content']}"
        for turn in conversation_history[-8:]  # last 4 turns
    )

    known = {k: v for k, v in intake.items() if k in _INTAKE_FIELDS and v}
    known_str = (
        "\n".join(f"  - {k}: {v}" for k, v in known.items())
        if known else "  (none yet)"
    )
    missing = [f for f in _INTAKE_FIELDS if f not in known]
    missing_str = ", ".join(missing) if missing else "none — all collected!"

    return (
        f"Conversation so far:\n{history_lines}\n\n"
        f"Already collected:\n{known_str}\n"
        f"Still missing: {missing_str}\n\n"
        f"Latest user message: {current_message}\n\n"
        "Extract any new trip facts from the latest message and update the fields above. "
        "Then decide: if all five fields are now known (or budget is 'flexible'), set "
        "planning_ready=true and write a short, friendly planning_query sentence "
        "(e.g. 'Plan a 7-day trip to Goa from Delhi for 2 people with a budget of ₹50,000.'). "
        "Write a natural assistant_reply that follows the system-prompt rules strictly."
    )


@router.post("/message")
async def send_message(
    request: ConversationMessageRequest,
    llm: LLMProvider = Depends(get_llm_provider),
) -> dict[str, Any]:
    memory = memory_store.get_long_term(request.user_id)
    short_term = memory_store.add_turn(request.conversation_id, "user", request.message)
    if request.remember:
        memory = memory_store.remember(request.user_id, request.message)

    # Persist intake state across turns
    intake = _trip_intakes.setdefault(request.conversation_id, {})
    intake["request"] = intake.get("request", request.message)

    planning_ready = False
    planning_query: str | None = None

    if llm.status.available:
        try:
            # short_term already contains the current user turn (just added above).
            # Pass prior turns as conversation context and the current message separately.
            prior_turns = short_term[:-1]
            current_message = short_term[-1]["content"] if short_term else request.message

            result: IntakeExtraction = await llm.complete_structured(
                system_prompt=_SYSTEM_PROMPT,
                user_message=_build_user_prompt(prior_turns, current_message, intake),
                output_schema=IntakeExtraction,
                temperature=0.1,
            )

            # Merge newly extracted fields into the persistent intake store
            for field in _INTAKE_FIELDS:
                value = getattr(result, field)
                if value and value.strip():
                    intake[field] = value.strip()

            planning_ready = result.planning_ready
            planning_query = result.planning_query or None

            # Double-check: LLM must not claim ready unless all fields present
            # (guards against an over-eager model)
            if planning_ready:
                missing = [f for f in _INTAKE_FIELDS if f not in intake]
                if missing:
                    planning_ready = False
                    planning_query = None
                    logger.warning(
                        "llm_claimed_planning_ready_but_fields_missing",
                        missing=missing,
                        conversation_id=request.conversation_id,
                    )

            response = result.assistant_reply or (
                "Could you tell me a bit more about your trip?"
            )

            # Clear the intake for this conversation after handoff so a new trip
            # can be started fresh in the same conversation session.
            if planning_ready:
                _trip_intakes.pop(request.conversation_id, None)

        except Exception as exc:
            logger.warning("conversation_llm_failed", error=str(exc))
            # Deterministic safe fallback — never claims planning happened
            response = (
                "Tell me the destination you want to visit, your departure city, "
                "trip length, number of travellers, and budget — and I'll get planning started."
            )
    else:
        # LLM offline — give a deterministic prompt that doesn't invent progress
        response = (
            "The AI assistant is temporarily unavailable. "
            "Please share your destination, departure city, trip length, "
            "number of travellers, and budget to start planning."
        )

    memory_store.add_turn(request.conversation_id, "assistant", response)

    return {
        "response": response,
        "conversation_id": request.conversation_id,
        "short_term": memory_store.get_short_term(request.conversation_id),
        "long_term": memory.model_dump(mode="json"),
        "planning_ready": planning_ready,
        "planning_query": planning_query,
        "extracted_fields": intake if planning_ready else None,
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
