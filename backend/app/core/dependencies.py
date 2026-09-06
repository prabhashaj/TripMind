"""
Dependency injection container for all providers.
Initialized at app startup and available via FastAPI Depends.
"""
from __future__ import annotations

from functools import lru_cache

from app.providers.base import FlightProvider, HotelProvider, LLMProvider, SearchProvider, TrainProvider
from app.providers.llm.mistral import MistralProvider
from app.providers.mocks import MockFlightProvider, MockHotelProvider, MockTrainProvider
from app.providers.search.tavily import TavilySearchProvider
from app.core.config import get_settings

settings = get_settings()


@lru_cache
def get_llm_provider() -> LLMProvider:
    return MistralProvider()


@lru_cache
def get_search_provider() -> SearchProvider:
    return TavilySearchProvider()


from app.providers.flight.travelpayouts import TravelpayoutsFlightProvider

@lru_cache
def get_flight_provider() -> FlightProvider:
    if settings.travelpayouts_token:
        return TravelpayoutsFlightProvider(settings.travelpayouts_token)
    return MockFlightProvider()


@lru_cache
def get_train_provider() -> TrainProvider:
    return MockTrainProvider()


@lru_cache
def get_hotel_provider() -> HotelProvider:
    return MockHotelProvider()
