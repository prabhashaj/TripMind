"""
Currency Conversion Service.
Provides live FX rates with in-memory caching and fallback static rates.
"""
import httpx
from datetime import datetime, timezone, timedelta

from app.core.logging import get_logger

logger = get_logger(__name__)


class CurrencyService:
    def __init__(self):
        self._cache: dict[str, dict[str, float]] = {}
        self._cache_time: datetime | None = None
        self._cache_ttl = timedelta(hours=6)
        
        # Approximate static fallback rates relative to INR
        self._fallback_rates = {
            "USD": 0.012,    # 1 INR = 0.012 USD (1 USD = 83 INR)
            "EUR": 0.011,
            "GBP": 0.0094,
            "JPY": 1.78,
            "AUD": 0.018,
            "CAD": 0.016,
            "CHF": 0.011,
            "CNY": 0.086,
            "SGD": 0.016,
            "NZD": 0.020,
            "INR": 1.0,
        }

    async def _fetch_rates(self) -> None:
        """Fetch live exchange rates using INR as base."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get("https://open.er-api.com/v6/latest/INR", timeout=5.0)
                if response.status_code == 200:
                    data = response.json()
                    if "rates" in data:
                        self._cache["INR"] = data["rates"]
                        self._cache_time = datetime.now(timezone.utc)
                        logger.info("currency_rates_updated", base="INR")
                        return
        except Exception as e:
            logger.warning("currency_api_failed", error=str(e))
            
        # If we reach here, API failed. Use fallback if cache is empty.
        if "INR" not in self._cache:
            logger.warning("currency_using_fallback_rates")
            self._cache["INR"] = self._fallback_rates

    async def get_rate(self, from_currency: str, to_currency: str) -> float:
        """Get the exchange rate to convert from one currency to another."""
        from_currency = from_currency.upper()
        to_currency = to_currency.upper()
        
        if from_currency == to_currency:
            return 1.0
            
        now = datetime.now(timezone.utc)
        if not self._cache_time or (now - self._cache_time) > self._cache_ttl:
            await self._fetch_rates()
            
        rates = self._cache.get("INR", self._fallback_rates)
        
        # Rate from INR to from_currency
        from_rate = rates.get(from_currency)
        # Rate from INR to to_currency
        to_rate = rates.get(to_currency)
        
        if not from_rate or not to_rate:
            logger.error("currency_rate_missing", from_curr=from_currency, to_curr=to_currency)
            return 1.0  # Fallback to 1:1 if unknown
            
        # Convert: (1 / from_rate) gives amount in INR, then multiply by to_rate
        return to_rate / from_rate

    async def convert(self, amount: float, from_currency: str, to_currency: str) -> float:
        """Convert an amount from one currency to another."""
        rate = await self.get_rate(from_currency, to_currency)
        return amount * rate


# Global instance
currency_service = CurrencyService()
