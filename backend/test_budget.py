import asyncio
from app.agents.budget import run_budget_agent
from app.models.trip_state import TripState, HotelOption, TransportLeg, ActivityItem, DateRange, TravelerInfo, TransportOptions, HotelOptions

async def main():
    print("Setting up mock trip state...")
    
    # Common mock data
    dates = DateRange(duration_days=5)
    travelers = TravelerInfo(adults=2)
    
    flight = TransportLeg(
        mode="flight", provider="test", origin="JFK", destination="NRT",
        price=1000.0, currency="USD"
    )
    hotel = HotelOption(
        name="Test Hotel", location="Kyoto", price_per_night=15000,
        total_price=75000, currency="JPY", nights=5
    )
    activity = ActivityItem(
        name="Test Tour", type="tour", description="test", location="Kyoto",
        price_per_person=50.0, currency="EUR"
    )
    
    # 1. Test with INR
    print("\n--- Testing Budget in INR ---")
    state_inr = TripState(
        budget_currency="INR", dates=dates, travelers=travelers,
        transport=TransportOptions(intercity=[flight]),
        hotels=HotelOptions(options=[hotel]),
        activities=[activity]
    )
    state_inr = await run_budget_agent(state_inr)
    
    print(f"Total INR: {state_inr.budget.total}")
    print(f"FX Rate Used (INR->INR): {state_inr.budget.fx_rate_used}")
    
    for item in state_inr.budget.line_items:
        print(f" - {item.label}: {item.amount:.2f} {item.currency}")
        
    # 2. Test with USD
    print("\n--- Testing Budget in USD ---")
    state_usd = TripState(
        budget_currency="USD", dates=dates, travelers=travelers,
        transport=TransportOptions(intercity=[flight]),
        hotels=HotelOptions(options=[hotel]),
        activities=[activity]
    )
    state_usd = await run_budget_agent(state_usd)
    
    print(f"Total USD: {state_usd.budget.total}")
    print(f"FX Rate Used (INR->USD): {state_usd.budget.fx_rate_used}")
    
    for item in state_usd.budget.line_items:
        print(f" - {item.label}: {item.amount:.2f} {item.currency}")
        
    # Verify the ratio is realistic (around 83 INR per USD)
    ratio = state_inr.budget.total / state_usd.budget.total
    print(f"\nImplied INR/USD ratio for total trip cost: {ratio:.2f}")

asyncio.run(main())
