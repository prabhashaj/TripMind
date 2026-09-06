"""
Mock providers for flight, hotel, train, and ride data.
Used when real provider API keys are not configured.
Clearly marked as mock data — never presented as real prices.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from app.models.trip_state import (
    AccommodationType,
    HotelOption,
    TransportLeg,
    TransportMode,
    TripPreferences,
)
from app.providers.base import (
    FlightProvider,
    HotelProvider,
    ProviderStatus,
    RideProvider,
    TrainProvider,
)


class MockFlightProvider(FlightProvider):
    """
    Mock flight provider.
    Returns clearly marked mock data when Amadeus is not configured.
    """

    @property
    def status(self) -> ProviderStatus:
        return ProviderStatus(
            available=True,
            reason="Using mock data — configure AMADEUS_CLIENT_ID for live prices",
        )

    async def search_flights(
        self,
        origin: str,
        destination: str,
        departure_date: str,
        return_date: str | None = None,
        adults: int = 1,
        currency: str = "INR",
    ) -> list[TransportLeg]:
        base_price = 4500.0 * adults
        departure = datetime.fromisoformat(departure_date + "T06:00:00")

        return [
            TransportLeg(
                mode=TransportMode.FLIGHT,
                provider="Mock Provider",
                carrier="IndiGo (estimated)",
                origin=origin,
                destination=destination,
                departure_time=departure,
                arrival_time=departure + timedelta(hours=2, minutes=30),
                duration_minutes=150,
                stops=0,
                price=base_price,
                currency=currency,
                price_label="Estimated — live prices unavailable",
                source="mock",
                is_available=True,
                notes="Live flight prices require Amadeus API configuration",
            ),
            TransportLeg(
                mode=TransportMode.FLIGHT,
                provider="Mock Provider",
                carrier="Air India (estimated)",
                origin=origin,
                destination=destination,
                departure_time=departure.replace(hour=10),
                arrival_time=departure.replace(hour=12, minute=45),
                duration_minutes=165,
                stops=0,
                price=base_price * 1.2,
                currency=currency,
                price_label="Estimated — live prices unavailable",
                source="mock",
                is_available=True,
                notes="Live flight prices require Amadeus API configuration",
            ),
        ]


class MockTrainProvider(TrainProvider):
    @property
    def status(self) -> ProviderStatus:
        return ProviderStatus(
            available=True,
            reason="Using mock data — IRCTC/RailYatri integration not configured",
        )

    async def search_trains(
        self,
        origin: str,
        destination: str,
        departure_date: str,
        passengers: int = 1,
        currency: str = "INR",
    ) -> list[TransportLeg]:
        CITY_TO_COUNTRY = {
            "delhi": "india", "mumbai": "india", "bangalore": "india", 
            "chennai": "india", "hyderabad": "india", "kolkata": "india",
            "london": "uk", "new york": "usa", "paris": "france", "tokyo": "japan",
            "dubai": "uae", "singapore": "singapore", "sydney": "australia", 
            "toronto": "canada", "melbourne": "australia"
        }
        o_c = CITY_TO_COUNTRY.get(origin.lower().strip())
        d_c = CITY_TO_COUNTRY.get(destination.lower().strip())
        if o_c and d_c and o_c != d_c:
            return []

        departure = datetime.fromisoformat(departure_date + "T07:00:00")
        base_price = 1200.0 * passengers

        return [
            TransportLeg(
                mode=TransportMode.TRAIN,
                provider="Mock Provider",
                carrier="Rajdhani Express (estimated)",
                origin=origin,
                destination=destination,
                departure_time=departure,
                arrival_time=departure + timedelta(hours=28),
                duration_minutes=1680,
                stops=3,
                price=base_price,
                currency=currency,
                price_label="Estimated — live prices unavailable",
                source="mock",
                is_available=True,
                notes="Live train prices require IRCTC API configuration",
            ),
        ]


class MockHotelProvider(HotelProvider):
    @property
    def status(self) -> ProviderStatus:
        return ProviderStatus(
            available=True,
            reason="Using mock data — configure a hotel API for live availability",
        )

    async def search_hotels(
        self,
        destination: str,
        check_in: str,
        check_out: str,
        adults: int = 1,
        currency: str = "INR",
        preferences: TripPreferences | None = None,
    ) -> list[HotelOption]:
        from datetime import date
        ci = date.fromisoformat(check_in)
        co = date.fromisoformat(check_out)
        nights = (co - ci).days or 1

        return [
            HotelOption(
                name=f"Grand Palace Hotel, {destination} (estimated)",
                category=AccommodationType.MID_RANGE,
                rating=4.2,
                review_count=312,
                location=f"City Centre, {destination}",
                price_per_night=3500.0,
                total_price=3500.0 * nights,
                currency=currency,
                nights=nights,
                amenities=["Wi-Fi", "Breakfast", "AC", "Room service"],
                distance_from_center_km=0.5,
                breakfast_included=True,
                free_cancellation=True,
                source="mock",
                is_available=True,
            ),
            HotelOption(
                name=f"Budget Inn {destination} (estimated)",
                category=AccommodationType.BUDGET,
                rating=3.8,
                review_count=187,
                location=f"Near bus stand, {destination}",
                price_per_night=1800.0,
                total_price=1800.0 * nights,
                currency=currency,
                nights=nights,
                amenities=["Wi-Fi", "AC"],
                distance_from_center_km=1.2,
                breakfast_included=False,
                free_cancellation=True,
                source="mock",
                is_available=True,
            ),
        ]


class MockRideProvider(RideProvider):
    @property
    def status(self) -> ProviderStatus:
        return ProviderStatus(
            available=False,
            reason="Uber/Rapido real-time API not integrated. Use Uber/Rapido apps for live availability.",
        )

    async def estimate_ride(
        self,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float,
        currency: str = "INR",
    ) -> dict[str, Any]:
        return {
            "available": False,
            "message": "Live ride estimates require Uber/Rapido API integration",
        }
