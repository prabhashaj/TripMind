"""
Abstract base classes for all travel data providers.
Agents depend on these interfaces, never on specific implementations.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

from app.models.trip_state import (
    ActivityItem,
    DestinationCandidate,
    HotelOption,
    TransportLeg,
    TripPreferences,
)


@dataclass
class ProviderStatus:
    available: bool
    reason: str | None = None


class LLMProvider(ABC):
    """Abstract interface for LLM calls."""

    @abstractmethod
    async def complete(
        self,
        system_prompt: str,
        user_message: str,
        response_format: Any = None,
        temperature: float = 0.3,
        model: str | None = None,
    ) -> str:
        """Return the LLM text completion."""

    @abstractmethod
    async def complete_structured(
        self,
        system_prompt: str,
        user_message: str,
        output_schema: type,
        temperature: float = 0.1,
        model: str | None = None,
    ) -> Any:
        """Return a structured Pydantic model from the LLM."""

    @property
    @abstractmethod
    def status(self) -> ProviderStatus: ...


class SearchProvider(ABC):
    """Abstract interface for web search."""

    @abstractmethod
    async def search(
        self,
        query: str,
        max_results: int = 10,
        search_depth: str = "basic",
    ) -> dict[str, Any]:
        """Return dict with 'results' (list of dict) and 'images' (list of dict)"""

    @property
    @abstractmethod
    def status(self) -> ProviderStatus: ...


class FlightProvider(ABC):
    """Abstract interface for flight search."""

    @abstractmethod
    async def search_flights(
        self,
        origin: str,
        destination: str,
        departure_date: str,
        return_date: str | None = None,
        adults: int = 1,
        currency: str = "INR",
    ) -> list[TransportLeg]:
        """Return flight options."""

    @property
    @abstractmethod
    def status(self) -> ProviderStatus: ...


class TrainProvider(ABC):
    """Abstract interface for train search."""

    @abstractmethod
    async def search_trains(
        self,
        origin: str,
        destination: str,
        departure_date: str,
        passengers: int = 1,
        currency: str = "INR",
    ) -> list[TransportLeg]:
        """Return train options."""

    @property
    @abstractmethod
    def status(self) -> ProviderStatus: ...


class HotelProvider(ABC):
    """Abstract interface for hotel search."""

    @abstractmethod
    async def search_hotels(
        self,
        destination: str,
        check_in: str,
        check_out: str,
        adults: int = 1,
        currency: str = "INR",
        preferences: TripPreferences | None = None,
    ) -> list[HotelOption]:
        """Return hotel options."""

    @property
    @abstractmethod
    def status(self) -> ProviderStatus: ...


class WeatherProvider(ABC):
    """Abstract interface for weather data."""

    @abstractmethod
    async def get_forecast(
        self,
        location: str,
        start_date: str,
        end_date: str,
    ) -> dict[str, Any]:
        """Return weather forecast."""

    @property
    @abstractmethod
    def status(self) -> ProviderStatus: ...


class MapsProvider(ABC):
    """Abstract interface for geocoding and routing."""

    @abstractmethod
    async def geocode(self, address: str) -> dict[str, float] | None:
        """Return {lat, lng} or None."""

    @abstractmethod
    async def distance_matrix(
        self,
        origins: list[str],
        destinations: list[str],
    ) -> dict[str, Any]:
        """Return distance/duration matrix."""

    @property
    @abstractmethod
    def status(self) -> ProviderStatus: ...


class RideProvider(ABC):
    """Abstract interface for ride-sharing search (Uber/Rapido etc)."""

    @abstractmethod
    async def estimate_ride(
        self,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float,
        currency: str = "INR",
    ) -> dict[str, Any]:
        """Return ride estimate."""

    @property
    @abstractmethod
    def status(self) -> ProviderStatus: ...
