export function createTripSSEClient(tripId: string) {
  const listeners = new Map<string, (event: any) => void>();
  let source: EventSource | null = null;
  const client = {
    on(type: string, listener: (event: any) => void) {
      listeners.set(type, listener);
      return client;
    },
    connect() {
      if (typeof window === "undefined") return client;
      source = new EventSource(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/trips/${tripId}/events`);
      const handleEvent = (event: MessageEvent) => {
        const payload = JSON.parse(event.data);
        listeners.get(payload.type)?.(payload);
        listeners.get("*")?.(payload);
      };
      source.onmessage = handleEvent;
      ["preference.questions", "preferences.extracted", "destinations.found", "trip.ready", "trip.error", "agent.started", "agent.completed", "agent.failed"].forEach((type) => source?.addEventListener(type, handleEvent));
      return client;
    },
    disconnect() {
      source?.close();
    },
  };
  return client;
}
