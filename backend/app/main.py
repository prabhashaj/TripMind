"""
FastAPI application entry point.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.events import router as events_router
from app.api.trips import router as trips_router
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger

settings = get_settings()
configure_logging("DEBUG" if settings.is_development else "INFO")
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "startup",
        env=settings.app_env,
        mistral=settings.mistral_available,
        tavily=settings.tavily_available,
    )
    yield
    logger.info("shutdown")


app = FastAPI(
    title="AI Travel Agent API",
    description="Production-grade AI travel planning backend",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
)

# Middleware
cors_origins = settings.cors_origins if isinstance(settings.cors_origins, list) else [settings.cors_origins]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Routers
app.include_router(trips_router)
app.include_router(events_router)


@app.get("/health")
async def health_check() -> dict:
    return {
        "status": "ok",
        "env": settings.app_env,
        "providers": {
            "llm_mistral": settings.mistral_available,
            "search_tavily": settings.tavily_available,
            "weather": settings.weather_available,
            "amadeus_flights": settings.amadeus_available,
        },
    }
