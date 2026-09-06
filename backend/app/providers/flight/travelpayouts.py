import httpx
import logging
from datetime import datetime
from typing import Any

from app.models.trip_state import TransportLeg, TransportMode
from app.providers.base import FlightProvider, ProviderStatus

logger = logging.getLogger(__name__)

# Basic city to IATA mapping (can be expanded)
CITY_TO_IATA = {
    "delhi": "DEL",
    "dubai": "DXB",
    "london": "LON",
    "mumbai": "BOM",
    "bangalore": "BLR",
    "chennai": "MAA",
    "hyderabad": "HYD",
    "kolkata": "CCU",
    "new york": "NYC",
    "paris": "PAR",
    "tokyo": "TYO",
    "singapore": "SIN",
    "sydney": "SYD",
    "toronto": "YTO",
}

class TravelpayoutsFlightProvider(FlightProvider):
    def __init__(self, token: str):
        self.token = token
        self.base_url = "http://api.travelpayouts.com/aviasales/v3/get_latest_prices"

    def _get_iata(self, city: str) -> str:
        # Very simple fallback for IATA conversion
        city_lower = city.strip().lower()
        if len(city_lower) == 3 and city_lower.isalpha():
            return city_lower.upper()
        return CITY_TO_IATA.get(city_lower, city[:3].upper())

    async def search_flights(
        self,
        origin: str,
        destination: str,
        departure_date: str,
        return_date: str | None = None,
        adults: int = 1,
        currency: str = "INR",
    ) -> list[TransportLeg]:
        origin_iata = self._get_iata(origin)
        dest_iata = self._get_iata(destination)

        params = {
            "origin": origin_iata,
            "destination": dest_iata,
            "currency": currency.lower(),
            "token": self.token,
            "sorting": "price",
            "show_to_affiliates": "true"
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(self.base_url, params=params)
                response.raise_for_status()
                data = response.json()
        except Exception as e:
            logger.error(f"Travelpayouts API error: {e}")
            return []

        if not data.get("success") or not data.get("data"):
            return []

        target_date = departure_date
        flights = data["data"]

        def date_diff(date_str: str, target: str) -> int:
            try:
                d1 = datetime.strptime(date_str, "%Y-%m-%d").date()
                d2 = datetime.strptime(target, "%Y-%m-%d").date()
                return abs((d1 - d2).days)
            except:
                return 999

        flights_sorted = sorted(flights, key=lambda x: (date_diff(x.get("depart_date", ""), target_date), x.get("value", 0)))
        
        legs = []
        for f in flights_sorted[:10]:
            depart_date_str = f.get("depart_date", "")
            depart_time_str = f"{depart_date_str}T10:00:00Z" if depart_date_str else None
            
            depart_datetime = None
            if depart_time_str:
                try:
                    depart_datetime = datetime.fromisoformat(depart_time_str.replace("Z", "+00:00"))
                except:
                    pass

            price = float(f.get("value", 0))
            
            ddmm = ""
            if depart_date_str:
                parts = depart_date_str.split("-")
                if len(parts) == 3:
                    ddmm = f"{parts[2]}{parts[1]}"
            
            booking_url = f"https://www.aviasales.com/search/{origin_iata}{ddmm}{dest_iata}"
            
            leg = TransportLeg(
                mode=TransportMode.FLIGHT,
                provider="Aviasales",
                carrier=f.get("gate", "Aviasales Partner"),
                origin=origin_iata,
                destination=dest_iata,
                departure_time=depart_datetime,
                arrival_time=None,
                duration_minutes=None,
                stops=int(f.get("number_of_changes", 0)),
                price=price,
                currency=currency.upper(),
                source="travelpayouts_cache",
                provenance="estimated",
                notes="Recent market price, not a live quote — confirm exact fare when booking",
                booking_url=booking_url
            )
            legs.append(leg)

        return legs

    @property
    def status(self) -> ProviderStatus:
        if not self.token:
            return ProviderStatus(available=False, reason="Travelpayouts token not configured")
        return ProviderStatus(available=True)
