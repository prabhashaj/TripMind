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
    del history[:-100]
    is_redis = await check_redis_available()
    payload = event.model_dump_json()

    if is_redis and _redis_client:
        try:
            channel = _trip_channel(event.trip_id)
            await _redis_client.publish(channel, payload)
            logger.debug("event_published_redis", channel=channel, event_type=event.type)
            return
        except Exception as exc:
            logger.warning("redis_publish_failed_fallback_memory", error=str(exc))

    # In-memory queue distribution
    queues = _memory_subscribers.get(event.trip_id, [])
    for q in queues:
        try:
            q.put_nowait(event)
        except Exception:
            pass
    logger.debug("event_published_memory", trip_id=event.trip_id, subscribers=len(queues))


async def subscribe_to_trip(
    trip_id: str,
    timeout_seconds: int = 300,
) -> AsyncGenerator[TripEvent, None]:
    """
    Subscribe to a trip's event channel and yield TripEvents.
    Uses Redis pub/sub if available, otherwise in-memory queue.
    """
    # The workflow can emit its first events before the browser opens SSE.
    # Replay the in-process history so the UI never starts at a blank action.
    for event in _event_history.get(trip_id, []):
        yield event

    is_redis = await check_redis_available()

    if is_redis and _redis_client:
        try:
            pubsub = _redis_client.pubsub()
            channel = _trip_channel(trip_id)
            await pubsub.subscribe(channel)
            logger.info("sse_subscribed_redis", trip_id=trip_id, channel=channel)

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

    # Memory Queue Fallback
    queue: asyncio.Queue[TripEvent] = asyncio.Queue()
    _memory_subscribers[trip_id].append(queue)
    logger.info("sse_subscribed_memory", trip_id=trip_id)

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
