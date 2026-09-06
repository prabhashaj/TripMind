"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTripStore } from "@/store/trip-store";
import { createTripSSEClient } from "@/lib/sse-client";
import { AgentActionShimmer } from "@/components/AgentActionShimmer";
import { DestinationCard } from "@/components/DestinationCard";
import { api } from "@/lib/api";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Map,
} from "lucide-react";
import Link from "next/link";

export default function PlanPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;
  const {
    tripState,
    isPlanning,
    planningError,
    preferenceQuestions,
  } = useTripStore();
  const sseRef = useRef<ReturnType<typeof createTripSSEClient> | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedDestId, setSelectedDestId] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;
    useTripStore.getState().setTripId(tripId);
    api
      .getTrip(tripId)
      .then((state) => {
        useTripStore.getState().setTripState(state);
        if (state.selected_destination?.id) {
          setSelectedDestId(state.selected_destination.id);
        }
      })
      .catch(console.error);

    const client = createTripSSEClient(tripId);
    sseRef.current = client;

    client
      .on("*", (event) => {
        useTripStore.getState().handleEvent(event);
      })
      .on("trip.ready", () => {
        setTimeout(() => router.push(`/trip/${tripId}`), 1000);
      })
      .connect();

    return () => {
      client.disconnect();
      sseRef.current = null;
    };
  }, [tripId, router]);

  const handleSelectDestination = async (destinationId: string) => {
    setSelectedDestId(destinationId);
    try {
      await api.selectDestination(tripId, destinationId);
      useTripStore.setState({ isPlanning: true });
    } catch (err) {
      console.error(err);
    }
  };

  const submitPreferences = async () => {
    if (!preferenceQuestions.every((question) => answers[question.id]?.trim())) return;
    try {
      await api.answerPreferences(tripId, answers);
      useTripStore.setState({ preferenceQuestions: [], isPlanning: true });
    } catch (error) {
      console.error(error);
    }
  };

  const destinations = tripState?.candidate_destinations || [];
  const hasDestinations = destinations.length > 0;
  const destinationChosen = Boolean(selectedDestId || tripState?.selected_destination?.id);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-bg-base)",
        color: "var(--color-text-primary)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top bar styled according to classical theme */}
      <header className="classical-nav">
        <div
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            padding: "0 1.5rem",
            height: "3.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Link
              href="/"
              className="classical-brand"
              style={{
                textDecoration: "none",
                fontSize: "1.3rem",
              }}
            >
              <div className="classical-brand-mark" style={{ width: "2.1rem", height: "2.1rem" }}>
                <Map className="w-3.5 h-3.5" />
              </div>
              <span>TripMind</span>
            </Link>
            <span style={{ color: "#c5b99f", fontSize: "0.875rem" }}>/</span>
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#536071" }}>
              Multi-Agent Planning
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {tripState?.planning_status === "awaiting_preference_answers" ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.3125rem 0.75rem",
                  borderRadius: "99px",
                  background: "#fdf8ee",
                  border: "1px solid #e7d5b8",
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "#a77a2b",
                    display: "inline-block",
                  }}
                />
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#8a611c",
                  }}
                >
                  Waiting for your answers
                </span>
              </div>
            ) : isPlanning ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.3125rem 0.75rem",
                  borderRadius: "99px",
                  background: "#f7f0df",
                  border: "1px solid #d7c8ac",
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "#a77a2b",
                    boxShadow: "0 0 6px rgba(167, 122, 43, 0.4)",
                    animation: "dot-pulse 2s infinite ease-in-out",
                    display: "inline-block",
                  }}
                />
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#745115",
                  }}
                >
                  Agents Planning
                </span>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "0.3125rem 0.75rem",
                  borderRadius: "99px",
                  background: "#eef7f0",
                  border: "1px solid #b7dfc3",
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#1b6d39" }} />
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#1b6d39",
                  }}
                >
                  Trip Ready
                </span>
              </div>
            )}
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.375rem 0.85rem",
                borderRadius: "0.4rem",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "#1d2735",
                border: "1px solid #d7c8ac",
                background: "#fbf9f4",
                textDecoration: "none",
                transition: "all 0.15s ease",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "#f4ede0";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "#fbf9f4";
              }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              New trip
            </Link>
          </div>
        </div>
      </header>

      {/* Body: centered single canvas without separate sidebar */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          maxWidth: "960px",
          width: "100%",
          margin: "0 auto",
          padding: "2.5rem 1.5rem",
        }}
      >
        <main
          style={{
            width: "100%",
            minWidth: 0,
          }}
        >
          {/* Shimmering agent action indicator shown directly in the flow */}
          <div style={{ marginBottom: "1.75rem" }}>
            <AgentActionShimmer tripId={tripId} />
          </div>
          {/* Section header */}
          <div style={{ marginBottom: "2rem" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.22rem 0.65rem",
                borderRadius: "99px",
                background: "#f7f0df",
                border: "1px solid #d7c8ac",
                marginBottom: "0.75rem",
              }}
            >
              <MapPin className="w-3.5 h-3.5" style={{ color: "#a77a2b" }} />
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#8a611c",
                }}
              >
                {destinationChosen
                  ? "Parallel Research Node Active"
                  : hasDestinations
                  ? "Destinations Discovered"
                  : preferenceQuestions.length > 0
                  ? "Details Needed"
                  : "Multi-Agent Planning In Progress"}
              </span>
            </div>
            <h1
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "1.85rem",
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "#1d2735",
                marginBottom: "0.375rem",
              }}
            >
              {destinationChosen
                ? "Synthesizing Flights, Hotels & Experiences"
                : hasDestinations
                ? "Select your destination"
                : preferenceQuestions.length > 0
                ? "A few quick questions"
                : "Discovering your ideal itinerary"}
            </h1>
            <p
              style={{
                fontSize: "0.9rem",
                color: "#536071",
                lineHeight: 1.6,
              }}
            >
              {destinationChosen
                ? "Our parallel transport, hotel, and activity agents are searching options and verifying budget constraints."
                : hasDestinations
                ? `${destinations.length} destinations matched your preferences. Select one to proceed to detailed research.`
                : preferenceQuestions.length > 0
                ? "Answer these questions so our agents can personalize your recommendations."
                : "LangGraph agents are evaluating routes, seasonal weather, accommodations, and curated activities in real time."}
            </p>
          </div>

          {/* Planning error banner if any */}
          {planningError && (
            <div
              style={{
                marginBottom: "1.5rem",
                padding: "0.875rem 1rem",
                borderRadius: "0.625rem",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.625rem",
              }}
            >
              <AlertTriangle
                className="w-4 h-4 shrink-0 mt-0.5"
                style={{ color: "var(--color-error)" }}
              />
              <div>
                <p
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--color-error)",
                    marginBottom: "0.25rem",
                  }}
                >
                  Planning Issue Encountered
                </p>
                <p style={{ fontSize: "0.8125rem", color: "var(--color-error)" }}>
                  {planningError}
                </p>
              </div>
            </div>
          )}

          {/* Preference questions form if any */}
          {preferenceQuestions.length > 0 && (
            <div className="card preference-card animate-scale-in">
              <div className="preference-card-header">
                <div className="preference-icon-badge">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="preference-card-title">Tailor Your Trip Requirements</h3>
                  <p className="preference-card-subtitle">
                    Our agents need a few essentials to personalize your route, stays, and activities.
                  </p>
                </div>
              </div>

              <div className="preference-questions-list">
                {preferenceQuestions.map((question, qIdx) => (
                  <div className="preference-question-item" key={question.id}>
                    <div className="question-label-row">
                      <span className="question-number">0{qIdx + 1}</span>
                      <label className="question-prompt">{question.prompt}</label>
                    </div>

                    {question.options && question.options.length > 0 && (
                      <div className="options-chip-group">
                        {question.options.map((option: string) => {
                          const isSelected = answers[question.id] === option;
                          return (
                            <button
                              key={option}
                              type="button"
                              className={`option-chip ${isSelected ? "option-chip-selected" : ""}`}
                              onClick={() =>
                                setAnswers((current) => ({ ...current, [question.id]: option }))
                              }
                            >
                              {isSelected && <span className="chip-check-dot" />}
                              <span>{option}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {question.allow_text && (
                      <div style={{ marginTop: question.options && question.options.length > 0 ? "0.25rem" : "0" }}>
                        <input
                          className="styled-preference-input"
                          value={answers[question.id] || ""}
                          onChange={(event) =>
                            setAnswers((current) => ({
                              ...current,
                              [question.id]: event.target.value,
                            }))
                          }
                          placeholder={
                            question.options && question.options.length > 0
                              ? "Or enter custom answer..."
                              : "Enter your answer (e.g. city, dates, or details)..."
                          }
                          aria-label={question.prompt}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="preference-actions-footer">
                <button
                  type="button"
                  className="continue-planning-btn"
                  onClick={submitPreferences}
                  disabled={!preferenceQuestions.every((question) => answers[question.id]?.trim())}
                >
                  <span>Continue Planning</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}


          {/* Destinations grid if available and not yet selected */}
          {hasDestinations && !destinationChosen && (
            <div className="space-y-4">
              <h2
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#728095",
                }}
              >
                Candidate Destinations
              </h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "1rem",
                }}
              >
                {destinations.map((dest) => (
                  <DestinationCard
                    key={dest.id}
                    destination={dest}
                    onSelect={handleSelectDestination}
                    isSelected={selectedDestId === dest.id}
                  />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}