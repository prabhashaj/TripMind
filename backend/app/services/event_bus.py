"""
Redis client and event bus for SSE streaming with graceful in-memory fallback.
"""
from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from typing import AsyncGenerator

import redis.asyncio as aioredis

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.events import TripEvent

logger = get_logger(__name__)
settings = get_settings()

_redis_client: aioredis.Redis | None = None
_redis_available: bool | None = None

# In-memory fallback queues for local dev without Redis
_memory_subscribers: dict[str, list[asyncio.Queue]] = defaultdict(list)
_memory_cache: dict[str, str] = {}
_event_history: dict[str, list[TripEvent]] = defaultdict(list)


async def check_redis_available() -> bool:
    global _redis_available, _redis_client
    if _redis_available is not None:
        return _redis_available
    try:
        client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=1.0,
        )
        await client.ping()
        _redis_client = client
        _redis_available = True
        logger.info("redis_connected", url=settings.redis_url)
    except Exception as exc:
        _redis_available = False
        _redis_client = None
        logger.warning("redis_unavailable_fallback_to_memory", error=str(exc))
    return _redis_available


def _trip_channel(trip_id: str) -> str:
    return f"trip_events:{trip_id}"


async def publish_event(event: TripEvent) -> None:
    """Publish a TripEvent to Redis pub/sub or in-memory queues."""
    history = _event_history[event.trip_id]
    history.append(event)
    del history[:-50]  # cap at last 50 events per trip
    is_redis = await check_redis_available()
    payload = event.model_dump_json()

    if is_redis and _redis_client:
        try:
            channel = _trip_channel(event.trip_id)
            await _redis_client.publish(channel, payload)
            logger.debug("event_published_redis", channel=channel, event_type=event.type)
        except Exception as exc:
            logger.warning("redis_publish_failed_fallback_memory", error=str(exc))
            # Fall through to in-memory delivery so subscribers still receive the event
            _deliver_in_memory(event)
    else:
        # In-memory queue distribution
        _deliver_in_memory(event)

    # Schedule history cleanup after terminal events so memory doesn't grow unbounded.
    # We keep the buffer alive for 30 s so any late-connecting SSE client can still
    # replay all events before the slot is freed.
    if event.type.value in ("trip.ready", "trip.error"):
        asyncio.get_event_loop().call_later(
            30, _clear_trip_history, event.trip_id
        )


def _deliver_in_memory(event: TripEvent) -> None:
    """Push an event to all in-memory subscribers for a trip."""
    queues = _memory_subscribers.get(event.trip_id, [])
    for q in queues:
        try:
            q.put_nowait(event)
        except Exception:
            pass


def _clear_trip_history(trip_id: str) -> None:
    """Remove the replay buffer for a completed trip."""
    _event_history.pop(trip_id, None)
    logger.debug("trip_history_cleared", trip_id=trip_id)


async def subscribe_to_trip(
    trip_id: str,
    timeout_seconds: int = 300,
) -> AsyncGenerator[TripEvent, None]:
    """
    Subscribe to a trip's event channel and yield TripEvents.
    Uses Redis pub/sub if available, otherwise in-memory queue.

    Race-free replay strategy:
    - For Redis: subscribe to the live channel FIRST, then replay history.
      Any events published between the history snapshot and subscribe() completing
      are received on the live channel, so nothing is lost.
    - For in-memory: register the queue FIRST, then replay history.
      Events enqueued between the queue registration and history replay will
      simply be delivered after the replayed events, maintaining order.
    """
    is_redis = await check_redis_available()

    if is_redis and _redis_client:
        try:
            pubsub = _redis_client.pubsub()
            channel = _trip_channel(trip_id)
            # Subscribe BEFORE replaying history to close the race window.
            await pubsub.subscribe(channel)
            logger.info("sse_subscribed_redis", trip_id=trip_id, channel=channel)

            # Replay buffered history so late-connecting clients see all past events.
            for event in list(_event_history.get(trip_id, [])):
                yield event

            deadline = asyncio.get_event_loop().time() + timeout_seconds
            while asyncio.get_event_loop().time() < deadline:
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=1.0
                )
                if message and message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        event = TripEvent.model_validate(data)
                        yield event
                        if event.type.value in ("trip.ready", "trip.error"):
                            break
                    except Exception as exc:
                        logger.error("event_parse_error", error=str(exc))
                else:
                    await asyncio.sleep(0.05)
            await pubsub.unsubscribe(channel)
            await pubsub.close()
            return
        except Exception as exc:
            logger.warning("redis_subscribe_failed_fallback_memory", error=str(exc))

    # Memory Queue Fallback:
    # Register the queue BEFORE replaying history to close the same race window.
    queue: asyncio.Queue[TripEvent] = asyncio.Queue()
    _memory_subscribers[trip_id].append(queue)
    logger.info("sse_subscribed_memory", trip_id=trip_id)

    # Replay buffered history so late-connecting clients see all past events.
    for event in list(_event_history.get(trip_id, [])):
        yield event

    try:
        deadline = asyncio.get_event_loop().time() + timeout_seconds
        while asyncio.get_event_loop().time() < deadline:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=1.0)
                yield event
                if event.type.value in ("trip.ready", "trip.error"):
                    break
            except asyncio.TimeoutError:
                await asyncio.sleep(0.05)
    finally:
        if queue in _memory_subscribers.get(trip_id, []):
            _memory_subscribers[trip_id].remove(queue)
        logger.info("sse_unsubscribed_memory", trip_id=trip_id)


async def cache_set(key: str, value: str, ttl_seconds: int = 3600) -> None:
    if await check_redis_available() and _redis_client:
        try:
            await _redis_client.set(key, value, ex=ttl_seconds)
            return
        except Exception:
            pass
    _memory_cache[key] = value


async def cache_get(key: str) -> str | None:
    if await check_redis_available() and _redis_client:
        try:
            return await _redis_client.get(key)
        except Exception:
            pass
    return _memory_cache.get(key)


async def cache_delete(key: str) -> None:
    if await check_redis_available() and _redis_client:
        try:
            await _redis_client.delete(key)
            return
        except Exception:
            pass
    _memory_cache.pop(key, None)
