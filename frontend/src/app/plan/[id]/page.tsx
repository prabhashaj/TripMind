"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTripStore } from "@/store/trip-store";
import { createTripSSEClient } from "@/lib/sse-client";
import { AgentActionShimmer } from "@/components/AgentActionShimmer";
import { PlanningProgressBar } from "@/components/PlanningProgressBar";
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
    <div className="plan-workspace">
      {/* Top bar styled according to classical theme */}
      <header className="classical-nav">
        <div className="plan-header-inner">
          <div className="plan-header-left">
            <Link href="/" className="classical-brand">
              <div className="classical-brand-mark">
                <Map className="w-3.5 h-3.5" />
              </div>
              <span>TripMind</span>
            </Link>
            <span className="plan-breadcrumb">/</span>
            <span className="plan-breadcrumb-label">
              Multi-Agent Planning
            </span>
          </div>

          <div className="plan-header-right">
            {tripState?.planning_status === "awaiting_preference_answers" ? (
              <div className="plan-status-pill plan-status-pill--waiting">
                <span className="plan-status-dot" />
                <span className="plan-status-text--waiting">
                  Waiting for your answers
                </span>
              </div>
            ) : isPlanning ? (
              <div className="plan-status-pill plan-status-pill--planning">
                <span className="plan-status-dot plan-status-dot--pulse" />
                <span className="plan-status-text--planning">
                  Agents Planning
                </span>
              </div>
            ) : (
              <div className="plan-status-pill plan-status-pill--done">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span className="plan-status-text--done">
                  Trip Ready
                </span>
              </div>
            )}
            <Link href="/" className="plan-new-trip-btn">
              <ArrowLeft className="w-3.5 h-3.5" />
              New trip
            </Link>
          </div>
        </div>
      </header>

      {/* Body: centered single canvas */}
      <div className="plan-body">
        <main className="plan-main">
          {/* Unified planning progress bar driven by real SSE agent events */}
          <PlanningProgressBar />

          {/* Section header */}
          <div className="plan-section-header">
            <div className="plan-section-badge">
              <MapPin className="w-3.5 h-3.5 text-amber-600" />
              <span className="plan-section-badge-text">
                {destinationChosen
                  ? "Parallel Research Node Active"
                  : hasDestinations
                  ? "Destinations Discovered"
                  : preferenceQuestions.length > 0
                  ? "Details Needed"
                  : "Multi-Agent Planning In Progress"}
              </span>
            </div>
            <h1 className="plan-section-title font-display">
              {destinationChosen
                ? "Synthesizing Flights, Hotels & Experiences"
                : hasDestinations
                ? "Select your destination"
                : preferenceQuestions.length > 0
                ? "A few quick questions"
                : "Discovering your ideal itinerary"}
            </h1>
            <p className="plan-section-sub">
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
            <div className="plan-error-banner">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
              <div>
                <p className="plan-error-title">
                  Planning Issue Encountered
                </p>
                <p className="plan-error-body">
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
                      <label className="question-prompt">{question.prompt || question.question}</label>
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
                      <div className={question.options && question.options.length > 0 ? "mt-1" : ""}>
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
              <h2 className="plan-destinations-label">
                Candidate Destinations
              </h2>
              <div className="plan-destinations-grid">
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