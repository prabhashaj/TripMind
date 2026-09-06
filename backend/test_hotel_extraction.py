import requests
import time
import sys

base_url = "http://127.0.0.1:8000"

def main():
    print("Starting trip planning for a real destination (e.g. Kyoto)...")
    req_data = {
        "query": "A trip to Kyoto for 2 adults",
        "trip_duration": "5 days",
        "budget": "$2000"
    }
    
    resp = requests.post(f"{base_url}/api/trips/plan", json=req_data)
    if resp.status_code != 200:
        print("Failed to start trip:", resp.text)
        sys.exit(1)
        
    trip_id = resp.json().get("trip_id")
    print(f"Started trip with ID: {trip_id}")
    
    print("Waiting for hotels to be populated...")
    max_retries = 30
    for i in range(max_retries):
        time.sleep(2)
        trip_resp = requests.get(f"{base_url}/api/trips/{trip_id}")
        if trip_resp.status_code == 200:
            state = trip_resp.json()
            hotels = state.get("hotels")
            if hotels and hotels.get("options"):
                options = hotels.get("options")
                print(f"Success! Found {len(options)} hotels.")
                for idx, h in enumerate(options, 1):
                    print(f"\n[{idx}] {h.get('name')}")
                    print(f"    Source: {h.get('source')}")
                    print(f"    Price per night: {h.get('currency')} {h.get('price_per_night')}")
                    print(f"    Total price: {h.get('total_price')}")
                    print(f"    Rating: {h.get('rating')}")
                    print(f"    Location: {h.get('location')}")
                return
            
            # Print current status
            print(f"Still planning... (attempt {i+1}/{max_retries})")
        else:
            print(f"Failed to fetch trip state (attempt {i+1}/{max_retries})")
            
    print("Timed out waiting for hotels.")

if __name__ == "__main__":
    main()
