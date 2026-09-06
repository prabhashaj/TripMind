"""
Event model for real-time agent activity streaming via SSE.
Every meaningful agent/tool action generates a TripEvent.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class EventType(str, Enum):
    # Agent lifecycle
    AGENT_STARTED = "agent.started"
    AGENT_COMPLETED = "agent.completed"
    AGENT_FAILED = "agent.failed"
    AGENT_SKIPPED = "agent.skipped"

    # Tool lifecycle
    TOOL_STARTED = "tool.started"
    TOOL_COMPLETED = "tool.completed"
    TOOL_FAILED = "tool.failed"

    # Search
    SEARCH_STARTED = "search.started"
    SEARCH_COMPLETED = "search.completed"

    # Planning milestones
    PREFERENCES_EXTRACTED = "preferences.extracted"
    PREFERENCE_QUESTIONS = "preference.questions"
    DESTINATIONS_FOUND = "destinations.found"
    TRANSPORT_FOUND = "transport.found"
    HOTELS_FOUND = "hotels.found"
    ACTIVITIES_FOUND = "activities.found"
    ITINERARY_CREATED = "itinerary.created"
    BUDGET_CALCULATED = "budget.calculated"

    # Verification
    VERIFICATION_STARTED = "verification.started"
    VERIFICATION_COMPLETED = "verification.completed"
    VERIFICATION_FAILED = "verification.failed"

    # Replanning
    REPLANNING_STARTED = "replanning.started"
    REPLANNING_COMPLETED = "replanning.completed"
    REPLANNING_FAILED = "replanning.failed"

    # Trip lifecycle
    TRIP_READY = "trip.ready"
    TRIP_UPDATED = "trip.updated"
    TRIP_ERROR = "trip.error"
    NODE_TIMEOUT = "node.timeout"

    # Provider status
    PROVIDER_UNAVAILABLE = "provider.unavailable"


class AgentStatus(str, Enum):
    WAITING = "waiting"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class TripEvent(BaseModel):
    """
    A structured event emitted by any agent or tool during planning.
    Streamed to the frontend via SSE.
    """
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    trip_id: str
    run_id: str
    timestamp: datetime = Field(default_factory=utc_now)
    type: EventType
    agent: str | None = None
    tool: str | None = None
    status: AgentStatus | None = None
    message: str  # Human-readable, shown in UI — never raw chain-of-thought
    data: dict[str, Any] = Field(default_factory=dict)  # Structured payload
    items_found: int | None = None

    def to_sse(self) -> str:
        """Format as a Server-Sent Events message."""
        import orjson
        payload = orjson.dumps(self.model_dump(mode="json")).decode()
        return f"event: {self.type.value}\ndata: {payload}\n\n"


class AgentStatusSummary(BaseModel):
    """Snapshot of all agent statuses — sent periodically via SSE."""
    trip_id: str
    run_id: str
    timestamp: datetime = Field(default_factory=utc_now)
    agents: dict[str, AgentStatus] = Field(default_factory=dict)
    messages: dict[str, str] = Field(default_factory=dict)


# Predefined agent names for consistency
class AgentName(str, Enum):
    ORCHESTRATOR = "orchestrator"
    USER_PREFERENCE = "user_preference"
    DESTINATION = "destination"
    TRANSPORT = "transport"
    HOTEL = "hotel"
    ACTIVITY = "activity"
    RESTAURANT = "restaurant"
    ITINERARY = "itinerary"
    BUDGET = "budget"
    VERIFICATION = "verification"
    REPLANNING = "replanning"
