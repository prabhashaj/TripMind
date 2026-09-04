"""Short-term conversation and long-term preference memory."""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from app.core.logging import get_logger

logger = get_logger(__name__)
MEMORY_DIR = Path(__file__).parent.parent.parent / ".data" / "memory"
MAX_SHORT_TERM_TURNS = 20


class LongTermMemory(BaseModel):
    user_id: str
    facts: list[str] = Field(default_factory=list)
    preferences: dict[str, str] = Field(default_factory=dict)
    saved_destinations: list[str] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ConversationMemoryStore:
    def __init__(self) -> None:
        self._short_term: dict[str, list[dict[str, str]]] = {}

    def _path(self, user_id: str) -> Path:
        key = hashlib.sha256(user_id.encode("utf-8")).hexdigest()
        return MEMORY_DIR / f"{key}.json"

    def get_long_term(self, user_id: str) -> LongTermMemory:
        path = self._path(user_id)
        if path.exists():
            try:
                return LongTermMemory.model_validate_json(path.read_text(encoding="utf-8"))
            except Exception as exc:
                logger.warning("memory_load_failed", user_id=user_id, error=str(exc))
        return LongTermMemory(user_id=user_id)

    def save_long_term(self, memory: LongTermMemory) -> LongTermMemory:
        MEMORY_DIR.mkdir(parents=True, exist_ok=True)
        memory.updated_at = datetime.now(timezone.utc)
        self._path(memory.user_id).write_text(memory.model_dump_json(indent=2), encoding="utf-8")
        return memory

    def get_short_term(self, conversation_id: str) -> list[dict[str, str]]:
        return list(self._short_term.get(conversation_id, []))

    def add_turn(self, conversation_id: str, role: str, content: str) -> list[dict[str, str]]:
        turns = self._short_term.setdefault(conversation_id, [])
        turns.append({"role": role, "content": content})
        self._short_term[conversation_id] = turns[-MAX_SHORT_TERM_TURNS:]
        return list(self._short_term[conversation_id])

    def clear_short_term(self, conversation_id: str) -> None:
        self._short_term.pop(conversation_id, None)

    def remember(self, user_id: str, message: str) -> LongTermMemory:
        memory = self.get_long_term(user_id)
        normalized = " ".join(message.strip().split())
        if not normalized:
            return memory

        fact_patterns = (
            r"(?:i am|i'm|my name is|we are)\s+([^.!?]{2,80})",
            r"(?:i prefer|i like|i love|i usually choose)\s+([^.!?]{2,80})",
            r"(?:remember that|keep in mind that)\s+([^.!?]{2,120})",
        )
        for pattern in fact_patterns:
            match = re.search(pattern, normalized, re.IGNORECASE)
            if match:
                fact = match.group(0).strip()
                if fact.lower() not in {item.lower() for item in memory.facts}:
                    memory.facts.append(fact)
                break

        preference_patterns = {
            "travel_style": r"\b(luxury|budget|backpack(?:er|ing)?|slow travel|adventure|relaxed)\b",
            "diet": r"\b(vegetarian|vegan|halal|kosher|gluten[- ]free)\b",
            "pace": r"\b(relaxed|moderate|packed)\s+(?:pace|schedule)\b",
        }
        for key, pattern in preference_patterns.items():
            match = re.search(pattern, normalized, re.IGNORECASE)
            if match:
                memory.preferences[key] = match.group(1).lower()

        destinations = re.findall(
            r"\b(?:visit|travel to|going to|trip to|from)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)",
            message,
        )
        for destination in destinations:
            if destination.lower() not in {item.lower() for item in memory.saved_destinations}:
                memory.saved_destinations.append(destination)

        return self.save_long_term(memory)

    def forget_long_term(self, user_id: str) -> None:
        self._path(user_id).unlink(missing_ok=True)


memory_store = ConversationMemoryStore()
