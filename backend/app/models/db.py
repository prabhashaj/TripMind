"""
SQLAlchemy ORM models for PostgreSQL with PostGIS.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


def _uuid() -> str:
    return str(uuid.uuid4())


# ============================================================
# Users
# ============================================================

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    trips: Mapped[list[Trip]] = relationship("Trip", back_populates="user")


# ============================================================
# Trips
# ============================================================

class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True, index=True)
    title: Mapped[str | None] = mapped_column(String(255))
    planning_status: Mapped[str] = mapped_column(String(50), default="idle")
    trip_state: Mapped[dict] = mapped_column(JSONB, default=dict)  # Full TripState snapshot
    original_query: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    user: Mapped[User | None] = relationship("User", back_populates="trips")
    events: Mapped[list[TripEventRecord]] = relationship("TripEventRecord", back_populates="trip")
    agent_runs: Mapped[list[AgentRun]] = relationship("AgentRun", back_populates="trip")
    verification_results: Mapped[list[VerificationResultRecord]] = relationship("VerificationResultRecord", back_populates="trip")

    __table_args__ = (
        Index("ix_trips_user_status", "user_id", "planning_status"),
    )


# ============================================================
# Destinations
# ============================================================

class Destination(Base):
    __tablename__ = "destinations"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    trip_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("trips.id"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    country: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(Text)
    estimated_cost_min: Mapped[float | None] = mapped_column(Float)
    estimated_cost_max: Mapped[float | None] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    recommended_duration_days: Mapped[int | None] = mapped_column(Integer)
    highlights: Mapped[list] = mapped_column(JSONB, default=list)
    best_for: Mapped[list] = mapped_column(JSONB, default=list)
    why_it_matches: Mapped[str | None] = mapped_column(Text)
    match_score: Mapped[float] = mapped_column(Float, default=0.0)
    is_selected: Mapped[bool] = mapped_column(Boolean, default=False)
    location: Mapped[object | None] = mapped_column(Geometry("POINT", srid=4326))
    sources: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_destinations_trip_selected", "trip_id", "is_selected"),
    )


# ============================================================
# Transport Options
# ============================================================

class TransportOption(Base):
    __tablename__ = "transport_options"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    trip_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("trips.id"), index=True)
    mode: Mapped[str] = mapped_column(String(50))  # flight, train, bus, car
    transport_type: Mapped[str] = mapped_column(String(20), default="intercity")  # intercity, local
    provider: Mapped[str | None] = mapped_column(String(100))
    carrier: Mapped[str | None] = mapped_column(String(100))
    origin: Mapped[str] = mapped_column(String(255))
    destination: Mapped[str] = mapped_column(String(255))
    departure_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    arrival_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    stops: Mapped[int] = mapped_column(Integer, default=0)
    price: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    price_label: Mapped[str | None] = mapped_column(String(50))
    is_selected: Mapped[bool] = mapped_column(Boolean, default=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    source: Mapped[str | None] = mapped_column(Text)
    booking_url: Mapped[str | None] = mapped_column(Text)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    extra_data: Mapped[dict] = mapped_column(JSONB, default=dict)


# ============================================================
# Hotel Options
# ============================================================

class HotelOption(Base):
    __tablename__ = "hotel_options"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    trip_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("trips.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str | None] = mapped_column(String(50))
    rating: Mapped[float | None] = mapped_column(Float)
    review_count: Mapped[int | None] = mapped_column(Integer)
    location: Mapped[str | None] = mapped_column(String(255))
    price_per_night: Mapped[float] = mapped_column(Float)
    total_price: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    nights: Mapped[int] = mapped_column(Integer, default=1)
    amenities: Mapped[list] = mapped_column(JSONB, default=list)
    distance_from_center_km: Mapped[float | None] = mapped_column(Float)
    image_url: Mapped[str | None] = mapped_column(Text)
    breakfast_included: Mapped[bool] = mapped_column(Boolean, default=False)
    free_cancellation: Mapped[bool] = mapped_column(Boolean, default=False)
    is_selected: Mapped[bool] = mapped_column(Boolean, default=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    source: Mapped[str | None] = mapped_column(Text)
    booking_url: Mapped[str | None] = mapped_column(Text)
    geo_location: Mapped[object | None] = mapped_column(Geometry("POINT", srid=4326))
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ============================================================
# Activities
# ============================================================

class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    trip_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("trips.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    activity_type: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(255))
    rating: Mapped[float | None] = mapped_column(Float)
    duration_hours: Mapped[float | None] = mapped_column(Float)
    price_per_person: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    opening_hours: Mapped[str | None] = mapped_column(String(255))
    distance_from_hotel_km: Mapped[float | None] = mapped_column(Float)
    image_url: Mapped[str | None] = mapped_column(Text)
    is_selected: Mapped[bool] = mapped_column(Boolean, default=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    source: Mapped[str | None] = mapped_column(Text)
    booking_url: Mapped[str | None] = mapped_column(Text)
    geo_location: Mapped[object | None] = mapped_column(Geometry("POINT", srid=4326))
    tags: Mapped[list] = mapped_column(JSONB, default=list)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ============================================================
# Restaurants
# ============================================================

class Restaurant(Base):
    __tablename__ = "restaurants"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    trip_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("trips.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    cuisine: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(255))
    rating: Mapped[float | None] = mapped_column(Float)
    price_range: Mapped[str | None] = mapped_column(String(20))  # budget, mid, upscale
    avg_cost_per_person: Mapped[float | None] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    image_url: Mapped[str | None] = mapped_column(Text)
    geo_location: Mapped[object | None] = mapped_column(Geometry("POINT", srid=4326))
    source: Mapped[str | None] = mapped_column(Text)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ============================================================
# Itinerary
# ============================================================

class ItineraryDay(Base):
    __tablename__ = "itinerary_days"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    trip_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("trips.id"), index=True)
    day_number: Mapped[int] = mapped_column(Integer)
    date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    title: Mapped[str | None] = mapped_column(String(255))
    location: Mapped[str | None] = mapped_column(String(255))
    total_cost: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list[ItineraryItem]] = relationship("ItineraryItem", back_populates="day", order_by="ItineraryItem.sort_order")


class ItineraryItem(Base):
    __tablename__ = "itinerary_items"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    day_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("itinerary_days.id"), index=True)
    trip_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("trips.id"), index=True)
    item_type: Mapped[str] = mapped_column(String(50))
    time: Mapped[str | None] = mapped_column(String(10))  # HH:MM
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(255))
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    estimated_cost: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    activity_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True)
    transport_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True)
    is_flexible: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    geo_location: Mapped[object | None] = mapped_column(Geometry("POINT", srid=4326))

    day: Mapped[ItineraryDay] = relationship("ItineraryDay", back_populates="items")


# ============================================================
# Budget
# ============================================================

class BudgetBreakdownRecord(Base):
    __tablename__ = "budget_breakdowns"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    trip_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("trips.id"), index=True, unique=True)
    intercity_transport: Mapped[float] = mapped_column(Float, default=0.0)
    local_transport: Mapped[float] = mapped_column(Float, default=0.0)
    accommodation: Mapped[float] = mapped_column(Float, default=0.0)
    food: Mapped[float] = mapped_column(Float, default=0.0)
    activities: Mapped[float] = mapped_column(Float, default=0.0)
    miscellaneous: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    line_items: Mapped[list] = mapped_column(JSONB, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ============================================================
# Sources
# ============================================================

class Source(Base):
    __tablename__ = "sources"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    trip_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("trips.id"), index=True)
    title: Mapped[str] = mapped_column(String(500))
    provider: Mapped[str] = mapped_column(String(100))
    url: Mapped[str | None] = mapped_column(Text)
    data_category: Mapped[str] = mapped_column(String(50))
    is_live: Mapped[bool] = mapped_column(Boolean, default=False)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ============================================================
# Agent Runs (Observability)
# ============================================================

class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    trip_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("trips.id"), index=True)
    run_id: Mapped[str] = mapped_column(UUID(as_uuid=False), index=True)
    agent_name: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(50))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    items_found: Mapped[int | None] = mapped_column(Integer)
    token_usage: Mapped[dict] = mapped_column(JSONB, default=dict)
    error: Mapped[str | None] = mapped_column(Text)

    trip: Mapped[Trip] = relationship("Trip", back_populates="agent_runs")


# ============================================================
# Tool Calls (Observability)
# ============================================================

class ToolCall(Base):
    __tablename__ = "tool_calls"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    trip_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("trips.id"), index=True)
    run_id: Mapped[str] = mapped_column(UUID(as_uuid=False), index=True)
    agent_name: Mapped[str] = mapped_column(String(100))
    tool_name: Mapped[str] = mapped_column(String(100))
    provider: Mapped[str | None] = mapped_column(String(100))
    input_data: Mapped[dict] = mapped_column(JSONB, default=dict)
    output_data: Mapped[dict] = mapped_column(JSONB, default=dict)
    status: Mapped[str] = mapped_column(String(50))
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ============================================================
# Trip Events (Full audit log)
# ============================================================

class TripEventRecord(Base):
    __tablename__ = "trip_events"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    trip_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("trips.id"), index=True)
    run_id: Mapped[str] = mapped_column(UUID(as_uuid=False), index=True)
    event_type: Mapped[str] = mapped_column(String(100))
    agent: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str | None] = mapped_column(String(50))
    message: Mapped[str] = mapped_column(Text)
    data: Mapped[dict] = mapped_column(JSONB, default=dict)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    trip: Mapped[Trip] = relationship("Trip", back_populates="events")

    __table_args__ = (
        Index("ix_trip_events_trip_timestamp", "trip_id", "timestamp"),
    )


# ============================================================
# Verification Results
# ============================================================

class VerificationResultRecord(Base):
    __tablename__ = "verification_results"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    trip_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("trips.id"), index=True)
    run_id: Mapped[str] = mapped_column(UUID(as_uuid=False))
    overall_status: Mapped[str] = mapped_column(String(50))
    checks: Mapped[list] = mapped_column(JSONB, default=list)
    issues_found: Mapped[int] = mapped_column(Integer, default=0)
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    trip: Mapped[Trip] = relationship("Trip", back_populates="verification_results")
