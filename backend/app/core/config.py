"""
Application configuration via Pydantic BaseSettings.
All settings are loaded from environment variables / .env file.
"""
from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_env: Literal["development", "staging", "production"] = "development"
    app_secret_key: str = "change_this_in_production"
    cors_origins: str = "http://localhost:3000"

    # Database
    database_url: str = "postgresql+asyncpg://travel_agent:travel_secret@localhost:5432/travel_agent_db"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "travel_agent"
    postgres_password: str = "travel_secret"
    postgres_db: str = "travel_agent_db"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Mistral
    mistral_api_key: str = ""
    mistral_model_large: str = "mistral-large-latest"
    mistral_model_small: str = "mistral-small-latest"

    # Tavily
    tavily_api_key: str = ""

    # Mapbox
    mapbox_access_token: str = ""

    # OpenWeatherMap
    openweather_api_key: str = ""

    # Amadeus (optional)
    amadeus_client_id: str = ""
    amadeus_client_secret: str = ""
    workflow_node_timeout_seconds: float = 30.0

    @field_validator("cors_origins")
    @classmethod
    def parse_cors_origins(cls, v: str) -> list[str]:
        # Strip JSON array brackets and quotes if present
        v = v.strip()
        if v.startswith("["):
            v = v.strip("[]")
        # Split by comma, strip whitespace and surrounding quotes
        return [origin.strip().strip('"').strip("'") for origin in v.split(",") if origin.strip().strip('"').strip("'")]


    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    @property
    def mistral_available(self) -> bool:
        return bool(self.mistral_api_key)

    @property
    def tavily_available(self) -> bool:
        return bool(self.tavily_api_key)

    @property
    def weather_available(self) -> bool:
        return bool(self.openweather_api_key)

    @property
    def amadeus_available(self) -> bool:
        return bool(self.amadeus_client_id and self.amadeus_client_secret)


@lru_cache
def get_settings() -> Settings:
    return Settings()
