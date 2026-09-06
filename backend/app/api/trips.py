"""
FastAPI routers for trip planning.
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
import re
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.dependencies import (
    get_flight_provider,
    get_hotel_provider,
    get_llm_provider,
    get_search_provider,
    get_train_provider,
)
from app.core.logging import get_logger
from app.models.trip_state import AccommodationType, PlanningStatus, TripState
from app.providers.base import (
    FlightProvider,
    HotelProvider,
    LLMProvider,
    SearchProvider,
    TrainProvider,
)
from app.services.memory import memory_store
from app.workflows.trip_workflow import run_trip_workflow

router = APIRouter(prefix="/api/trips", tags=["trips"])
logger = get_logger(__name__)

DATA_DIR = Path(__file__).parent.parent.parent / ".data" / "trips"
DATA_DIR.mkdir(parents=True, exist_ok=True)


class PersistentTripStore:
    def __init__(self):
        self._mem: dict[str, TripState] = {}

    def get(self, trip_id: str) -> TripState | None:
        if trip_id in self._mem:
            return self._mem[trip_id]
        path = DATA_DIR / f"{trip_id}.json"
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                state = TripState(**data)
                self._mem[trip_id] = state
                return state
            except Exception as e:
                logger.warning("trip_load_from_disk_failed", trip_id=trip_id, error=str(e))
        return None

    def __getitem__(self, trip_id: str) -> TripState:
        item = self.get(trip_id)
        if item is None:
            raise KeyError(trip_id)
        return item

    def __setitem__(self, trip_id: str, state: TripState) -> None:
        self._mem[trip_id] = state
        try:
            path = DATA_DIR / f"{trip_id}.json"
            path.write_text(state.model_dump_json(indent=2), encoding="utf-8")
        except Exception as e:
            logger.warning("trip_save_to_disk_failed", trip_id=trip_id, error=str(e))

    def __contains__(self, trip_id: str) -> bool:
        return self.get(trip_id) is not None


_trip_store = PersistentTripStore()


class StartPlanningRequest(BaseModel):
    query: str
    user_id: str | None = None
    home_location: str | None = None
    home_country: str | None = None
    currency: str | None = None
    trip_duration: str | None = None
    budget: str | None = None
    destinations: list[str] | None = None
    travelers: int | str | None = None


def _missing_preflight_fields(request: StartPlanningRequest) -> list[str]:
    query = request.query.lower()
    has_duration = bool(
        request.trip_duration
        or re.search(r"\b\d+[- ]*(?:day|days|night|nights|week|weeks)\b", query)
    )
    has_budget = bool(
        request.budget
        or re.search(
            r"(?:₹|rs\.?|inr|usd|\$|€|eur)\s*[\d,]+|(?:budget of|under)\s*(?:₹|rs\.?|inr|usd|\$|€|eur)?\s*[\d,]+|no budget|without a budget|\b(budget|cheap|economical|affordable|mid.?range|moderate|comfortable|luxury|high.?end|premium|backpacker|hostel)\b",
            query,
        )
    )
    missing: list[str] = []
    if not has_duration:
        missing.append("trip_duration")
    if not has_budget:
        missing.append("budget")
    return missing


class ModifyTripRequest(BaseModel):
    modification: str


class PreferenceAnswersRequest(BaseModel):
    answers: dict[str, str]


class SelectDestinationRequest(BaseModel):
    destination_id: str


class SelectTransportRequest(BaseModel):
    transport_id: str


class SelectHotelRequest(BaseModel):
    hotel_id: str


@router.post("/plan", response_model=None)
async def start_planning(
    request: StartPlanningRequest,
    background_tasks: BackgroundTasks,
    llm: LLMProvider = Depends(get_llm_provider),
    search: SearchProvider = Depends(get_search_provider),
    flights: FlightProvider = Depends(get_flight_provider),
    trains: TrainProvider = Depends(get_train_provider),
    hotels: HotelProvider = Depends(get_hotel_provider),
) -> Any:
    """
    Start the trip planning workflow.
    Returns immediately with trip_id; planning runs in background.
    Results are streamed via SSE at /api/trips/{trip_id}/events.
    """
    missing_fields = _missing_preflight_fields(request)
    if missing_fields:
        return JSONResponse(
            status_code=422,
            content={
                "error": "missing_required_trip_details",
                "missing_fields": missing_fields,
                "message": "Please provide the required trip details before planning starts.",
            },
        )

    trip_id = str(uuid.uuid4())

    state = TripState(
        trip_id=trip_id,
        user_id=request.user_id,
        original_query=request.query,
        origin=request.home_location,
        budget_currency=request.currency,
        planning_status=PlanningStatus.IDLE,
    )
    if request.destinations:
        state.destinations_requested = request.destinations
    if request.trip_duration:
        try:
            match = re.search(r"\d+", (request.trip_duration))
            if match:
                state.dates.duration_days = int(match.group())
        except (ValueError, TypeError):
            pass
    if request.travelers:
        try:
            match = re.search(r"\d+", str(request.travelers))
            if match:
                state.travelers.adults = int(match.group())
        except (ValueError, TypeError):
            pass
    if request.budget:
        b_clean = request.budget.lower()
        if "lux" in b_clean:
            state.preferences.accommodation_type = AccommodationType.LUXURY
        elif "budget" in b_clean or "cheap" in b_clean or "hostel" in b_clean:
            state.preferences.accommodation_type = AccommodationType.BUDGET
        elif "mid" in b_clean or "med" in b_clean or "moderate" in b_clean:
            state.preferences.accommodation_type = AccommodationType.MID_RANGE
        state.preferences.raw_constraints.append(request.budget)

    state.conversation_history.append({"role": "user", "content": request.query})
    if request.user_id:
        memory_store.remember(request.user_id, request.query)
    _trip_store[trip_id] = state

    async def run_workflow() -> None:
        try:
            final_state = await run_trip_workflow(
                state=state,
                llm=llm,
                search=search,
                flight_provider=flights,
                train_provider=trains,
                hotel_provider=hotels,
            )
            _trip_store[trip_id] = final_state
        except Exception as exc:
            logger.error("workflow_error", trip_id=trip_id, error=str(exc))
            cur = _trip_store.get(trip_id)
            if cur:
                cur.planning_status = PlanningStatus.FAILED
                _trip_store[trip_id] = cur
            else:
                state.planning_status = PlanningStatus.FAILED
                _trip_store[trip_id] = state

    background_tasks.add_task(run_workflow)

    return {
        "trip_id": trip_id,
        "status": "planning_started",
        "message": "Trip planning has started. Connect to /api/trips/{trip_id}/events for live updates.",
    }


@router.get("/{trip_id}")
async def get_trip(trip_id: str) -> dict[str, Any]:
    """Get the current state of a trip."""
    state = _trip_store.get(trip_id)
    if not state:
        raise HTTPException(status_code=404, detail="Trip not found")
    return state.model_dump(mode="json")


@router.post("/{trip_id}/preference-answers")
async def answer_preferences(
    trip_id: str,
    request: PreferenceAnswersRequest,
    background_tasks: BackgroundTasks,
    llm: LLMProvider = Depends(get_llm_provider),
    search: SearchProvider = Depends(get_search_provider),
    flights: FlightProvider = Depends(get_flight_provider),
    trains: TrainProvider = Depends(get_train_provider),
    hotels: HotelProvider = Depends(get_hotel_provider),
) -> dict[str, str]:
    state = _trip_store.get(trip_id)
    if not state:
        raise HTTPException(status_code=404, detail="Trip not found")
    answer_text = "; ".join(f"{key}: {value}" for key, value in request.answers.items())
    state.original_query = f"{state.original_query}\nAdditional requirements: {answer_text}"
    state.conversation_history.append({"role": "user", "content": answer_text})
    state.pending_preference_questions = []
    state.planning_status = PlanningStatus.IDLE
    _trip_store[trip_id] = state

    async def resume_workflow() -> None:
        s = _trip_store.get(trip_id)
        if not s:
            return
        try:
            final_state = await run_trip_workflow(
                state=s,
                llm=llm,
                search=search,
                flight_provider=flights,
                train_provider=trains,
                hotel_provider=hotels,
            )
            _trip_store[trip_id] = final_state
        except Exception as exc:
            logger.error("preference_resume_failed", trip_id=trip_id, error=str(exc))
            s.planning_status = PlanningStatus.FAILED
            _trip_store[trip_id] = s

    background_tasks.add_task(resume_workflow)
    return {"status": "planning_resumed", "message": "Thanks. Continuing with your requirements."}


@router.post("/{trip_id}/select-destination")
async def select_destination(
    trip_id: str,
    request: SelectDestinationRequest,
    background_tasks: BackgroundTasks,
    llm: LLMProvider = Depends(get_llm_provider),
    search: SearchProvider = Depends(get_search_provider),
    flights: FlightProvider = Depends(get_flight_provider),
    trains: TrainProvider = Depends(get_train_provider),
    hotels: HotelProvider = Depends(get_hotel_provider),
) -> dict[str, Any]:
    """
    Select a destination from candidates and trigger transport/hotel/activity research.
    """
    state = _trip_store.get(trip_id)
    if not state:
        raise HTTPException(status_code=404, detail="Trip not found")

    dest = next(
        (d for d in state.candidate_destinations if d.id == request.destination_id),
        None,
    )
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")

    state.selected_destination = dest
    # Trigger only the affected downstream agents
    state.replan_triggers = ["transport", "hotel", "activity", "itinerary", "budget", "verification"]

    from app.agents.transport import run_transport_agent
    from app.agents.hotel import run_hotel_agent
    from app.agents.activity import run_activity_agent
    from app.agents.itinerary import run_itinerary_agent
    from app.agents.budget import run_budget_agent
    from app.agents.verification import run_verification_agent

    async def run_post_selection():
        from app.models.events import TripEvent, EventType, AgentStatus
        from app.services.event_bus import publish_event
        s = _trip_store.get(trip_id)
        if not s:
            return
        try:
            agent_tasks = [
                ("transport", run_transport_agent(s, flights, trains, search)),
                ("hotel", run_hotel_agent(s, hotels, llm, search)),
                ("activity", run_activity_agent(s, llm, search)),
            ]
            raw_results = await asyncio.gather(*(t[1] for t in agent_tasks), return_exceptions=True)
            for (name, _), r in zip(agent_tasks, raw_results):
                if isinstance(r, Exception):
                    logger.error("post_selection_agent_failed", agent=name, error=str(r))
                    await publish_event(TripEvent(
                        trip_id=s.trip_id,
                        run_id=s.planning_run_id,
                        type=EventType.AGENT_FAILED,
                        agent=name,
                        status=AgentStatus.FAILED,
                        message=f"{name.capitalize()} research encountered an issue: {str(r)[:100]}",
                        data={"error": str(r)},
                    ))
                elif isinstance(r, TripState):
                    if r.transport.intercity:
                        s.transport = r.transport
                    if r.hotels.options:
                        s.hotels = r.hotels
                    if r.activities:
                        s.activities = r.activities

            s = await run_itinerary_agent(s, llm)
            s = await run_budget_agent(s)
            s = await run_verification_agent(s)
            s.planning_status = PlanningStatus.COMPLETE
            s.touch()
            _trip_store[trip_id] = s

            await publish_event(TripEvent(
                trip_id=s.trip_id,
                run_id=s.planning_run_id,
                type=EventType.TRIP_READY,
                agent="orchestrator",
                status=AgentStatus.COMPLETED,
                message="Your complete personalized itinerary is ready",
                data={
                    "trip_id": s.trip_id,
                    "destination": s.selected_destination.name if s.selected_destination else None,
                    "trip_state": s.model_dump(mode="json"),
                },
            ))
        except Exception as exc:
            logger.error("run_post_selection_fatal", error=str(exc))
            await publish_event(TripEvent(
                trip_id=trip_id,
                run_id=getattr(s, "planning_run_id", ""),
                type=EventType.TRIP_ERROR,
                agent="orchestrator",
                status=AgentStatus.FAILED,
                message=f"Planning failed: {str(exc)}",
                data={"error": str(exc)},
            ))

    background_tasks.add_task(run_post_selection)

    return {"status": "destination_selected", "destination": dest.name}


@router.post("/{trip_id}/select-transport")
async def select_transport(trip_id: str, request: SelectTransportRequest) -> dict[str, Any]:
    state = _trip_store.get(trip_id)
    if not state:
        raise HTTPException(status_code=404, detail="Trip not found")
    state.transport.selected_intercity_id = request.transport_id
    state.touch()
    return {"status": "transport_selected"}


@router.post("/{trip_id}/select-hotel")
async def select_hotel(
    trip_id: str,
    request: SelectHotelRequest,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    state = _trip_store.get(trip_id)
    if not state:
        raise HTTPException(status_code=404, detail="Trip not found")
    state.hotels.selected_id = request.hotel_id

    async def recalc():
        from app.agents.budget import run_budget_agent
        from app.agents.verification import run_verification_agent
        s = _trip_store[trip_id]
        s = await run_budget_agent(s)
        s = await run_verification_agent(s)
        _trip_store[trip_id] = s

    background_tasks.add_task(recalc)
    return {"status": "hotel_selected"}


@router.post("/{trip_id}/modify")
async def modify_trip(
    trip_id: str,
    request: ModifyTripRequest,
    background_tasks: BackgroundTasks,
    llm: LLMProvider = Depends(get_llm_provider),
    search: SearchProvider = Depends(get_search_provider),
    flights: FlightProvider = Depends(get_flight_provider),
    trains: TrainProvider = Depends(get_train_provider),
    hotels: HotelProvider = Depends(get_hotel_provider),
) -> dict[str, Any]:
    """
    Natural-language trip modification.
    Determines which agents to re-run and only re-runs those.
    """
    state = _trip_store.get(trip_id)
    if not state:
        raise HTTPException(status_code=404, detail="Trip not found")

    from app.agents.replanning import determine_replan_scope, apply_modification_to_state

    async def run_modification():
        try:
            from app.agents.transport import run_transport_agent
            from app.agents.hotel import run_hotel_agent
            from app.agents.activity import run_activity_agent
            from app.agents.itinerary import run_itinerary_agent
            from app.agents.budget import run_budget_agent
            from app.agents.verification import run_verification_agent
            from app.models.events import TripEvent, EventType, AgentStatus
            from app.services.event_bus import publish_event

            s = _trip_store[trip_id]
            decision = await determine_replan_scope(request.modification, s, llm)
            s = await apply_modification_to_state(request.modification, decision, s, llm)

            await publish_event(TripEvent(
                trip_id=s.trip_id,
                run_id=s.planning_run_id,
                type=EventType.REPLANNING_STARTED,
                status=AgentStatus.RUNNING,
                message=f"Updating: {decision.explanation}",
                data={"agents_to_rerun": decision.agents_to_rerun},
            ))

            # Re-run only affected agents
            agents = set(decision.agents_to_rerun)

            if "transport" in agents:
                s = await run_transport_agent(s, flights, trains, search)
            if "hotel" in agents:
                s = await run_hotel_agent(s, hotels, llm, search)
            if "activity" in agents:
                s = await run_activity_agent(s, llm, search)
            if "itinerary" in agents:
                s = await run_itinerary_agent(s, llm)
            if "budget" in agents:
                s = await run_budget_agent(s)
            if "verification" in agents:
                s = await run_verification_agent(s)

            await publish_event(TripEvent(
                trip_id=s.trip_id,
                run_id=s.planning_run_id,
                type=EventType.TRIP_UPDATED,
                status=AgentStatus.COMPLETED,
                message="Trip updated successfully",
                data={"trip_state": s.model_dump(mode="json")},
            ))

            _trip_store[trip_id] = s
        except Exception as exc:
            logger.error("modification_failed", trip_id=trip_id, error=str(exc))
            from app.models.events import TripEvent, EventType, AgentStatus
            from app.services.event_bus import publish_event
            await publish_event(TripEvent(
                trip_id=trip_id,
                run_id=getattr(state, "planning_run_id", ""),
                type=EventType.REPLANNING_FAILED,
                status=AgentStatus.FAILED,
                message=f"Modification failed: {str(exc)}",
                data={"error": str(exc)},
            ))

    background_tasks.add_task(run_modification)

    return {
        "status": "modification_started",
        "message": f"Updating your trip: '{request.modification}'",
    }


@router.get("/{trip_id}/sources")
async def get_sources(trip_id: str) -> dict[str, Any]:
    state = _trip_store.get(trip_id)
    if not state:
        raise HTTPException(status_code=404, detail="Trip not found")
    sources_by_category: dict[str, list[Any]] = {}
    for s in state.sources:
        cat = s.data_category
        if cat not in sources_by_category:
            sources_by_category[cat] = []
        sources_by_category[cat].append(s.model_dump(mode="json"))
    return {"sources": sources_by_category, "total": len(state.sources)}
