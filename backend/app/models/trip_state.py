"""
Canonical TripState — the single source of truth for all trip data.
The LLM conversation is a control layer; TripState is the data layer.
"""
from __future__ import annotations

import uuid
import datetime as dt
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field, computed_field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ============================================================
# Enums
# ============================================================

class PlanningStatus(str, Enum):
    IDLE = "idle"
    AWAITING_PREFERENCE_ANSWERS = "awaiting_preference_answers"
    EXTRACTING_PREFERENCES = "extracting_preferences"
    RESEARCHING_DESTINATIONS = "researching_destinations"
    AWAITING_DESTINATION_SELECTION = "awaiting_destination_selection"
    RESEARCHING_TRANSPORT = "researching_transport"
    RESEARCHING_HOTELS = "researching_hotels"
    RESEARCHING_ACTIVITIES = "researching_activities"
    BUILDING_ITINERARY = "building_itinerary"
    CALCULATING_BUDGET = "calculating_budget"
    VERIFYING = "verifying"
    REPLANNING = "replanning"
    COMPLETE = "complete"
    FAILED = "failed"


class TravelPace(str, Enum):
    RELAXED = "relaxed"
    MODERATE = "moderate"
    PACKED = "packed"


class AccommodationType(str, Enum):
    BUDGET = "budget"
    MID_RANGE = "mid_range"
    LUXURY = "luxury"
    HOSTEL = "hostel"
    HOMESTAY = "homestay"
    RESORT = "resort"
    ANY = "any"


class TransportMode(str, Enum):
    FLIGHT = "flight"
    TRAIN = "train"
    BUS = "bus"
    CAR = "car"
    ANY = "any"


class VerificationStatus(str, Enum):
    PASSED = "passed"
    FAILED = "failed"
    WARNING = "warning"
    SKIPPED = "skipped"


# ============================================================
# Supporting Models
# ============================================================




class TravelerInfo(BaseModel):
    adults: int = 1
    children: int = 0
    infants: int = 0

    @property
    def total(self) -> int:
        return self.adults + self.children + self.infants


class DateRange(BaseModel):
    start: dt.date | None = None
    end: dt.date | None = None
    flexible: bool = False
    duration_days: int | None = None


class TripPreferences(BaseModel):
    interests: list[str] = Field(default_factory=list)
    pace: TravelPace = TravelPace.MODERATE
    accommodation_type: AccommodationType = AccommodationType.ANY
    preferred_transport: TransportMode = TransportMode.ANY
    dietary_requirements: list[str] = Field(default_factory=list)
    avoid: list[str] = Field(default_factory=list)
    wake_time_earliest: str | None = None  # e.g., "09:00"
    sleep_time_latest: str | None = None   # e.g., "23:00"
    requires_accessibility: bool = False
    language_preference: str = "en"
    currency: str | None = None
    raw_constraints: list[str] = Field(default_factory=list)


# ============================================================
# Destination
# ============================================================

class DestinationCandidate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    country: str
    state: str | None = None
    description: str
    image_url: str | None = None
    estimated_cost_min: float
    estimated_cost_max: float
    currency: str = "INR"
    recommended_duration_days: int
    highlights: list[str] = Field(default_factory=list)
    best_for: list[str] = Field(default_factory=list)
    travel_time_hours: float | None = None
    why_it_matches: str
    match_score: float = 0.0  # 0–1
    latitude: float | None = None
    longitude: float | None = None
    sources: list[str] = Field(default_factory=list)
    provenance: Literal["verified", "estimated"] = "estimated"


# ============================================================
# Transport
# ============================================================

