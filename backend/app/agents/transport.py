"""
Transport Agent.
Searches intercity and local transport options using provider abstraction.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from app.core.logging import get_logger
from app.models.events import AgentName, AgentStatus, EventType, TripEvent
from app.models.trip_state import TransportLeg, TransportMode, TransportOptions, TripState
from app.providers.base import FlightProvider, SearchProvider, TrainProvider
from app.services.event_bus import publish_event

logger = get_logger(__name__)


async def run_transport_agent(
    state: TripState,
    flight_provider: FlightProvider,
    train_provider: TrainProvider,
    search: SearchProvider,
) -> TripState:
    """Search intercity transport options for the selected destination."""

    if not state.selected_destination and not state.destinations_requested:
        return state

    agent_name = AgentName.TRANSPORT
    destination = (
        state.selected_destination.name
        if state.selected_destination
        else state.destinations_requested[0]
    )
    origin = state.origin or "Hyderabad"

    await publish_event(TripEvent(
        trip_id=state.trip_id,
        run_id=state.planning_run_id,
        type=EventType.AGENT_STARTED,
        agent=agent_name,
        status=AgentStatus.RUNNING,
        message=f"Comparing flights, trains and other transport from {origin} to {destination}",
    ))

    from datetime import date, timedelta
    departure_date = (
        state.dates.start.isoformat()
        if state.dates.start
        else (date.today() + timedelta(days=30)).isoformat()
    )

    intercity_legs: list[TransportLeg] = []

    # Search flights and trains in parallel
    await publish_event(TripEvent(
        trip_id=state.trip_id,
        run_id=state.planning_run_id,
        type=EventType.SEARCH_STARTED,
        agent=agent_name,
        status=AgentStatus.RUNNING,
        message="Searching flight and train options simultaneously",
    ))

    CITY_TO_COUNTRY = {
        "delhi": "india", "mumbai": "india", "bangalore": "india", 
        "chennai": "india", "hyderabad": "india", "kolkata": "india",
        "london": "uk", "new york": "usa", "paris": "france", "tokyo": "japan",
        "dubai": "uae", "singapore": "singapore", "sydney": "australia", 
        "toronto": "canada", "melbourne": "australia"
    }
    
    o_c = CITY_TO_COUNTRY.get(origin.lower().strip())
    d_c = CITY_TO_COUNTRY.get(destination.lower().strip())
    is_domestic = o_c and d_c and o_c == d_c

    flight_task = flight_provider.search_flights(
        origin=origin,
        destination=destination,
        departure_date=departure_date,
        adults=state.travelers.adults,
        currency=state.budget_currency or "INR",
    )
    
    if is_domestic:
        train_task = train_provider.search_trains(
            origin=origin,
            destination=destination,
            departure_date=departure_date,
            passengers=state.travelers.total,
            currency=state.budget_currency or "INR",
        )
        flight_results, train_results = await asyncio.gather(
            flight_task, train_task, return_exceptions=True
        )
    else:
        flight_results = await flight_task
        train_results = []

    if isinstance(flight_results, list):
        intercity_legs.extend(flight_results)
        await publish_event(TripEvent(
            trip_id=state.trip_id,
            run_id=state.planning_run_id,
            type=EventType.SEARCH_COMPLETED,
            agent=agent_name,
            status=AgentStatus.RUNNING,
            message=f"Found {len(flight_results)} flight options",
            items_found=len(flight_results),
        ))
    else:
        logger.warning("flight_search_failed", error=str(flight_results))

    if isinstance(train_results, list):
        intercity_legs.extend(train_results)
        await publish_event(TripEvent(
            trip_id=state.trip_id,
            run_id=state.planning_run_id,
            type=EventType.SEARCH_COMPLETED,
            agent=agent_name,
            status=AgentStatus.RUNNING,
            message=f"Found {len(train_results)} train options",
            items_found=len(train_results),
        ))
    else:
        logger.warning("train_search_failed", error=str(train_results))

    # Label options by value category
    _label_options(intercity_legs)

    state.transport = TransportOptions(
        intercity=intercity_legs,
        local=[],
        provider_available=flight_provider.status.available or train_provider.status.available,
        last_searched=datetime.now(timezone.utc),
    )
    state.touch()

    await publish_event(TripEvent(
        trip_id=state.trip_id,
        run_id=state.planning_run_id,
        type=EventType.TRANSPORT_FOUND,
        agent=agent_name,
        status=AgentStatus.COMPLETED,
        message=f"Found {len(intercity_legs)} transport options",
        items_found=len(intercity_legs),
        data={"transport_options": [t.model_dump(mode="json") for t in intercity_legs]},
    ))

    return state


def _label_options(legs: list[TransportLeg]) -> None:
    """Add human-readable labels: Cheapest, Fastest, Best Value."""
    if not legs:
        return

    cheapest = min(legs, key=lambda l: l.price)
    fastest = min(legs, key=lambda l: l.duration_minutes or 99999)

    cheapest.price_label = "Cheapest"
    fastest.price_label = "Fastest"

    # Best value: cheapest per hour
    for leg in legs:
        if leg.duration_minutes and leg.duration_minutes > 0:
            leg_cost_per_hour = leg.price / (leg.duration_minutes / 60)
            cheapest_cost_per_hour = cheapest.price / ((cheapest.duration_minutes or 1) / 60)
            if leg != cheapest and leg_cost_per_hour <= cheapest_cost_per_hour * 1.3:
                if not leg.price_label:
                    leg.price_label = "Best value"
