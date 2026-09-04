"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTripStore } from "@/store/trip-store";
import { createTripSSEClient } from "@/lib/sse-client";
import { AgentActivityPanel } from "@/components/AgentActivityPanel";
import { DestinationCard } from "@/components/DestinationCard";
import { api } from "@/lib/api";
import {
  ArrowLeft, Sparkles, MapPin, AlertTriangle, Loader2, CheckCircle2, Map,
} from "lucide-react";
import Link from "next/link";

export default function PlanPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const { tripState, isPlanning, planningError, preferenceQuestions, setTripId, handleEvent } = useTripStore();
  const sseRef = useRef<ReturnType<typeof createTripSSEClient> | null>(null);

  useEffect(() => {
    if (!tripId) return;
    setTripId(tripId);
    const client = createTripSSEClient(tripId);
    sseRef.current = client;
    client.on("*", handleEvent).on("trip.ready", () => { setTimeout(() => router.push(`/trip/${tripId}`), 1200); }).connect();
    return () => client.disconnect();
  }, [tripId, router, setTripId, handleEvent]);

  const handleSelectDestination = async (destinationId: string) => {
    try { await api.selectDestination(tripId, destinationId); } catch (err) { console.error(err); }
  };

  const destinations = tripState?.candidate_destinations || [];
  const hasDestinations = destinations.length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg-base)", color: "var(--color-text-primary)", display: "flex", flexDirection: "column" }}>

      {/* Top bar */}
      <header style={{ borderBottom: "1px solid var(--color-border)", background: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 1.5rem", height: "3.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none" }}>
              <div style={{ width: "1.75rem", height: "1.75rem", borderRadius: "0.4375rem", background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Map className="w-3.5 h-3.5 text-white" />
              </div>
              <span style={{ fontWeight: 700, fontSize: "0.9375rem", letterSpacing: "-0.02em", color: "var(--color-text-primary)" }}>TripMind</span>
            </Link>
            <span style={{ color: "var(--color-border-strong)", fontSize: "0.875rem" }}>/</span>
            <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>Planning</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {isPlanning ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.3125rem 0.75rem", borderRadius: "99px", background: "rgba(139, 92, 246, 0.12)", border: "1px solid rgba(139, 92, 246, 0.25)" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-primary-500)", boxShadow: "0 0 6px rgba(139, 92, 246, 0.7)", animation: "dot-pulse 2.5s infinite ease-in-out", display: "inline-block" }} />
                <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--color-primary-600)" }}>Agents working</span>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.3125rem 0.75rem", borderRadius: "99px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--color-success)" }} />
                <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--color-success)" }}>Complete</span>
              </div>
            )}
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", fontSize: "0.8125rem", fontWeight: 500, color: "var(--color-text-secondary)", border: "1px solid var(--color-border)", background: "transparent", textDecoration: "none", transition: "all 0.15s" }}>
              <ArrowLeft className="w-3.5 h-3.5" />
              New trip
            </Link>
          </div>
        </div>
      </header>

      {/* Body: sidebar + canvas */}
      <div style={{ flex: 1, display: "flex", maxWidth: "1400px", width: "100%", margin: "0 auto", padding: "0 1.5rem" }}>

        {/* Sidebar */}
        <aside style={{ width: "280px", flexShrink: 0, paddingTop: "1.5rem", paddingRight: "1.5rem", paddingBottom: "1.5rem", position: "sticky", top: "3.5rem", height: "calc(100vh - 3.5rem)", overflowY: "auto", borderRight: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Query card */}
          <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: "0.75rem", padding: "0.875rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <Sparkles className="w-3.5 h-3.5" style={{ color: "var(--color-primary-500)", flexShrink: 0 }} />
              <span style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>Your request</span>
            </div>
            <p style={{ fontSize: "0.8125rem", lineHeight: 1.6, color: "var(--color-text-secondary)" }}>
              {tripState?.original_query || "Launching agents..."}
            </p>
          </div>

          {/* Agent panel */}
          <div style={{ flex: 1 }}>
            <AgentActivityPanel />
          </div>
        </aside>

        {/* Main canvas */}
        <main style={{ flex: 1, paddingTop: "2rem", paddingLeft: "2rem", paddingBottom: "2rem", minWidth: 0 }}>

          {/* Section header */}
          <div style={{ marginBottom: "2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.625rem" }}>
              <MapPin className="w-3.5 h-3.5" style={{ color: "var(--color-primary-500)" }} />
              <span style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-primary-500)" }}>
                {hasDestinations ? "Destinations found" : "Searching destinations"}
              </span>
            </div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.025em", marginBottom: "0.375rem" }}>
              {hasDestinations ? "Choose your destination" : "Discovering your perfect destination"}
            </h1>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              {hasDestinations
                ? `${destinations.length} destinations matched your preferences. Select one to continue planning.`
                : "AI agents are researching destinations, flights, hotels, and activities in real time."}
            </p>
          </div>

          {/* Error */}
          {planningError && (
            <div style={{ marginBottom: "1.5rem", padding: "0.875rem 1rem", borderRadius: "0.625rem", background: "rgba(239, 68, 68 / 0.1)", border: "1px solid rgba(239, 68, 68 / 0.3)", display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--color-error)" }} />
              <div>
                <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-error)", marginBottom: "0.25rem" }}>Planning issue</p>
                <p style={{ fontSize: "0.8125rem", color: "var(--color-error)" }}>{planningError}</p>
              </div>
            </div>
          )}

          {preferenceQuestions.length > 0 && (
            <div className="preference-questions">
              <div className="preference-questions-heading">
                <Sparkles className="w-4 h-4" />
                <div><strong>One more thing from your Preference Agent</strong><p>Choose what feels right. We will use it to tune the recommendations.</p></div>
              </div>
              {preferenceQuestions.map((question) => (
                <div className="preference-question" key={question.id}>
                  <strong>{question.prompt}</strong>
                  <div className="option-row">{question.options.map((option) => <button key={option} type="button" className="choice">{option}</button>)}</div>
                  {question.allow_text && <input className="preference-answer" placeholder="Or type your answer" aria-label={question.prompt} />}
                </div>
              ))}
            </div>
          )}

          {/* Destinations grid */}
          {hasDestinations ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
              {destinations.map((dest) => (
                <DestinationCard
                  key={dest.id}
                  destination={dest}
                  onSelect={handleSelectDestination}
                  isSelected={tripState?.selected_destination?.id === dest.id}
                />
              ))}
            </div>
          ) : isPlanning ? (
            <div>
              {/* Loading state */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1.25rem", padding: "0.75rem 1rem", borderRadius: "0.625rem", background: "var(--color-bg-card)", border: "1px solid var(--color-border)" }}>
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--color-primary-500)", flexShrink: 0 }} />
                <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>Destination agents crawling live data...</span>
              </div>

              {/* Skeleton cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: "0.75rem", overflow: "hidden" }}>
                    <div style={{ height: "160px", background: "var(--color-bg-elevated)", position: "relative" }}>
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent 0%, rgba(15, 23, 42 / 0.5) 50%, transparent 100%)", animation: "shimmer 1.5s infinite" }} />
                    </div>
                    <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {[80, 55, 40].map((w, j) => (
                        <div key={j} style={{ height: "0.75rem", borderRadius: "99px", background: "var(--color-bg-elevated)", width: `${w}%` }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Parallel agents progress */}
          {isPlanning && hasDestinations && (
            <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid var(--color-border)" }}>
              <p style={{ fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: "0.875rem" }}>
                Parallel research in progress
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.625rem" }}>
                {[
                  { name: "Flights & Transit", desc: "Finding optimal direct routes" },
                  { name: "Boutique Stays", desc: "Screening verified accommodations" },
                  { name: "Experiences", desc: "Curating top sights & activities" },
                  { name: "Pacing Shield", desc: "Checking transit time feasibility" },
                ].map((step, i) => (
                  <div key={i} style={{ padding: "0.875rem", borderRadius: "0.625rem", background: "var(--color-bg-card)", border: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: "0.625rem" }}>
                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--color-primary-500)", boxShadow: "0 0 6px var(--color-primary-500) / 0.6)", flexShrink: 0, display: "inline-block", animation: "dot-pulse 2.5s infinite ease-in-out" }} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: "0.8125rem", fontWeight: 600, lineHeight: 1.3 }}>{step.name}</p>
                      <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.125rem" }}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}