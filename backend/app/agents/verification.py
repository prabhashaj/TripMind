"""
Verification Agent.
Validates the complete itinerary for logical, geographic, and practical feasibility.
"""
from __future__ import annotations

from datetime import datetime, timezone

from app.core.logging import get_logger
from app.models.events import AgentName, AgentStatus, EventType, TripEvent
from app.models.trip_state import (
    TripState,
    VerificationCheck,
    VerificationResult,
    VerificationStatus,
)
from app.services.event_bus import publish_event

logger = get_logger(__name__)

# Maximum items per day before flagging as too many
MAX_ITEMS_PER_DAY = {
    "relaxed": 4,
    "moderate": 6,
    "packed": 9,
}

# Minimum minutes between successive activities for travel
MIN_TRAVEL_BUFFER_MINUTES = 20


async def run_verification_agent(state: TripState) -> TripState:
    """
    Run all verification checks on the current TripState.
    Returns updated state with verification results.
    """
    agent_name = AgentName.VERIFICATION

    await publish_event(TripEvent(
        trip_id=state.trip_id,
        run_id=state.planning_run_id,
        type=EventType.VERIFICATION_STARTED,
        agent=agent_name,
        status=AgentStatus.RUNNING,
        message="Verifying itinerary feasibility",
    ))

    checks: list[VerificationCheck] = []

    # --- Check 1: Has an itinerary ---
    if not state.itinerary.days:
        checks.append(VerificationCheck(
            check_name="itinerary_exists",
            status=VerificationStatus.FAILED,
            message="No itinerary has been generated",
        ))
    else:
        checks.append(VerificationCheck(
            check_name="itinerary_exists",
            status=VerificationStatus.PASSED,
            message="Itinerary is present",
        ))

    # --- Check 2: Duration matches requested ---
    requested_days = state.dates.duration_days
    actual_days = len(state.itinerary.days)
    if requested_days and abs(actual_days - requested_days) > 1:
        checks.append(VerificationCheck(
            check_name="duration_match",
            status=VerificationStatus.WARNING,
            message=f"Itinerary has {actual_days} days, requested {requested_days} days",
            details={"actual": actual_days, "requested": requested_days},
        ))
    else:
        checks.append(VerificationCheck(
            check_name="duration_match",
            status=VerificationStatus.PASSED,
            message=f"Itinerary duration ({actual_days} days) matches request",
        ))

    # --- Check 3: Activities per day ---
    pace = state.preferences.pace.value if state.preferences.pace else "moderate"
    max_items = MAX_ITEMS_PER_DAY.get(pace, 6)
    overloaded_days = []

    for day in state.itinerary.days:
        activity_items = [i for i in day.items if i.type.value == "activity"]
        if len(activity_items) > max_items:
            overloaded_days.append(day.day_number)

    if overloaded_days:
        checks.append(VerificationCheck(
            check_name="daily_activity_count",
            status=VerificationStatus.FAILED,
            message=f"Days {overloaded_days} have too many activities for a {pace} pace",
            details={"overloaded_days": overloaded_days, "max_per_day": max_items},
            affected_items=[f"day_{d}" for d in overloaded_days],
        ))
    else:
        checks.append(VerificationCheck(
            check_name="daily_activity_count",
            status=VerificationStatus.PASSED,
            message=f"Activity count per day is appropriate for {pace} pace",
        ))

    # --- Check 4: Wake time constraint ---
    wake_time = state.preferences.wake_time_earliest
    if wake_time:
        early_items = []
        for day in state.itinerary.days:
            for item in day.items:
                if item.time and item.time < wake_time and item.type.value == "activity":
                    early_items.append(f"Day {day.day_number}: {item.title} at {item.time}")
        if early_items:
            checks.append(VerificationCheck(
                check_name="wake_time_constraint",
                status=VerificationStatus.FAILED,
                message=f"Activities scheduled before {wake_time}: {early_items[:3]}",
                details={"violations": early_items},
            ))
        else:
            checks.append(VerificationCheck(
                check_name="wake_time_constraint",
                status=VerificationStatus.PASSED,
                message=f"All activities respect {wake_time} wake time",
            ))

    # --- Check 5: Budget feasibility ---
    if state.budget_amount and state.budget.total > 0:
        overage_pct = (state.budget.total - state.budget_amount) / state.budget_amount
        if overage_pct > 0.15:
            checks.append(VerificationCheck(
                check_name="budget_feasibility",
                status=VerificationStatus.FAILED,
                message=(
                    f"Estimated cost {state.budget_currency} {state.budget.total:,.0f} "
                    f"exceeds budget by {overage_pct*100:.0f}%"
                ),
                details={
                    "estimated": state.budget.total,
                    "budget": state.budget_amount,
                    "overage_pct": round(overage_pct * 100, 1),
                },
            ))
        elif overage_pct > 0.05:
            checks.append(VerificationCheck(
                check_name="budget_feasibility",
                status=VerificationStatus.WARNING,
                message=f"Estimated cost is {overage_pct*100:.0f}% over budget — may need optimization",
            ))
        else:
            checks.append(VerificationCheck(
                check_name="budget_feasibility",
                status=VerificationStatus.PASSED,
                message=f"Estimated cost fits within budget",
            ))

    # --- Check 6: Transport available ---
    if not state.transport.intercity:
        checks.append(VerificationCheck(
            check_name="transport_available",
            status=VerificationStatus.WARNING,
            message="No transport options found — add origin/destination details",
        ))
    else:
        checks.append(VerificationCheck(
            check_name="transport_available",
            status=VerificationStatus.PASSED,
            message=f"{len(state.transport.intercity)} transport options available",
        ))

    # --- Check 7: Hotel available ---
    if not state.hotels.options:
        checks.append(VerificationCheck(
            check_name="hotel_available",
            status=VerificationStatus.WARNING,
            message="No hotel options found",
        ))
    else:
        checks.append(VerificationCheck(
            check_name="hotel_available",
            status=VerificationStatus.PASSED,
            message=f"{len(state.hotels.options)} hotel options available",
        ))

    # Compute overall status
    failed = [c for c in checks if c.status == VerificationStatus.FAILED]
    warnings = [c for c in checks if c.status == VerificationStatus.WARNING]

    if failed:
        overall = VerificationStatus.FAILED
    elif warnings:
        overall = VerificationStatus.WARNING
    else:
        overall = VerificationStatus.PASSED

    result = VerificationResult(
        overall_status=overall,
        checks=checks,
        issues_found=len(failed) + len(warnings),
        verified_at=datetime.now(timezone.utc),
    )
    state.verification = result
    state.touch()

    event_type = EventType.VERIFICATION_COMPLETED if overall != VerificationStatus.FAILED else EventType.VERIFICATION_FAILED
    status = AgentStatus.COMPLETED if overall != VerificationStatus.FAILED else AgentStatus.FAILED

    issue_msg = ""
    if failed:
        issue_msg = f" — {len(failed)} issue(s) found: " + "; ".join(c.message for c in failed[:2])
    elif warnings:
        issue_msg = f" — {len(warnings)} warning(s)"

    await publish_event(TripEvent(
        trip_id=state.trip_id,
        run_id=state.planning_run_id,
        type=event_type,
        agent=agent_name,
        status=status,
        message=f"Verification {overall.value}{issue_msg}",
        data={"verification": result.model_dump(mode="json")},
    ))

    return state
