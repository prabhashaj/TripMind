"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTripStore } from "@/store/trip-store";
import { createTripSSEClient } from "@/lib/sse-client";
import { api } from "@/lib/api";
import { TransportCard } from "@/components/TransportCard";
import { HotelCard } from "@/components/HotelCard";
import { ItineraryTimeline } from "@/components/ItineraryTimeline";
import { BudgetCard } from "@/components/BudgetCard";
import { AskAIPanel } from "@/components/AskAIPanel";
import { computeBudgetTotal, formatINR } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarDays,
  Plane,
  Hotel,
  MapPin,
  Wallet,
  FileText,
  Sparkles,
  ShieldCheck,
  Users,
  Map,
  Loader2,
  Clock,
  Star,
  ExternalLink,
  ArrowLeft,
  Share2,
  Printer,
  Check,
  Compass,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { TravelImage } from "@/components/TravelImage";
import { AgentActionShimmer } from "@/components/AgentActionShimmer";

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "itinerary", label: "Itinerary", icon: CalendarDays },
  { key: "transport", label: "Flights & Transit", icon: Plane },
  { key: "hotels", label: "Stays & Hotels", icon: Hotel },
  { key: "activities", label: "Experiences", icon: MapPin },
  { key: "budget", label: "Budget Tracker", icon: Wallet },
  { key: "sources", label: "Verified Data", icon: FileText },
  { key: "ai", label: "AI Trip Copilot", icon: Sparkles },
] as const;

const DESTINATION_IMAGES: Record<string, string> = {
  srinagar: "https://images.unsplash.com/photo-1598091383021-15ddea10925d?w=1200&auto=format&fit=crop&q=80",
  kashmir: "https://images.unsplash.com/photo-1598091383021-15ddea10925d?w=1200&auto=format&fit=crop&q=80",
  goa: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1200&auto=format&fit=crop&q=80",
  coorg: "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1200&auto=format&fit=crop&q=80",
  udaipur: "https://images.unsplash.com/photo-1609137144813-7d9921338f24?w=1200&auto=format&fit=crop&q=80",
  kyoto: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200&auto=format&fit=crop&q=80",
  tokyo: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1200&auto=format&fit=crop&q=80",
  amalfi: "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=1200&auto=format&fit=crop&q=80",
  default: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&auto=format&fit=crop&q=80",
};

function getDestinationImage(name?: string): string {
  if (!name) return DESTINATION_IMAGES.default;
  const lower = name.toLowerCase();
  for (const [k, url] of Object.entries(DESTINATION_IMAGES)) {
    if (lower.includes(k)) return url;
  }
  return DESTINATION_IMAGES.default;
}

const ACTIVITY_IMAGES: Record<string, string> = {
  gondola: "https://images.unsplash.com/photo-1551524559-8af4e6624178?w=600&auto=format&fit=crop&q=80",
  cable: "https://images.unsplash.com/photo-1551524559-8af4e6624178?w=600&auto=format&fit=crop&q=80",
  shikara: "https://images.unsplash.com/photo-1598091383021-15ddea10925d?w=600&auto=format&fit=crop&q=80",
  boat: "https://images.unsplash.com/photo-1598091383021-15ddea10925d?w=600&auto=format&fit=crop&q=80",
  houseboat: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80",
  garden: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=600&auto=format&fit=crop&q=80",
  mughal: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=600&auto=format&fit=crop&q=80",
  food: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80",
  dining: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=80",
  wazwan: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=600&auto=format&fit=crop&q=80",
  barbeque: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80",
  museum: "https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?w=600&auto=format&fit=crop&q=80",
  heritage: "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=600&auto=format&fit=crop&q=80",
  trek: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&auto=format&fit=crop&q=80",
  default: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&auto=format&fit=crop&q=80",
};

function getActivityImage(name?: string, desc?: string): string {
  const combined = `${name || ""} ${desc || ""}`.toLowerCase();
  for (const [k, url] of Object.entries(ACTIVITY_IMAGES)) {
    if (combined.includes(k)) return url;
  }
  return ACTIVITY_IMAGES.default;
}