class TransportLeg(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mode: TransportMode
    provider: str
    carrier: str | None = None
    origin: str
    destination: str
    departure_time: datetime | None = None
    arrival_time: datetime | None = None
    duration_minutes: int | None = None
    stops: int = 0
    price: float
    currency: str = "INR"
    price_label: str | None = None  # e.g., "Best value", "Cheapest"
    source: str | None = None
    retrieved_at: datetime = Field(default_factory=utc_now)
    is_available: bool = True
    booking_url: str | None = None
    notes: str | None = None
    provenance: Literal["verified", "estimated"] = "estimated"


class TransportOptions(BaseModel):
    intercity: list[TransportLeg] = Field(default_factory=list)
    local: list[TransportLeg] = Field(default_factory=list)
    selected_intercity_id: str | None = None
    selected_local_ids: list[str] = Field(default_factory=list)
    provider_available: bool = True
    last_searched: datetime | None = None


# ============================================================
# Hotel
# ============================================================

class HotelOption(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    category: AccommodationType = AccommodationType.ANY
    rating: float | None = None
    review_count: int | None = None
    location: str
    latitude: float | None = None
    longitude: float | None = None
    price_per_night: float
    total_price: float
    currency: str = "INR"
    nights: int
    amenities: list[str] = Field(default_factory=list)
    distance_from_center_km: float | None = None
    image_url: str | None = None
    breakfast_included: bool = False
    free_cancellation: bool = False
    source: str | None = None
    retrieved_at: datetime = Field(default_factory=utc_now)
    booking_url: str | None = None
    is_available: bool = True
    provenance: Literal["verified", "estimated"] = "estimated"
    fit_reason: str | None = None


class HotelOptions(BaseModel):
    options: list[HotelOption] = Field(default_factory=list)
    selected_id: str | None = None
    provider_available: bool = True
    last_searched: datetime | None = None


# ============================================================
# Activity
# ============================================================

class ActivityItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str  # attraction, experience, tour, museum, adventure, food, event
    description: str
    location: str
    latitude: float | None = None
    longitude: float | None = None
    rating: float | None = None
    duration_hours: float | None = None
    price_per_person: float = 0.0
    currency: str = "INR"
    opening_hours: str | None = None
    distance_from_hotel_km: float | None = None
    image_url: str | None = None
    source: str | None = None
    retrieved_at: datetime = Field(default_factory=utc_now)
    booking_url: str | None = None
    tags: list[str] = Field(default_factory=list)
    is_available: bool = True
    provenance: Literal["verified", "estimated"] = "estimated"


# ============================================================
# Itinerary
# ============================================================

class ItineraryItemType(str, Enum):
    TRANSPORT = "transport"
    CHECK_IN = "check_in"
    CHECK_OUT = "check_out"
    ACTIVITY = "activity"
    MEAL = "meal"
    REST = "rest"
    FREE_TIME = "free_time"
    TRANSFER = "transfer"


class ItineraryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: ItineraryItemType
    time: str  # "HH:MM"
    title: str
    description: str | None = None
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    duration_minutes: int | None = None
    estimated_cost: float = 0.0
    currency: str = "INR"
    activity_id: str | None = None
    transport_id: str | None = None
    hotel_id: str | None = None
    notes: str | None = None
    is_flexible: bool = True


class ItineraryDay(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    day_number: int
    date: dt.date | None = None
    title: str
    location: str
    items: list[ItineraryItem] = Field(default_factory=list)
    total_cost: float = 0.0
    notes: str | None = None


class Itinerary(BaseModel):
    days: list[ItineraryDay] = Field(default_factory=list)
    total_duration_days: int = 0
    created_at: datetime = Field(default_factory=utc_now)
    last_modified: datetime = Field(default_factory=utc_now)


# ============================================================
# Budget
# ============================================================

class BudgetLineItem(BaseModel):
    category: str
    label: str
    amount: float
    currency: str = "INR"
    is_estimated: bool = True
    per_person: bool = False


class BudgetBreakdown(BaseModel):
    intercity_transport: float = 0.0
    local_transport: float = 0.0
    accommodation: float = 0.0
    food: float = 0.0
    activities: float = 0.0
    miscellaneous: float = 0.0
    currency: str = "INR"
    line_items: list[BudgetLineItem] = Field(default_factory=list)
    fx_rate_used: float | None = None
    fx_rate_timestamp: datetime | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def total(self) -> float:
        return (
            self.intercity_transport
            + self.local_transport
            + self.accommodation
            + self.food
            + self.activities
            + self.miscellaneous
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def estimated_range_min(self) -> float:
        return self.total * 0.9

    @computed_field  # type: ignore[prop-decorator]
    @property
    def estimated_range_max(self) -> float:
        return self.total * 1.15


# ============================================================
# Sources
# ============================================================

class DataSource(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    provider: str
    url: str | None = None
    data_category: str  # flights, hotels, activities, destinations, restaurants, weather
    retrieved_at: datetime = Field(default_factory=utc_now)
    is_live: bool = False


# ============================================================
# Verification
# ============================================================

class VerificationCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    check_name: str
    status: VerificationStatus
    message: str
    details: dict[str, Any] = Field(default_factory=dict)
    affected_items: list[str] = Field(default_factory=list)


class VerificationResult(BaseModel):
    overall_status: VerificationStatus = VerificationStatus.SKIPPED
    checks: list[VerificationCheck] = Field(default_factory=list)
    issues_found: int = 0
    verified_at: datetime | None = None

    @property
    def passed(self) -> bool:
        return self.overall_status == VerificationStatus.PASSED


# ============================================================
# Agent Run Metadata
# ============================================================

class AgentRunRecord(BaseModel):
    agent_name: str
    status: str  # running, completed, failed, skipped
    started_at: datetime = Field(default_factory=utc_now)
    completed_at: datetime | None = None
    message: str | None = None
    error: str | None = None
    items_found: int | None = None


# ============================================================
# CANONICAL TRIP STATE
# ============================================================

class TripState(BaseModel):
    """
    The canonical source of truth for a trip.
    All agents read from and write to this state.
    The LLM conversation is the control layer only.
    """

    trip_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str | None = None

    # Raw input
    original_query: str = ""
    conversation_history: list[dict[str, str]] = Field(default_factory=list)
    pending_preference_questions: list[dict[str, Any]] = Field(default_factory=list)

    # Extracted preferences
    origin: str | None = None
    origin_latitude: float | None = None
    origin_longitude: float | None = None
    destinations_requested: list[str] = Field(default_factory=list)
    dates: DateRange = Field(default_factory=DateRange)
    travelers: TravelerInfo = Field(default_factory=TravelerInfo)
    budget_amount: float | None = None
    budget_currency: str | None = None
    preferences: TripPreferences = Field(default_factory=TripPreferences)

    # Planning results
    candidate_destinations: list[DestinationCandidate] = Field(default_factory=list)
    selected_destination: DestinationCandidate | None = None

    transport: TransportOptions = Field(default_factory=TransportOptions)
    hotels: HotelOptions = Field(default_factory=HotelOptions)
    activities: list[ActivityItem] = Field(default_factory=list)
    selected_activity_ids: list[str] = Field(default_factory=list)

    itinerary: Itinerary = Field(default_factory=Itinerary)
    budget: BudgetBreakdown = Field(default_factory=BudgetBreakdown)
    verification: VerificationResult = Field(default_factory=VerificationResult)
    sources: list[DataSource] = Field(default_factory=list)

    # Workflow control
    planning_status: PlanningStatus = PlanningStatus.IDLE
    agent_runs: list[AgentRunRecord] = Field(default_factory=list)
    replan_triggers: list[str] = Field(default_factory=list)  # which agents to re-run

    # Metadata
    created_at: datetime = Field(default_factory=utc_now)
    last_modified: datetime = Field(default_factory=utc_now)
    planning_run_id: str = Field(default_factory=lambda: str(uuid.uuid4()))

    def touch(self) -> None:
        self.last_modified = utc_now()

    def add_source(self, source: DataSource) -> None:
        # Avoid duplicates by URL
        existing_urls = {s.url for s in self.sources if s.url}
        if source.url not in existing_urls:
            self.sources.append(source)

    def get_agent_run(self, agent_name: str) -> AgentRunRecord | None:
        for run in reversed(self.agent_runs):
            if run.agent_name == agent_name:
                return run
        return None
