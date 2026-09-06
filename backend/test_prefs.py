import asyncio
from app.agents.user_preference import run_user_preference_agent
from app.models.trip_state import TripState
from app.providers.llm.mistral import MistralProvider
from app.services.memory import memory_store

async def main():
    llm = MistralProvider()
    
    # Test 1: No currency/origin signals
    print("\n--- Test 1: No signals (should ask for currency & origin) ---")
    state1 = TripState(original_query="Plan a trip to Paris.", user_id="test_user_1")
    state1 = await run_user_preference_agent(state1, llm)
    print(f"Status: {state1.planning_status}")
    print(f"Questions: {[q['id'] for q in state1.pending_preference_questions]}")
    budget_q = next((q for q in state1.pending_preference_questions if q["id"] == "budget"), None)
    if budget_q:
        print(f"Budget Options: {budget_q['options']}")
        
    # Test 2: Explicit signals
    print("\n--- Test 2: Explicit signals (should infer USD) ---")
    state2 = TripState(original_query="Plan a trip from New York to Paris under $5000.", user_id="test_user_2")
    state2 = await run_user_preference_agent(state2, llm)
    print(f"Status: {state2.planning_status}")
    print(f"Currency extracted: {state2.budget_currency}")
    print(f"Origin extracted: {state2.origin}")
    print(f"Memory saved: {memory_store.get_long_term('test_user_2').preferences}")
    
    # Test 3: Use Memory
    print("\n--- Test 3: Return user (should use memory for currency) ---")
    state3 = TripState(original_query="Plan a trip to London.", user_id="test_user_2")
    state3 = await run_user_preference_agent(state3, llm)
    print(f"Status: {state3.planning_status}")
    print(f"Currency used from memory: {state3.budget_currency}")
    print(f"Origin used from memory: {state3.origin}")
    print(f"Questions: {[q['id'] for q in state3.pending_preference_questions]}")
    budget_q = next((q for q in state3.pending_preference_questions if q["id"] == "budget"), None)
    if budget_q:
        print(f"Budget Options: {budget_q['options']}")

asyncio.run(main())
