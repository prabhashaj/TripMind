"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTripStore } from "@/store/trip-store";
import { createTripSSEClient } from "@/lib/sse-client";
import { api } from "@/lib/api";
import { TransportCard } from "@/components/TransportCard";
import { HotelCard } from "@/components/HotelCard";
import { ActivityCard } from "@/components/ActivityCard";
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
import { TripMap, type MapPoint } from "@/components/TripMap";

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

  const mapPoints: MapPoint[] = [];
  days.forEach((day, idx) => {
    if (selectedDayIndex !== null && selectedDayIndex !== idx) return;
    day.items.forEach((item) => {
      let lat = undefined;
      let lng = undefined;
      let type: "hotel" | "activity" | "destination" | undefined = undefined;

      if (item.hotel_id) {
        const h = hotels.find((x) => x.id === item.hotel_id);
        if (h && h.latitude && h.longitude) {
          lat = h.latitude;
          lng = h.longitude;
          type = "hotel";
        }
      } else if (item.activity_id) {
        const a = activities.find((x) => x.id === item.activity_id);
        if (a && a.latitude && a.longitude) {
          lat = a.latitude;
          lng = a.longitude;
          type = "activity";
        }
      }

      if (lat !== undefined && lng !== undefined && type) {
        mapPoints.push({
          id: item.id,
          name: item.title,
          lat,
          lng,
          type,
          day_index: day.day_number,
        });
      }
    });
  });
  if (mapPoints.length === 0 && dest?.latitude && dest?.longitude) {
    mapPoints.push({
      id: dest.id || "dest",
      name: dest.name,
      lat: dest.latitude,
      lng: dest.longitude,
      type: "destination",
    });
  }

  return (
    <div className="trip-workspace">

      {/* ── Top Header Bar ────────────────────────────────────────── */}
      <header className="classical-nav">
        <div className="trip-header-inner">

          {/* Left: Brand & Destination */}
          <div className="trip-header-left">
            <Link href="/" className="classical-brand">
              <div className="classical-brand-mark">
                <Map className="w-3.5 h-3.5" />
              </div>
              <span>TripMind</span>
            </Link>

            <span className="plan-breadcrumb">/</span>

            <div className="min-w-0">
              <p className="trip-dest-name">
                {dest ? dest.name : "Your Trip Workspace"}
              </p>
              {trip && (
                <p className="trip-dest-meta">
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
          <div className="trip-header-right">
            {isPlanning && (
              <div className="trip-status-pill trip-status-pill--planning">
                <AgentActionShimmer compact />
              </div>
            )}

            {trip?.verification?.overall_status && (
              <div className={`trip-status-pill ${trip.verification.overall_status === "passed" ? "trip-status-pill--verified" : "trip-status-pill--warning"}`}>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">
                  {trip.verification.overall_status === "passed" ? "Verified Feasible" : trip.verification.overall_status}
                </span>
              </div>
            )}

            {/* Total Budget Pill */}
            <div className={`trip-budget-pill ${isOverBudget ? "trip-budget-pill--over" : ""}`}>
              <p className={`trip-budget-amount ${isOverBudget ? "trip-budget-amount--over" : ""}`}>
                {formatINR(totalCost)}
              </p>
              <p className="trip-budget-label">
                {targetBudget > 0 ? (isOverBudget ? "Over Budget" : "Est. Total") : "Est. Total"}
              </p>
            </div>

            {/* Export / Print PDF */}
            <button
              onClick={() => typeof window !== "undefined" && window.print()}
              className="btn btn-ghost text-xs py-1.5 px-2.5"
              title="Print or Save Itinerary as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export PDF</span>
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="btn btn-ghost text-xs py-1.5 px-2.5"
              title="Copy trip link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
            </button>

            {/* New Trip */}
            <Link
              href="/"
              className="btn btn-ghost text-xs py-1.5 px-3 border border-border"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              New Trip
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Workspace Layout ─────────────────────────────────── */}
      <div className="trip-layout">

        {/* ── Sidebar Navigation ──────────────────────────────────── */}
        <aside className="trip-sidebar">

          {/* Main Navigation Items */}
          <nav className="trip-sidebar-nav">
            <p className="trip-sidebar-section-label">
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
                  className={`trip-nav-btn ${isActive ? "trip-nav-btn--active" : ""}`}
                >
                  <div className="trip-nav-btn-inner">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {count > 0 && (
                    <span className={`trip-nav-count ${isActive ? "trip-nav-count--active" : "trip-nav-count--default"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom Copilot Card */}
          <div className="trip-sidebar-concierge">
            <div className="trip-concierge-card">
              <div className="trip-concierge-header">
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span className="trip-concierge-title">Trip Concierge</span>
              </div>
              <p className="trip-concierge-body">
                Need adjustments? Tell our AI to swap hotels, add sights, or tune budget.
              </p>
              <button
                onClick={() => selectPanel("ai")}
                className="btn btn-primary w-full text-xs py-1.5 px-2 justify-center"
              >
                Ask Copilot
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main Content Area ───────────────────────────────────── */}
        <main className="trip-main">

          {/* ── Overview Tab ─────────────────────────────────────── */}
          {selectedPanel === "overview" && (
            <div className="trip-section--overview">

              {/* Destination Hero Banner */}
              {dest && (
                <div className="trip-dest-hero">
                  <TravelImage
                    src={dest.image_url || getDestinationImage(dest.name)}
                    alt={dest.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="trip-dest-hero-overlay" />

                  <div className="trip-dest-hero-content">
                    <span className="trip-dest-hero-tag">
                      Selected Destination
                    </span>

                    <h1 className="trip-dest-hero-name font-display">
                      {dest.name}
                    </h1>

                    <p className="trip-dest-hero-location">
                      <MapPin className="w-3.5 h-3.5 text-amber-700" />
                      {[dest.state, dest.country].filter(Boolean).join(", ")}
                    </p>

                    <p className="trip-dest-hero-desc">
                      {dest.description}
                    </p>
                  </div>
                </div>
              )}

              {/* 4 Metric Cards */}
              <div className="trip-metrics-grid">
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
                  <div key={i} className="trip-metric-card">
                    <div className="trip-metric-header">
                      <span className="trip-metric-label">{label}</span>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <p className="trip-metric-value">
                      {value}
                    </p>
                    <p className="trip-metric-sub">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Timeline Preview */}
              {days.length > 0 && (
                <div>
                  <div className="trip-timeline-header">
                    <div>
                      <h2 className="trip-timeline-title">Timeline Preview</h2>
                      <p className="trip-timeline-sub">Click any day to inspect the full schedule.</p>
                    </div>
                    <button
                      onClick={() => selectPanel("itinerary")}
                      className="btn btn-ghost text-xs text-primary-600"
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
            <div className="trip-section">
              <SectionHeader
                title="Day-by-Day Itinerary"
                subtitle="Curated schedule mapped with realistic transit times, activities, meals, and rest."
              />
              {days.length > 0 ? (
                <div className="trip-itinerary-grid">
                  <div className="min-w-0">
                    <ItineraryTimeline
                      days={days}
                      selectedDayIndex={selectedDayIndex}
                      onSelectDay={selectDay}
                      allActivities={activities}
                      allHotels={hotels}
                      destinationName={dest?.name}
                      selectedHotelId={trip?.hotels?.selected_id || hotels[0]?.id}
                    />
                  </div>
                  <div className="trip-map-sticky">
                    <TripMap points={mapPoints} />
                  </div>
                </div>
              ) : (
                <EmptyState message="Designing your day-by-day journey..." isLoading={isPlanning} />
              )}
            </div>
          )}

          {/* ── Transport Tab ─────────────────────────────────────── */}
          {selectedPanel === "transport" && (
            <div className="trip-section">
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
                  <div className="trip-transport-list">
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
            <div className="trip-section">
              <SectionHeader
                title="Stays & Accommodations"
                subtitle="Verified boutique stays matching your preferred vibe and budget."
              />
              {hotels.length > 0 ? (
                <div className="trip-cards-grid">
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
            <div className="trip-section">
              <SectionHeader
                title="Curated Experiences & Sights"
                subtitle="Top attractions, scenic excursions, and local dining recommendations."
              />
              {activities.length > 0 ? (
                <div className="trip-cards-grid">
                  {activities.map((activity) => (
                    <ActivityCard key={activity.id} activity={activity} />
                  ))}
                </div>
              ) : (
                <EmptyState message="Curating top experiences and dining..." isLoading={isPlanning} />
              )}
            </div>
          )}

          {/* ── Budget Tab ────────────────────────────────────────── */}
          {selectedPanel === "budget" && (
            <div className="trip-section trip-section--budget">
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
            <div className="trip-section">
              <SectionHeader
                title="Verified Data & Sources"
                subtitle="Every pricing and flight recommendation is backed by real-time web intelligence."
              />
              {trip?.sources && trip.sources.length > 0 ? (
                <div className="trip-transport-list">
                  {trip.sources.map((source) => (
                    <a
                      key={source.id}
                      href={source.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="trip-source-link"
                    >
                      <div className="min-w-0">
                        <p className="trip-source-title">{source.title}</p>
                        <p className="trip-source-meta">
                          {source.provider} <span className="mx-1">·</span>
                          <span className="trip-source-category">{source.data_category}</span>
                        </p>
                      </div>
                      <ExternalLink className="w-4 h-4 shrink-0 text-muted-foreground" />
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
            <div className="trip-section trip-section--ai">
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
    <div className="trip-section-header">
      <h2 className="trip-section-title font-display">{title}</h2>
      {subtitle && <p className="trip-section-subtitle">{subtitle}</p>}
    </div>
  );
}

function EmptyState({ message, isLoading }: { message: string; isLoading?: boolean }) {
  return (
    <div className="trip-empty-state">
      {isLoading ? (
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      ) : (
        <Compass className="w-7 h-7 text-muted-foreground" />
      )}
      <p className="trip-empty-state-text">{message}</p>
    </div>
  );
}

