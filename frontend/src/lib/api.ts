const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function getUserId() {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem("tripmind-user-id");
  const userId = existing || crypto.randomUUID();
  window.localStorage.setItem("tripmind-user-id", userId);
  return userId;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  if (!response.ok) throw new Error(await response.text() || `API error ${response.status}`);
  return response.json() as Promise<T>;
}

export interface StartPlanningResponse { trip_id: string; status: string; message: string; }
export interface MemoryRecord { user_id: string; facts: string[]; preferences: Record<string, string>; saved_destinations: string[]; updated_at: string; }
export interface ConversationResponse {
  response: string;
  conversation_id: string;
  short_term: { role: string; content: string }[];
  long_term: MemoryRecord;
  planning_ready?: boolean;
  planning_query?: string;
}
export type Destination = any;
export type Activity = any;
export type HotelOption = any;
export type TransportLeg = any;
export type ItineraryDay = any;
export type ItineraryItem = any;
export type Budget = any;

export const api = {
  startPlanning: (query: string, userId?: string, profile?: { home_location?: string; home_country?: string; currency?: string; trip_duration?: string; budget?: string }) => request<StartPlanningResponse>("/api/trips/plan", { method: "POST", body: JSON.stringify({ query, user_id: userId, ...profile }) }),
  getTrip: (tripId: string) => request<any>(`/api/trips/${tripId}`),
  selectDestination: (tripId: string, destinationId: string) => request<any>(`/api/trips/${tripId}/select-destination`, { method: "POST", body: JSON.stringify({ destination_id: destinationId }) }),
  selectTransport: (tripId: string, transportId: string) => request<any>(`/api/trips/${tripId}/select-transport`, { method: "POST", body: JSON.stringify({ transport_id: transportId }) }),
  selectHotel: (tripId: string, hotelId: string) => request<any>(`/api/trips/${tripId}/select-hotel`, { method: "POST", body: JSON.stringify({ hotel_id: hotelId }) }),
  modifyTrip: (tripId: string, modification: string) => request<any>(`/api/trips/${tripId}/modify`, { method: "POST", body: JSON.stringify({ modification }) }),
  answerPreferences: (tripId: string, answers: Record<string, string>) => request<any>(`/api/trips/${tripId}/preference-answers`, { method: "POST", body: JSON.stringify({ answers }) }),
  sendConversationMessage: (userId: string, conversationId: string, message: string, remember = true) => request<ConversationResponse>("/api/conversation/message", { method: "POST", body: JSON.stringify({ user_id: userId, conversation_id: conversationId, message, remember }) }),
  getMemory: (userId: string, conversationId?: string) => request<{ long_term: MemoryRecord; short_term: { role: string; content: string }[] }>(`/api/conversation/${encodeURIComponent(userId)}/memory${conversationId ? `?conversation_id=${encodeURIComponent(conversationId)}` : ""}`),
  clearMemory: (userId: string) => request<{ status: string }>(`/api/conversation/${encodeURIComponent(userId)}/memory`, { method: "DELETE" }),
};

export { request };
