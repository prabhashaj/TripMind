# AI Travel Agent — Production-Grade Trip OS

A production-quality AI travel planning platform powered by **Mistral AI** and **Tavily Search**.

## Architecture

```
frontend/          Next.js 14 + TypeScript + Tailwind + Zustand
backend/           Python + FastAPI + LangGraph + Pydantic v2
  app/
    agents/        11 specialized agents (destination, transport, hotel, etc.)
    api/           FastAPI routers (trips, events/SSE)
    models/        TripState, events, SQLAlchemy ORM
    providers/     Mistral LLM, Tavily search, mock flight/hotel providers
    services/      Redis event bus, caching
    workflows/     LangGraph multi-agent StateGraph
PostgreSQL+PostGIS Database with 16 tables
Redis             Event bus for SSE streaming
```

## Quick Start

### 1. Copy environment variables
```bash
cp .env.example .env
```

Edit `.env` and add your API keys:
- `MISTRAL_API_KEY` — from https://console.mistral.ai/
- `TAVILY_API_KEY` — from https://tavily.com/
- `MAPBOX_ACCESS_TOKEN` — from https://account.mapbox.com/

### 2. Start all services
```bash
docker-compose up
```

This starts:
- PostgreSQL + PostGIS (port 5432)
- Redis (port 6379)
- FastAPI backend (port 8000)
- Next.js frontend (port 3000)

### 3. Open the app
Visit: http://localhost:3000

### 4. Try it
Type: *"Plan a 7-day trip from Hyderabad to Kashmir for 2 people under ₹60,000"*

## Development (without Docker)

### Backend
```bash
cd backend
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/trips/plan` | POST | Start planning workflow |
| `/api/trips/{id}` | GET | Get full TripState |
| `/api/trips/{id}/events` | GET | SSE stream of agent events |
| `/api/trips/{id}/select-destination` | POST | Select a destination |
| `/api/trips/{id}/select-transport` | POST | Select transport |
| `/api/trips/{id}/select-hotel` | POST | Select hotel |
| `/api/trips/{id}/modify` | POST | Natural language modification |
| `/api/trips/{id}/sources` | GET | Get provenance sources |
| `/health` | GET | Provider availability status |

## Agents

| Agent | Purpose | Model |
|---|---|---|
| User Preference | Intent extraction | Mistral Small |
| Destination | Web research + ranking | Mistral Large + Tavily |
| Transport | Flight/train search | Provider abstraction |
| Hotel | Hotel search | Provider abstraction |
| Activity | Attraction research | Mistral Large + Tavily |
| Itinerary | Day-by-day planning | Mistral Large |
| Budget | Cost calculation | Deterministic |
| Verification | Feasibility checks | Deterministic |
| Replanning | Targeted re-runs | Mistral Small |

## Provider Status

| Provider | Status | To Enable |
|---|---|---|
| Mistral LLM | Required | `MISTRAL_API_KEY` |
| Tavily Search | Required | `TAVILY_API_KEY` |
| Mapbox Maps | Recommended | `MAPBOX_ACCESS_TOKEN` |
| OpenWeatherMap | Optional | `OPENWEATHER_API_KEY` |
| Amadeus Flights | Optional | `AMADEUS_CLIENT_ID` + `AMADEUS_CLIENT_SECRET` |

Without Amadeus: estimated flight prices are shown clearly marked as estimated.
