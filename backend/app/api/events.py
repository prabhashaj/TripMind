"""
SSE (Server-Sent Events) endpoint for real-time agent activity streaming.
"""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.core.logging import get_logger
from app.services.event_bus import subscribe_to_trip

router = APIRouter(prefix="/api/trips", tags=["events"])
logger = get_logger(__name__)


@router.get("/{trip_id}/events")
async def stream_trip_events(trip_id: str) -> StreamingResponse:
    """
    Stream real-time agent activity events for a trip via Server-Sent Events.

    Connect to this endpoint to receive live updates as agents work:
    - Agent started/completed/failed
    - Search progress
    - Destinations found (with data)
    - Hotels found (with data)
    - Itinerary created (with data)
    - Budget calculated (with data)
    - Verification results
    - Trip ready
    """

    async def event_generator():
        # Send initial connection event
        yield "event: connected\ndata: {\"message\": \"Connected to trip event stream\"}\n\n"

        try:
            async for event in subscribe_to_trip(trip_id, timeout_seconds=300):
                yield event.to_sse()
        except Exception as exc:
            logger.error("sse_error", trip_id=trip_id, error=str(exc))
            yield f"event: error\ndata: {{\"error\": \"{str(exc)}\"}}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        },
    )
