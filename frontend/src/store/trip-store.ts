import { create } from "zustand";

interface TripStore {
  tripId: string | null;
  tripState: any;
  isPlanning: boolean;
  planningError: string | null;
  preferenceQuestions: any[];
  agentActivities: Record<string, any>;
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
  setTripState: (tripState) => set({ tripState, isPlanning: !["complete", "awaiting_preference_answers"].includes(tripState?.planning_status), preferenceQuestions: tripState?.pending_preference_questions || [] }),
  setIsPlanning: (isPlanning) => set({ isPlanning }),
  handleEvent: (event) => set((state) => {
    const agentActivities = { ...state.agentActivities };
    if (event.agent) agentActivities[event.agent] = event;
    return {
      recentEvents: [...state.recentEvents, event].slice(-50),
      agentActivities,
      preferenceQuestions: event.type === "preference.questions" ? event.data?.questions || [] : (event.data?.pending_questions || state.preferenceQuestions),
      isPlanning: event.type !== "trip.ready" && event.type !== "trip.error" && event.type !== "preference.questions" && !(event.data?.pending_questions?.length),
      planningError: event.type === "trip.error" ? event.message : state.planningError,
      tripState: event.data?.trip_state || state.tripState,
    };
  }),
  selectPanel: (selectedPanel) => set({ selectedPanel }),
  selectDay: (selectedDayIndex) => set({ selectedDayIndex }),
  reset: () => set({ tripId: null, tripState: null, isPlanning: false, planningError: null, recentEvents: [] }),
}));
