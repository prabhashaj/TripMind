import { create } from "zustand";

export interface AgentActivity {
  agent: string;
  name: string;
  status: "waiting" | "running" | "completed" | "failed" | "skipped" | "timeout";
  message: string;
  timestamp?: string;
  itemsFound?: number;
  data?: any;
}

interface TripStore {
  tripId: string | null;
  tripState: any;
  isPlanning: boolean;
  planningError: string | null;
  preferenceQuestions: any[];
  agentActivities: Record<string, AgentActivity>;
  recentEvents: any[];
  selectedPanel: string;
  selectedDayIndex: number;
  setTripId: (tripId: string) => void;
  setTripState: (state: any) => void;
  setIsPlanning: (value: boolean) => void;
  handleEvent: (event: any) => void;
  selectPanel: (panel: string) => void;
  selectDay: (index: number) => void;
  reset: () => void;
}

export const useTripStore = create<TripStore>((set) => ({
  tripId: null,
  tripState: null,
  isPlanning: false,
  planningError: null,
  preferenceQuestions: [],
  agentActivities: {},
  recentEvents: [],
  selectedPanel: "overview",
  selectedDayIndex: 0,

  setTripId: (tripId) => set({ tripId }),

  setTripState: (tripState) =>
    set({
      tripState,
      isPlanning: !["complete", "awaiting_preference_answers"].includes(tripState?.planning_status),
      preferenceQuestions: tripState?.pending_preference_questions || [],
    }),

  setIsPlanning: (isPlanning) => set({ isPlanning }),

  handleEvent: (rawEvent) =>
    set((state) => {
      const event = {
        ...rawEvent,
        itemsFound: rawEvent.itemsFound ?? rawEvent.items_found,
        data: rawEvent.data || {},
      };

      const agentActivities: Record<string, AgentActivity> = { ...state.agentActivities };

      const lifecycleTypes: Record<string, string> = {
        "preferences.extracted": "user_preference",
        "destinations.found": "destination",
        "transport.found": "transport",
        "hotels.found": "hotel",
        "activities.found": "activity",
        "itinerary.created": "itinerary",
        "budget.calculated": "budget",
        "verification.started": "verification",
        "verification.completed": "verification",
        "verification.failed": "verification",
        "replanning.started": "replanning",
        "replanning.completed": "replanning",
      };

      const agentName = event.agent || lifecycleTypes[event.type] || "orchestrator";

      // Determine status from event type and payload
      let status: AgentActivity["status"] = (event.status as any) || "running";
      if (event.type === "node.timeout") {
        status = "timeout";
      } else if (event.type.endsWith(".failed") || event.type === "trip.error") {
        status = "failed";
      } else if (event.type.endsWith(".completed") || lifecycleTypes[event.type]) {
        status = "completed";
      } else if (event.type.endsWith(".started")) {
        status = "running";
      }

      agentActivities[agentName] = {
        agent: agentName,
        name: agentName,
        status,
        message: event.message || agentActivities[agentName]?.message || "",
        timestamp: event.timestamp || new Date().toISOString(),
        itemsFound: event.itemsFound !== undefined ? event.itemsFound : agentActivities[agentName]?.itemsFound,
        data: event.data,
      };

      // Progressively accumulate trip state slices as events arrive
      let updatedTripState = state.tripState ? { ...state.tripState } : {};

      if (event.data?.trip_state) {
        updatedTripState = event.data.trip_state;
      } else {
        switch (event.type) {
          case "destinations.found":
            if (event.data.destinations) {
              updatedTripState.candidate_destinations = event.data.destinations;
            }
            break;
          case "transport.found":
            const transportList = event.data.transport_options || event.data.intercity || [];
            updatedTripState.transport = {
              ...(updatedTripState.transport || {}),
              intercity: transportList,
            };
            break;
          case "hotels.found":
            const hotelList = event.data.hotels || [];
            updatedTripState.hotels = {
              ...(updatedTripState.hotels || {}),
              options: hotelList,
            };
            break;
          case "activities.found":
            const activityList = event.data.activities || [];
            updatedTripState.activities = activityList;
            break;
          case "itinerary.created":
            if (event.data.itinerary) {
              updatedTripState.itinerary = event.data.itinerary;
            }
            break;
          case "budget.calculated":
            if (event.data.budget) {
              updatedTripState.budget = event.data.budget;
            }
            break;
          case "verification.completed":
            updatedTripState.verification = event.data.verification || {
              overall_status: "passed",
              checks: event.data.checks || [],
            };
            break;
          case "verification.failed":
            updatedTripState.verification = event.data.verification || {
              overall_status: "failed",
              checks: event.data.checks || [],
            };
            break;
          case "trip.ready":
            if (event.data.destination && !updatedTripState.selected_destination) {
              updatedTripState.selected_destination = { name: event.data.destination };
            }
            break;
        }
      }

      const isTripComplete = event.type === "trip.ready";
      const isTripError = event.type === "trip.error";
      const hasPendingQuestions = event.type === "preference.questions" || Boolean(event.data?.pending_questions?.length);

      return {
        recentEvents: [event, ...state.recentEvents].slice(0, 50),
        agentActivities,
        preferenceQuestions:
          event.type === "preference.questions"
            ? event.data?.questions || []
            : event.data?.pending_questions || state.preferenceQuestions,
        isPlanning: !isTripComplete && !isTripError && !hasPendingQuestions,
        planningError: isTripError ? event.message : state.planningError,
        tripState: Object.keys(updatedTripState).length > 0 ? updatedTripState : state.tripState,
      };
    }),

  selectPanel: (selectedPanel) => set({ selectedPanel }),
  selectDay: (selectedDayIndex) => set({ selectedDayIndex }),

  reset: () =>
    set({
      tripId: null,
      tripState: null,
      isPlanning: false,
      planningError: null,
      preferenceQuestions: [],
      agentActivities: {},
      recentEvents: [],
      selectedPanel: "overview",
      selectedDayIndex: 0,
    }),
}));
