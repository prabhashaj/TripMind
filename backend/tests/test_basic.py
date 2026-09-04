"""
Basic smoke tests for the AI Travel Agent backend.
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.models.trip_state import TripState, TripPreferences, TravelerInfo, DateRange


@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "providers" in data


@pytest.mark.asyncio
async def test_start_planning():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/trips/plan",
            json={"query": "Plan a 5-day trip from Hyderabad to Goa for 2 people under ₹40,000"},
        )
    assert response.status_code == 200
    data = response.json()
    assert "trip_id" in data
    assert data["status"] == "planning_started"


@pytest.mark.asyncio
async def test_get_nonexistent_trip():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/trips/nonexistent-id")
    assert response.status_code == 404


def test_trip_state_budget_calculation():
    """TripState budget totals should be computed correctly."""
    from app.models.trip_state import BudgetBreakdown
    budget = BudgetBreakdown(
        intercity_transport=10000.0,
        local_transport=3000.0,
        accommodation=15000.0,
        food=7000.0,
        activities=5000.0,
        miscellaneous=2000.0,
        currency="INR",
    )
    assert budget.total == 42000.0
    assert budget.estimated_range_min < budget.total
    assert budget.estimated_range_max > budget.total


def test_trip_state_traveler_total():
    travelers = TravelerInfo(adults=2, children=1, infants=0)
    assert travelers.total == 3


def test_trip_state_source_deduplication():
    """add_source should not add duplicate URLs."""
    from app.models.trip_state import DataSource
    import datetime
    state = TripState(original_query="test")

    src = DataSource(
        title="Test Source",
        provider="Tavily",
        url="https://example.com/travel",
        data_category="destinations",
        retrieved_at=datetime.datetime.utcnow(),
    )
    state.add_source(src)
    state.add_source(src)  # duplicate
    assert len(state.sources) == 1


def test_verification_passed_status():
    from app.models.trip_state import VerificationResult, VerificationStatus, VerificationCheck
    result = VerificationResult(
        overall_status=VerificationStatus.PASSED,
        checks=[
            VerificationCheck(
                check_name="itinerary_exists",
                status=VerificationStatus.PASSED,
                message="OK",
            )
        ],
        issues_found=0,
    )
    assert result.passed is True


def test_verification_failed_status():
    from app.models.trip_state import VerificationResult, VerificationStatus, VerificationCheck
    result = VerificationResult(
        overall_status=VerificationStatus.FAILED,
        checks=[
            VerificationCheck(
                check_name="budget_feasibility",
                status=VerificationStatus.FAILED,
                message="Over budget",
            )
        ],
        issues_found=1,
    )
    assert result.passed is False
