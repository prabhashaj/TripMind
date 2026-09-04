"""Conversation API with short-term and long-term memory."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.dependencies import get_llm_provider
from app.providers.base import LLMProvider
from app.services.memory import memory_store

router = APIRouter(prefix="/api/conversation", tags=["conversation"])


class ConversationMessageRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=200)
    conversation_id: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=4000)
    remember: bool = True


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

    context = "\n".join(f"{turn['role']}: {turn['content']}" for turn in short_term)
    remembered = {
        "facts": memory.facts,
        "preferences": memory.preferences,
        "saved_destinations": memory.saved_destinations,
    }
    response = ""
    if llm.status.available:
        try:
            response = await llm.complete(
                system_prompt=(
                    "You are TripMind, a concise and practical travel conversation agent. "
                    "Use remembered details naturally, never claim to remember something not listed, "
                    f"and answer in 2-4 sentences. Long-term memory: {remembered}"
                ),
                user_message=f"Recent conversation:\n{context}\n\nLatest message: {request.message}",
                temperature=0.4,
            )
        except Exception:
            response = ""
    if not response:
        response = fallback_response(request.message, memory)
    memory_store.add_turn(request.conversation_id, "assistant", response)
    return {
        "response": response,
        "conversation_id": request.conversation_id,
        "short_term": memory_store.get_short_term(request.conversation_id),
        "long_term": memory.model_dump(mode="json"),
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
