import asyncio
import httpx
from typing import Tuple, Optional
from app.core.logging import get_logger

logger = get_logger(__name__)

# Simple in-memory cache to avoid duplicate API calls
_cache: dict[str, Optional[Tuple[float, float]]] = {}

# Rate limit tracking
_last_request_time: float = 0
_rate_limit_lock = asyncio.Lock()

async def geocode(query: str) -> Optional[Tuple[float, float]]:
    """
    Geocodes a location string using OpenStreetMap Nominatim API.
    Returns (latitude, longitude) or None if not found.
    Respects Nominatim's 1 request/second usage policy.
    """
    global _last_request_time
    
    if not query or not query.strip():
        return None
        
    cache_key = query.strip().lower()
    if cache_key in _cache:
        return _cache[cache_key]
        
    async with _rate_limit_lock:
        now = asyncio.get_event_loop().time()
        time_since_last = now - _last_request_time
        if time_since_last < 1.0:
            await asyncio.sleep(1.0 - time_since_last)
            
        logger.info("geocoding_api_call", query=query)
        _last_request_time = asyncio.get_event_loop().time()
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={
                        "q": query,
                        "format": "json",
                        "limit": "1"
                    },
                    headers={
                        "User-Agent": "TripMind/1.0 (contact@tripmind.test)"
                    }
                )
                response.raise_for_status()
                data = response.json()
                
                if data and isinstance(data, list) and len(data) > 0:
                    result = data[0]
                    lat = float(result["lat"])
                    lng = float(result["lon"])
                    _cache[cache_key] = (lat, lng)
                    return (lat, lng)
                
                _cache[cache_key] = None
                return None
        except Exception as e:
            logger.warning("geocoding_failed", query=query, error=str(e))
            return None
