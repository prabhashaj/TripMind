"""
Trip Planning Workflow using LangGraph StateGraph.
Coordinates all agents with conditional edges for verification loops.
"""
from __future__ import annotations

import asyncio
from typing import Annotated, Any

from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages

from app.agents.activity import run_activity_agent
from app.agents.budget import run_budget_agent
from app.agents.destination import run_destination_agent
from app.agents.hotel import run_hotel_agent
from app.agents.itinerary import run_itinerary_agent
from app.agents.transport import run_transport_agent
from app.agents.user_preference import run_user_preference_agent
from app.agents.verification import run_verification_agent
from app.core.logging import get_logger
from app.models.events import AgentStatus, EventType, TripEvent
from app.models.trip_state import PlanningStatus, TripState, VerificationStatus
from app.providers.base import FlightProvider, HotelProvider, LLMProvider, SearchProvider, TrainProvider
from app.services.event_bus import publish_event

logger = get_logger(__name__)

# Maximum verification/replan loops before giving up
MAX_REPLAN_LOOPS = 2


class WorkflowState(dict):
    """LangGraph compatible state container wrapping TripState."""
    trip_state: TripState
    replan_count: int = 0


async def build_trip_workflow(
    llm: LLMProvider,
    search: SearchProvider,
    flight_provider: FlightProvider,
    train_provider: TrainProvider,
    hotel_provider: HotelProvider,
) -> Any:
    """
    Build the LangGraph StateGraph for trip planning.
    Returns a compiled workflow graph.
    """

    # ===== Node functions =====

    async def node_extract_preferences(state: dict) -> dict:
        ts: TripState = state["trip_state"]
        ts.planning_status = PlanningStatus.EXTRACTING_PREFERENCES
        ts = await run_user_preference_agent(ts, llm)
        
        # If preference extraction failed, stop the workflow
        if ts.planning_status == PlanningStatus.FAILED:
            return {**state, "trip_state": ts}
        
        return {**state, "trip_state": ts}

    async def node_research_destinations(state: dict) -> dict:
        ts: TripState = state["trip_state"]
        ts.planning_status = PlanningStatus.RESEARCHING_DESTINATIONS
        ts = await run_destination_agent(ts, llm, search)
        return {**state, "trip_state": ts}

    async def node_research_parallel(state: dict) -> dict:
        """Run transport, hotel, and activity research concurrently."""
        ts: TripState = state["trip_state"]

        # Run all three in parallel
        results = await asyncio.gather(
            run_transport_agent(ts, flight_provider, train_provider, search),
            run_hotel_agent(ts, hotel_provider, llm, search),
            run_activity_agent(ts, llm, search),
            return_exceptions=True,
        )

        # Merge results back into state (last writer wins per section)
        for result in results:
            if isinstance(result, TripState):
                ts.transport = result.transport if result.transport.intercity else ts.transport
                ts.hotels = result.hotels if result.hotels.options else ts.hotels
                ts.activities = result.activities if result.activities else ts.activities
                # Merge sources
                for source in result.sources:
                    ts.add_source(source)

        ts.touch()
        return {**state, "trip_state": ts}

    async def node_build_itinerary(state: dict) -> dict:
        ts: TripState = state["trip_state"]
        ts.planning_status = PlanningStatus.BUILDING_ITINERARY
        ts = await run_itinerary_agent(ts, llm)
        return {**state, "trip_state": ts}

    async def node_calculate_budget(state: dict) -> dict:
        ts: TripState = state["trip_state"]
        ts.planning_status = PlanningStatus.CALCULATING_BUDGET
        ts = await run_budget_agent(ts)
        return {**state, "trip_state": ts}

    async def node_verify(state: dict) -> dict:
        ts: TripState = state["trip_state"]
        ts.planning_status = PlanningStatus.VERIFYING
        ts = await run_verification_agent(ts)
        return {**state, "trip_state": ts}

    async def node_complete(state: dict) -> dict:
        ts: TripState = state["trip_state"]
        ts.planning_status = PlanningStatus.COMPLETE
        ts.touch()

        await publish_event(TripEvent(
            trip_id=ts.trip_id,
            run_id=ts.planning_run_id,
            type=EventType.TRIP_READY,
            status=AgentStatus.COMPLETED,
            message="Your trip is ready",
            data={"trip_state": ts.model_dump(mode="json")},
        ))

        return {**state, "trip_state": ts}

    async def node_replan(state: dict) -> dict:
        """Trigger replanning when verification fails — adjust itinerary constraints."""
        ts: TripState = state["trip_state"]
        ts.planning_status = PlanningStatus.REPLANNING
        count = state.get("replan_count", 0) + 1

        await publish_event(TripEvent(
            trip_id=ts.trip_id,
            run_id=ts.planning_run_id,
            type=EventType.REPLANNING_STARTED,
            message=f"Adjusting plan to fix {ts.verification.issues_found} issue(s) (attempt {count})",
        ))

        return {**state, "trip_state": ts, "replan_count": count}

    # ===== Conditional edge functions =====

    def should_replan(state: dict) -> str:
        ts: TripState = state["trip_state"]
        count = state.get("replan_count", 0)

        if (
            ts.verification.overall_status == VerificationStatus.FAILED
            and count < MAX_REPLAN_LOOPS
        ):
            return "replan"
        return "complete"

    def should_continue_after_preferences(state: dict) -> str:
        ts: TripState = state["trip_state"]
        if ts.planning_status == PlanningStatus.AWAITING_PREFERENCE_ANSWERS:
            return "wait"
        return "continue"

    # ===== Build graph =====

    graph = StateGraph(dict)

    graph.add_node("extract_preferences", node_extract_preferences)
    graph.add_node("research_destinations", node_research_destinations)
    graph.add_node("research_parallel", node_research_parallel)
    graph.add_node("build_itinerary", node_build_itinerary)
    graph.add_node("calculate_budget", node_calculate_budget)
    graph.add_node("verify", node_verify)
    graph.add_node("replan", node_replan)
    graph.add_node("complete", node_complete)

    # Edge flow
    graph.set_entry_point("extract_preferences")
    graph.add_conditional_edges(
        "extract_preferences",
        should_continue_after_preferences,
        {"wait": END, "continue": "research_destinations"},
    )
    graph.add_edge("research_destinations", "research_parallel")
    graph.add_edge("research_parallel", "build_itinerary")
    graph.add_edge("build_itinerary", "calculate_budget")
    graph.add_edge("calculate_budget", "verify")
    graph.add_conditional_edges(
        "verify",
        should_replan,
        {
            "replan": "replan",
            "complete": "complete",
        },
    )
    graph.add_edge("replan", "build_itinerary")
    graph.add_edge("complete", END)

    return graph.compile()


async def run_trip_workflow(
    state: TripState,
    llm: LLMProvider,
    search: SearchProvider,
    flight_provider: FlightProvider,
    train_provider: TrainProvider,
    hotel_provider: HotelProvider,
) -> TripState:
    """
    Execute the full trip planning workflow.
    Returns the final TripState.
    """
    workflow = await build_trip_workflow(llm, search, flight_provider, train_provider, hotel_provider)

    initial_state = {
        "trip_state": state,
        "replan_count": 0,
    }

    try:
        final_state = await workflow.ainvoke(initial_state)
        return final_state["trip_state"]
    except Exception as exc:
        logger.error("workflow_failed", error=str(exc), trip_id=state.trip_id)
        state.planning_status = PlanningStatus.FAILED

        await publish_event(TripEvent(
            trip_id=state.trip_id,
            run_id=state.planning_run_id,
            type=EventType.TRIP_ERROR,
            status=AgentStatus.FAILED,
            message="Planning workflow encountered an unexpected error",
            data={"error": str(exc)},
        ))

        raise
