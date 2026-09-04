"""
Budget Agent.
Calculates detailed trip cost breakdown from TripState.
"""
from __future__ import annotations

from app.core.logging import get_logger
from app.models.events import AgentName, AgentStatus, EventType, TripEvent
from app.models.trip_state import BudgetBreakdown, BudgetLineItem, TripState
from app.services.event_bus import publish_event

logger = get_logger(__name__)


async def run_budget_agent(state: TripState) -> TripState:
    """Calculate the full trip budget breakdown from current TripState."""

    agent_name = AgentName.BUDGET

    await publish_event(TripEvent(
        trip_id=state.trip_id,
        run_id=state.planning_run_id,
        type=EventType.AGENT_STARTED,
        agent=agent_name,
        status=AgentStatus.RUNNING,
        message="Calculating trip costs",
    ))

    try:
        currency = state.budget_currency
        travelers = state.travelers
        duration = state.dates.duration_days or 5
        line_items: list[BudgetLineItem] = []

        # --- Intercity Transport ---
        transport_cost = 0.0
        selected_transport = None
        for leg in state.transport.intercity:
            if leg.id == state.transport.selected_intercity_id:
                selected_transport = leg
                break
        if selected_transport:
            transport_cost = selected_transport.price
        elif state.transport.intercity:
            transport_cost = min(leg.price for leg in state.transport.intercity)

        if transport_cost > 0:
            line_items.append(BudgetLineItem(
                category="transport",
                label=f"Intercity transport ({travelers.adults} adults)",
                amount=transport_cost,
                currency=currency,
                is_estimated=not bool(selected_transport),
            ))

        # --- Accommodation ---
        hotel_cost = 0.0
        selected_hotel = None
        for h in state.hotels.options:
            if h.id == state.hotels.selected_id:
                selected_hotel = h
                break
        if selected_hotel:
            hotel_cost = selected_hotel.total_price
        elif state.hotels.options:
            hotel_cost = min(h.total_price for h in state.hotels.options)

        if hotel_cost > 0:
            line_items.append(BudgetLineItem(
                category="accommodation",
                label=f"Hotel ({duration} nights)",
                amount=hotel_cost,
                currency=currency,
                is_estimated=not bool(selected_hotel),
            ))

        # --- Activities ---
        activity_cost = 0.0
        for a_id in state.selected_activity_ids:
            activity = next((a for a in state.activities if a.id == a_id), None)
            if activity:
                activity_cost += activity.price_per_person * travelers.total
        if not state.selected_activity_ids and state.activities:
            # Estimate from available activities
            paid = [a for a in state.activities if a.price_per_person > 0]
            if paid:
                avg = sum(a.price_per_person for a in paid[:8]) / len(paid[:8])
                activity_cost = avg * min(4, len(paid)) * travelers.total

        if activity_cost > 0:
            line_items.append(BudgetLineItem(
                category="activities",
                label=f"Activities & experiences ({travelers.total} people)",
                amount=activity_cost,
                currency=currency,
                is_estimated=not bool(state.selected_activity_ids),
            ))

        # --- Food (estimated) ---
        # Standard INR estimate: ₹500-800/person/day
        food_per_person_per_day = 650.0
        if state.preferences.accommodation_type.value in ("luxury", "resort"):
            food_per_person_per_day = 1200.0
        elif state.preferences.accommodation_type.value in ("budget", "hostel"):
            food_per_person_per_day = 400.0

        food_cost = food_per_person_per_day * travelers.total * duration
        line_items.append(BudgetLineItem(
            category="food",
            label=f"Food & dining ({travelers.total} people, {duration} days)",
            amount=food_cost,
            currency=currency,
            is_estimated=True,
            per_person=True,
        ))

        # --- Local Transport (estimated) ---
        local_transport_cost = 300.0 * travelers.total * duration
        line_items.append(BudgetLineItem(
            category="local_transport",
            label=f"Local transport ({duration} days)",
            amount=local_transport_cost,
            currency=currency,
            is_estimated=True,
        ))

        # --- Miscellaneous (5% buffer) ---
        subtotal = transport_cost + hotel_cost + activity_cost + food_cost + local_transport_cost
        misc = subtotal * 0.05
        line_items.append(BudgetLineItem(
            category="miscellaneous",
            label="Miscellaneous & contingency (5%)",
            amount=misc,
            currency=currency,
            is_estimated=True,
        ))

        budget = BudgetBreakdown(
            intercity_transport=transport_cost,
            local_transport=local_transport_cost,
            accommodation=hotel_cost,
            food=food_cost,
            activities=activity_cost,
            miscellaneous=misc,
            currency=currency,
            line_items=line_items,
        )

        state.budget = budget
        state.touch()

        # Check against user budget
        if state.budget_amount and budget.total > state.budget_amount:
            overage = budget.total - state.budget_amount
            msg = (
                f"Estimated cost is ₹{budget.total:,.0f} — "
                f"₹{overage:,.0f} over your ₹{state.budget_amount:,.0f} budget. "
                "Try asking to optimize costs."
            )
        else:
            msg = (
                f"Trip estimated at {currency} {budget.total:,.0f} "
                f"(range: {currency} {budget.estimated_range_min:,.0f}–{budget.estimated_range_max:,.0f})"
            )

        await publish_event(TripEvent(
            trip_id=state.trip_id,
            run_id=state.planning_run_id,
            type=EventType.BUDGET_CALCULATED,
            agent=agent_name,
            status=AgentStatus.COMPLETED,
            message=msg,
            data={"budget": budget.model_dump(mode="json")},
        ))

    except Exception as exc:
        logger.error("budget_agent_failed", error=str(exc))
        await publish_event(TripEvent(
            trip_id=state.trip_id,
            run_id=state.planning_run_id,
            type=EventType.AGENT_FAILED,
            agent=agent_name,
            status=AgentStatus.FAILED,
            message="Budget calculation encountered an issue",
            data={"error": str(exc)},
        ))

    return state