export default function TripWorkspacePage() {
  const params = useParams();
  const tripId = params.id as string;
  const { tripState, isPlanning, selectedPanel, selectedDayIndex, setTripId, handleEvent, selectPanel, selectDay } = useTripStore();
  const sseRef = useRef<ReturnType<typeof createTripSSEClient> | null>(null);
  const [copied, setCopied] = useState(false);
  const [transportFilter, setTransportFilter] = useState<"all" | "flight" | "train">("all");
  const [transportSort, setTransportSort] = useState<"recommended" | "price" | "duration">("recommended");

  useEffect(() => {
    if (!tripId) return;
    setTripId(tripId);
    const client = createTripSSEClient(tripId).on("*", handleEvent).connect();
    sseRef.current = client;
    api.getTrip(tripId).then((s) => useTripStore.getState().setTripState(s)).catch(console.error);
    return () => client.disconnect();
  }, [tripId, setTripId, handleEvent]);

  const trip = tripState;
  const dest = trip?.selected_destination;
  const days = trip?.itinerary?.days || [];
  const transports = trip?.transport?.intercity || [];
  const visibleTransports = [...transports]
    .filter((leg) => transportFilter === "all" || leg.mode === transportFilter)
    .sort((a, b) => {
      if (transportSort === "price") return a.price - b.price;
      if (transportSort === "duration") return (a.duration_minutes || Infinity) - (b.duration_minutes || Infinity);
      return 0;
    });
  const hotels = trip?.hotels?.options || [];
  const activities = trip?.activities || [];

  const totalCost = computeBudgetTotal(trip?.budget);
  const targetBudget = trip?.budget_amount || 0;
  const isOverBudget = targetBudget > 0 && totalCost > targetBudget;

  const countBadge = (key: string) => {
    if (key === "transport") return transports.length || 0;
    if (key === "hotels") return hotels.length || 0;
    if (key === "activities") return activities.length || 0;
    return 0;
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg-base)", color: "var(--color-text-primary)", display: "flex", flexDirection: "column" }}>

      {/* ── Top Header Bar ────────────────────────────────────────── */}
      <header className="classical-nav">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 1.5rem", height: "3.75rem", gap: "1rem", maxWidth: "1400px", margin: "0 auto" }}>

          {/* Left: Brand & Destination */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", minWidth: 0 }}>
            <Link href="/" className="classical-brand" style={{ textDecoration: "none", fontSize: "1.3rem" }}>
              <div className="classical-brand-mark" style={{ width: "2.1rem", height: "2.1rem" }}>
                <Map className="w-3.5 h-3.5" />
              </div>
              <span>TripMind</span>
            </Link>

            <span style={{ color: "#c5b99f" }}>/</span>

            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "0.9375rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
                {dest ? dest.name : "Your Trip Workspace"}
              </p>
              {trip && (
                <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  <span>{trip.travelers?.adults || 1} Adult{(trip.travelers?.adults || 1) > 1 ? "s" : ""}</span>
                  <span>•</span>
                  <span>{trip.dates?.duration_days || days.length || 7} Days</span>
                  {trip.budget_amount ? (
                    <>
                      <span>•</span>
                      <span>Target: {formatINR(trip.budget_amount)}</span>
                    </>
                  ) : null}
                </p>
              )}
            </div>
          </div>

          {/* Right: Status & Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexShrink: 0 }}>
            {isPlanning && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.4375rem", padding: "0.3125rem 0.75rem", borderRadius: "99px", background: "rgba(139, 92, 246 / 0.15)", border: "1px solid rgba(139, 92, 246 / 0.3)" }}>
                <AgentActionShimmer compact />
              </div>
            )}

            {trip?.verification?.overall_status && (
              <div style={{
                display: "flex", alignItems: "center", gap: "0.375rem",
                padding: "0.3125rem 0.75rem", borderRadius: "99px",
                background: trip.verification.overall_status === "passed" ? "rgba(16, 185, 129, 0.12)" : "rgba(251, 191, 36, 0.12)",
                border: `1px solid ${trip.verification.overall_status === "passed" ? "rgba(16, 185, 129, 0.3)" : "rgba(251, 191, 36, 0.3)"}`,
              }}>
                <ShieldCheck className="w-3.5 h-3.5" style={{ color: trip.verification.overall_status === "passed" ? "var(--color-success)" : "var(--color-warning)" }} />
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: trip.verification.overall_status === "passed" ? "var(--color-success)" : "var(--color-warning)" }}>
                  {trip.verification.overall_status === "passed" ? "Verified Feasible" : trip.verification.overall_status}
                </span>
              </div>
            )}

            {/* Total Budget Pill */}
            <div style={{ padding: "0.3125rem 0.875rem", borderRadius: "0.5rem", background: "var(--color-bg-card)", border: isOverBudget ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid var(--color-border)", textAlign: "right" }}>
              <p style={{ fontSize: "0.875rem", fontWeight: 700, color: isOverBudget ? "var(--color-error)" : "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>
                {formatINR(totalCost)}
              </p>
              <p style={{ fontSize: "0.625rem", color: "var(--color-text-muted)", fontWeight: 500 }}>
                {targetBudget > 0 ? (isOverBudget ? "Over Budget" : "Est. Total") : "Est. Total"}
              </p>
            </div>

            {/* Export / Print PDF */}
            <button
              onClick={() => typeof window !== "undefined" && window.print()}
              className="btn btn-ghost"
              style={{ fontSize: "0.8125rem", padding: "0.375rem 0.625rem" }}
              title="Print or Save Itinerary as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export PDF</span>
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="btn btn-ghost"
              style={{ fontSize: "0.8125rem", padding: "0.375rem 0.625rem" }}
              title="Copy trip link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
            </button>

            {/* New Trip */}
            <Link
              href="/"
              className="btn btn-ghost"
              style={{ fontSize: "0.8125rem", padding: "0.375rem 0.75rem", border: "1px solid var(--color-border)" }}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              New Trip
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Workspace Layout ─────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Sidebar Navigation ──────────────────────────────────── */}
        <aside style={{
          width: "240px",
          flexShrink: 0,
          borderRight: "1px solid var(--color-border)",
          background: "var(--color-bg-surface))",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: "3.75rem",
          height: "calc(100vh - 3.75rem)",
          overflowY: "auto",
        }}>

          {/* Main Navigation Items */}
          <nav style={{ padding: "0.875rem 0.625rem", flex: 1 }}>
            <p style={{ fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)", padding: "0 0.75rem 0.5rem" }}>
              Trip Plan
            </p>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = selectedPanel === item.key;
              const count = countBadge(item.key);
              return (
                <button
                  key={item.key}
                  onClick={() => selectPanel(item.key)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.5625rem 0.75rem",
                    borderRadius: "0.5rem",
                    marginBottom: "0.1875rem",
                    fontSize: "0.875rem",
                    fontWeight: isActive ? 600 : 400,
                    background: isActive ? "rgba(139, 92, 246, 0.1)" : "transparent",
                    border: isActive ? "1px solid rgba(139, 92, 246 / 0.25)" : "1px solid transparent",
                    color: isActive ? "var(--color-primary-600)" : "var(--color-text-secondary)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    textAlign: "left",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                    <Icon style={{ width: "1.0625rem", height: "1.0625rem", flexShrink: 0 }} />
                    <span>{item.label}</span>
                  </div>
                  {count > 0 && (
                    <span style={{
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      padding: "0.125rem 0.4375rem",
                      borderRadius: "99px",
                      background: isActive ? "rgba(139, 92, 246 / 0.25)" : "var(--color-bg-elevated)",
                      color: isActive ? "var(--color-primary-600)" : "var(--color-text-muted)",
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom Copilot Card (Replaces raw agent internals) */}
          <div style={{ borderTop: "1px solid var(--color-border)", padding: "0.875rem", paddingBottom: "2.75rem" }}>
            <div style={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: "0.75rem", padding: "0.875rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--color-text-primary)" }}>Trip Concierge</span>
              </div>
              <p style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", lineHeight: 1.5, marginBottom: "0.625rem" }}>
                Need adjustments? Tell our AI to swap hotels, add sights, or tune budget.
              </p>
              <button
                onClick={() => selectPanel("ai")}
                className="btn btn-primary"
                style={{ width: "100%", fontSize: "0.75rem", padding: "0.375rem 0.5rem", justifyContent: "center" }}
              >
                Ask Copilot
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main Content Area ───────────────────────────────────── */}
        <main style={{ flex: 1, overflowY: "auto", padding: "2rem", maxWidth: "980px" }}>

          {/* ── Overview Tab ─────────────────────────────────────── */}
          {selectedPanel === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>

              {/* Destination Hero Banner */}
              {dest && (
                <div style={{
                  position: "relative",
                  borderRadius: "1rem",
                  overflow: "hidden",
                  border: "1px solid var(--color-border)",
                  minHeight: "220px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  padding: "1.75rem",
                  boxShadow: "var(--shadow-card)",
                }}>
                  {/* Background Image */}
                  <TravelImage
                    src={dest.image_url || getDestinationImage(dest.name)}
                    alt={dest.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {/* Dark gradient overlay for perfect readability */}
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(to top, rgba(9, 10, 15, 0.95) 0%, rgba(9, 10, 15, 0.55) 60%, rgba(9, 10, 15, 0.3) 100%)",
                  }} />

                  {/* Content over image */}
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
                      <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "0.1875rem 0.5rem", borderRadius: "99px", background: "rgba(139, 92, 246 / 0.3)", backdropFilter: "blur(8px)", border: "1px solid rgba(139, 92, 246 / 0.4)", color: "var(--color-primary-400)" }}>
                        Selected Destination
                      </span>
                    </div>

                    <h1 className="font-display" style={{ fontSize: "2rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", marginBottom: "0.25rem" }}>
                      {dest.name}
                    </h1>

                    <p style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.85)", display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: "0.875rem" }}>
                      <MapPin className="w-3.5 h-3.5 text-amber-700" />
                      {[dest.state, dest.country].filter(Boolean).join(", ")}
                    </p>

                    <p style={{ fontSize: "0.875rem", color: "rgba(255, 255, 255, 0.9)", lineHeight: 1.65, maxWidth: "720px" }}>
                      {dest.description}
                    </p>
                  </div>
                </div>
              )}

              {/* 4 Metric Cards (shadcn style) */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
                {[
                  {
                    label: "Total Duration",
                    value: `${trip?.dates?.duration_days || days.length || 7} Days`,
                    sub: "Day-by-day planned",
                    Icon: CalendarDays,
                    color: "text-amber-700",
                  },
                  {
                    label: "Travelers",
                    value: `${trip?.travelers?.adults || 1} Adult${(trip?.travelers?.adults || 1) > 1 ? "s" : ""}`,
                    sub: "Optimized per person",
                    Icon: Users,
                    color: "text-sky-400",
                  },
                  {
                    label: "Budget Estimate",
                    value: formatINR(totalCost),
                    sub: targetBudget > 0 ? `Target: ${formatINR(targetBudget)}` : "All inclusive",
                    Icon: Wallet,
                    color: "text-emerald-400",
                  },
                  {
                    label: "Curated Experiences",
                    value: `${activities.length} Sourced`,
                    sub: `${hotels.length} Stays & ${transports.length} Routes`,
                    Icon: MapPin,
                    color: "text-orange-400",
                  },
                ].map(({ label, value, sub, Icon, color }, i) => (
                  <div key={i} className="card" style={{ padding: "1.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", fontWeight: 500 }}>{label}</span>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <p style={{ fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", color: "var(--color-text-primary)", marginBottom: "0.125rem" }}>
                      {value}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{sub}</p>
                  </div>
                ))}
              </div>

              {/* Timeline Preview */}
              {days.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                    <div>
                      <h2 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Timeline Preview</h2>
                      <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)" }}>Click any day to inspect the full schedule.</p>
                    </div>
                    <button
                      onClick={() => selectPanel("itinerary")}
                      className="btn btn-ghost"
                      style={{ fontSize: "0.8125rem", color: "var(--color-primary-600)" }}
                    >
                      View full itinerary <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <ItineraryTimeline days={days} selectedDayIndex={selectedDayIndex} onSelectDay={selectDay} />
                </div>
              )}
            </div>
          )}

          {/* ── Itinerary Tab ─────────────────────────────────────── */}
          {selectedPanel === "itinerary" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <SectionHeader
                title="Day-by-Day Itinerary"
                subtitle="Curated schedule mapped with realistic transit times, activities, meals, and rest."
              />
              {days.length > 0 ? (
                <ItineraryTimeline
                  days={days}
                  selectedDayIndex={selectedDayIndex}
                  onSelectDay={selectDay}
                  allActivities={activities}
                  allHotels={hotels}
                  destinationName={dest?.name}
                  selectedHotelId={trip?.hotels?.selected_id || hotels[0]?.id}
                />
              ) : (
                <EmptyState message="Designing your day-by-day journey..." isLoading={isPlanning} />
              )}
            </div>
          )}

          {/* ── Transport Tab ─────────────────────────────────────── */}
          {selectedPanel === "transport" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <SectionHeader
                title="Flights & Transport"
                subtitle={trip?.transport?.provider_available ? "Compare available routes by price, time, and stops." : "Estimated routes. Connect a live provider for current prices and availability."}
              />
              {transports.length > 0 ? (
                <>
                  <div className="transport-toolbar">
                    <div className="option-row">
                      {[{ value: "all", label: "All routes" }, { value: "flight", label: "Flights" }, { value: "train", label: "Trains" }].map((option) => (
                        <button key={option.value} type="button" className={`choice ${transportFilter === option.value ? "selected" : ""}`} onClick={() => setTransportFilter(option.value as typeof transportFilter)}>{option.label}</button>
                      ))}
                    </div>
                    <label className="transport-sort">Sort by
                      <select value={transportSort} onChange={(event) => setTransportSort(event.target.value as typeof transportSort)}>
                        <option value="recommended">Recommended</option><option value="price">Lowest price</option><option value="duration">Shortest journey</option>
                      </select>
                    </label>
                  </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {visibleTransports.map((leg) => (
                    <TransportCard
                      key={leg.id}
                      leg={leg}
                      onSelect={async (id) => {
                        await api.selectTransport(tripId, id);
                      }}
                      isSelected={trip?.transport?.selected_intercity_id === leg.id}
                    />
                  ))}
                </div>
                </>
              ) : (
                <EmptyState message="Searching live flight and rail routes..." isLoading={isPlanning} />
              )}
            </div>
          )}

          {/* ── Hotels Tab ────────────────────────────────────────── */}
          {selectedPanel === "hotels" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <SectionHeader
                title="Stays & Accommodations"
                subtitle="Verified boutique stays matching your preferred vibe and budget."
              />
              {hotels.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: "1.25rem" }}>
                  {hotels.map((hotel) => (
                    <HotelCard
                      key={hotel.id}
                      hotel={hotel}
                      onSelect={async (id) => {
                        await api.selectHotel(tripId, id);
                      }}
                      isSelected={trip?.hotels?.selected_id === hotel.id}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState message="Finding curated accommodations..." isLoading={isPlanning} />
              )}
            </div>
          )}

          {/* ── Activities Tab (Photo-Rich Experiences) ───────────── */}
          {selectedPanel === "activities" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <SectionHeader
                title="Curated Experiences & Sights"
                subtitle="Top attractions, scenic excursions, and local dining recommendations."
              />
              {activities.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: "1.25rem" }}>
                  {activities.map((activity) => {
                    const photo = activity.image_url || getActivityImage(activity.name, activity.description);
                    return (
                      <div
                        key={activity.id}
                        className="card"
                        style={{
                          overflow: "hidden",
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        {/* Photo container */}
                        <div style={{ position: "relative", height: "150px", overflow: "hidden", background: "var(--color-bg-elevated)" }}>
                          <TravelImage src={photo} alt={activity.name} className="w-full h-full object-cover" />
                          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(10, 11, 15, 0.8) 0%, transparent 60%)" }} />

                          {activity.rating && (
                            <div style={{
                              position: "absolute", top: "0.625rem", right: "0.625rem",
                              display: "flex", alignItems: "center", gap: "0.25rem",
                              padding: "0.2rem 0.5rem", borderRadius: "99px",
                              background: "rgba(10, 11, 15, 0.8)", backdropFilter: "blur(6px)",
                              border: "1px solid rgba(255, 255, 255, 0.15)",
                            }}>
                              <Star className="w-3 h-3 fill-orange-400 text-orange-400" />
                              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#fff" }}>
                                {activity.rating.toFixed(1)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div style={{ padding: "1rem", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "0.75rem" }}>
                          <div>
                            <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--color-text-primary)", lineHeight: 1.3, marginBottom: "0.25rem" }}>
                              {activity.name}
                            </h4>
                            <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                              <MapPin className="w-3 h-3 text-amber-700 shrink-0" />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activity.location}</span>
                            </p>
                            <p style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", lineHeight: 1.6, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                              {activity.description}
                            </p>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "0.75rem", borderTop: "1px solid var(--color-border)", fontSize: "0.75rem" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "var(--color-text-muted)" }}>
                              <Clock className="w-3.5 h-3.5" />
                              {activity.duration_hours ? `${activity.duration_hours}h` : "Flexible"}
                            </span>
                            <span style={{ fontWeight: 700, color: activity.price_per_person > 0 ? "var(--color-text-primary)" : "var(--color-success)" }}>
                              {activity.price_per_person > 0 ? `${formatINR(activity.price_per_person)}/person` : "Free Experience"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState message="Curating top experiences and dining..." isLoading={isPlanning} />
              )}
            </div>
          )}

          {/* ── Budget Tab ────────────────────────────────────────── */}
          {selectedPanel === "budget" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "600px" }}>
              <SectionHeader
                title="Itemized Budget Breakdown"
                subtitle="Complete visibility into all expenses with zero hidden fees."
              />
              {trip?.budget ? (
                <BudgetCard budget={trip.budget} targetBudget={trip.budget_amount} />
              ) : (
                <EmptyState message="Calculating itemized budget..." isLoading={isPlanning} />
              )}
            </div>
          )}

          {/* ── Sources Tab ───────────────────────────────────────── */}
          {selectedPanel === "sources" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <SectionHeader
                title="Verified Data & Sources"
                subtitle="Every pricing and flight recommendation is backed by real-time web intelligence."
              />
              {trip?.sources && trip.sources.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                  {trip.sources.map((source) => (
                    <a
                      key={source.id}
                      href={source.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="card"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "1rem",
                        padding: "1rem 1.25rem",
                        textDecoration: "none",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {source.title}
                        </p>
                        <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                          {source.provider} <span style={{ margin: "0 0.25rem" }}>·</span>
                          <span style={{ color: "var(--color-primary-500)", textTransform: "uppercase", fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.06em" }}>
                            {source.data_category}
                          </span>
                        </p>
                      </div>
                      <ExternalLink className="w-4 h-4 shrink-0 text-gray-400" />
                    </a>
                  ))}
                </div>
              ) : (
                <EmptyState message="Aggregating live source links..." isLoading={isPlanning} />
              )}
            </div>
          )}

          {/* ── AI Copilot Tab ────────────────────────────────────── */}
          {selectedPanel === "ai" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxWidth: "740px" }}>
              <SectionHeader
                title="AI Trip Copilot"
                subtitle="Fine-tune your itinerary in plain English. Ask for pace changes, cheaper stays, or custom spots."
              />
              <AskAIPanel tripId={tripId} />
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: "0.25rem" }}>
      <h2 className="font-display" style={{ fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: subtitle ? "0.25rem" : 0 }}>
        {title}
      </h2>
      {subtitle && <p style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>{subtitle}</p>}
    </div>
  );
}

function EmptyState({ message, isLoading }: { message: string; isLoading?: boolean }) {
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem 2rem", textAlign: "center", border: "1px dashed var(--color-border)", gap: "0.875rem" }}>
      {isLoading ? (
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "var(--color-primary-500)" }} />
      ) : (
        <Compass className="w-7 h-7" style={{ color: "var(--color-text-muted)" }} />
      )}
      <p style={{ fontSize: "0.9375rem", color: "var(--color-text-secondary)" }}>{message}</p>
    </div>
  );
}
