import asyncio
from app.agents.destination import run_destination_agent
from app.models.trip_state import TripState
from app.providers.llm.mistral import MistralProvider
from app.providers.search.tavily import TavilySearchProvider

async def main():
    llm = MistralProvider()
    search = TavilySearchProvider()
    
    for dest in ["Kyoto, Japan", "Paris, France", "Rome, Italy"]:
        state = TripState(
            origin="New York",
            destinations_requested=[dest],
            budget_amount=5000,
            budget_currency="USD",
            original_query=f"Trip to {dest}"
        )
        
        print(f"\n--- Running destination agent for {dest} ---")
        new_state = await run_destination_agent(state, llm, search)
        
        for candidate in new_state.candidate_destinations:
            print(f"Destination: {candidate.name}")
            print(f"Image URL: {candidate.image_url}")

asyncio.run(main())
