import asyncio
from app.agents.hotel import run_hotel_agent
from app.models.trip_state import TripState
from app.providers.mocks import MockHotelProvider
from app.providers.llm.mistral import MistralProvider
from app.providers.search.tavily import TavilySearchProvider

async def main():
    state = TripState(
        origin="Hyderabad",
        destinations_requested=["Kyoto"],
        budget_amount=2000,
        budget_currency="USD",
        original_query="Trip to Kyoto"
    )
    # create fake destination selection
    from app.models.trip_state import DestinationCandidate
    state.selected_destination = DestinationCandidate(
        name="Kyoto",
        country="Japan",
        description="test",
        estimated_cost_min=1000,
        estimated_cost_max=3000,
        recommended_duration_days=5,
        why_it_matches="test"
    )
    
    hotel = MockHotelProvider()
    llm = MistralProvider()
    search = TavilySearchProvider()
    
    new_state = await run_hotel_agent(state, hotel, llm, search)
    print("Found hotels:", len(new_state.hotels.options))
    for h in new_state.hotels.options:
        print(f"Name: {h.name}, Source: {h.source}, Price: {h.price_per_night}")

asyncio.run(main())
