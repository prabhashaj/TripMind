export const TRIP_EVENT_TYPES = [
  // Agent lifecycle
  "agent.started",
  "agent.completed",
  "agent.failed",
  "agent.skipped",

  // Tool lifecycle
  "tool.started",
  "tool.completed",
  "tool.failed",

  // Search
  "search.started",
  "search.completed",

  // Planning milestones
  "preferences.extracted",
  "preference.questions",
  "destinations.found",
  "transport.found",
  "hotels.found",
  "activities.found",
  "itinerary.created",
  "budget.calculated",

  // Verification
  "verification.started",
  "verification.completed",
  "verification.failed",

  // Replanning
  "replanning.started",
  "replanning.completed",
  "replanning.failed",

  // Trip lifecycle
  "trip.ready",
  "trip.updated",
  "trip.error",
  "node.timeout",

  // Provider status
  "provider.unavailable",
] as const;

export type TripEventType = typeof TRIP_EVENT_TYPES[number] | "*";

export function createTripSSEClient(tripId: string) {
  const listeners = new Map<string, Array<(event: any) => void>>();
  let source: EventSource | null = null;

  const client = {
    on(type: string, listener: (event: any) => void) {
      const current = listeners.get(type) || [];
      current.push(listener);
      listeners.set(type, current);
      return client;
    },
    connect() {
      if (typeof window === "undefined") return client;
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      source = new EventSource(`${baseUrl}/api/trips/${tripId}/events`);

      const handleEvent = (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data);
          const typeListeners = listeners.get(payload.type) || [];
          typeListeners.forEach((fn) => fn(payload));
          const wildcardListeners = listeners.get("*") || [];
          wildcardListeners.forEach((fn) => fn(payload));
        } catch (err) {
          console.error("[SSE] Failed to parse event payload:", err, event.data);
        }
      };

      source.onmessage = handleEvent;

      TRIP_EVENT_TYPES.forEach((type) => {
        source?.addEventListener(type, handleEvent);
      });

      source.onerror = (err) => {
        console.warn("[SSE] Connection notice/error:", err);
      };

      return client;
    },
    disconnect() {
      if (source) {
        source.close();
        source = null;
      }
    },
  };

  return client;
}
