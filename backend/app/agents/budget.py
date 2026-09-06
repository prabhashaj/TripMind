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


from app.services.currency import currency_service
from datetime import datetime, timezone

CURRENCY_SYMBOLS = {
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
    "INR": "₹",
    "JPY": "¥",
    "AUD": "A$",
    "CAD": "C$",
}

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
        budget_currency = state.budget_currency or state.preferences.currency or "INR"
        currency = budget_currency.upper()
        symbol = CURRENCY_SYMBOLS.get(currency, f"{currency} ")
        travelers = state.travelers
        duration = state.dates.duration_days or 5
        line_items: list[BudgetLineItem] = []

        # Ensure we have the base FX rate for reporting
        base_rate = await currency_service.get_rate("INR", currency)
        fx_rate_ts = currency_service._cache_time or datetime.now(timezone.utc)

        # --- Intercity Transport ---
        transport_cost = 0.0
        selected_transport = None
        for leg in state.transport.intercity:
            if leg.id == state.transport.selected_intercity_id:
                selected_transport = leg
                break
        
        if selected_transport:
            # Convert leg.price from leg.currency to budget currency
            transport_cost = await currency_service.convert(selected_transport.price, selected_transport.currency, currency)
        elif state.transport.intercity:
            # Pick lowest price after converting all to budget currency
            prices = [
                await currency_service.convert(leg.price, leg.currency, currency)
                for leg in state.transport.intercity
            ]
            transport_cost = min(prices)

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
            hotel_cost = await currency_service.convert(selected_hotel.total_price, selected_hotel.currency, currency)
        elif state.hotels.options:
            prices = [
                await currency_service.convert(h.total_price, h.currency, currency)
                for h in state.hotels.options
            ]
            hotel_cost = min(prices)

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
                converted_price = await currency_service.convert(activity.price_per_person, activity.currency, currency)
                activity_cost += converted_price * travelers.total
                
        if not state.selected_activity_ids and state.activities:
            # Estimate from available activities
            paid = [a for a in state.activities if a.price_per_person > 0]
            if paid:
                prices = [
                    await currency_service.convert(a.price_per_person, a.currency, currency)
                    for a in paid[:8]
                ]
                avg = sum(prices) / len(prices)
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
        # Base INR estimate: ₹500-800/person/day
        food_per_person_per_day_inr = 650.0
        if state.preferences.accommodation_type.value in ("luxury", "resort"):
            food_per_person_per_day_inr = 1200.0
        elif state.preferences.accommodation_type.value in ("budget", "hostel"):
            food_per_person_per_day_inr = 400.0

        food_per_person_per_day = await currency_service.convert(food_per_person_per_day_inr, "INR", currency)
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
        local_transport_inr = 300.0
        local_transport_per_person = await currency_service.convert(local_transport_inr, "INR", currency)
        local_transport_cost = local_transport_per_person * travelers.total * duration
        
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
            fx_rate_used=base_rate,
            fx_rate_timestamp=fx_rate_ts,
        )

        state.budget = budget
        state.touch()

        # Check against user budget
        if state.budget_amount and budget.total > state.budget_amount:
            overage = budget.total - state.budget_amount
            msg = (
                f"Estimated cost is {symbol}{budget.total:,.0f} — "
                f"{symbol}{overage:,.0f} over your {symbol}{state.budget_amount:,.0f} budget. "
                "Try asking to optimize costs."
            )
        else:
            msg = (
                f"Trip estimated at {symbol}{budget.total:,.0f} "
                f"(range: {symbol}{budget.estimated_range_min:,.0f}–{symbol}{budget.estimated_range_max:,.0f})"
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
