"use client";

import type { ItineraryDay, ItineraryItem } from "@/lib/api";
import { formatINR } from "@/lib/utils";
import { Clock, MapPin, Sparkles } from "lucide-react";

interface ItineraryTimelineProps {
  days: ItineraryDay[];
  selectedDayIndex: number;
  onSelectDay: (index: number) => void;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  transport: { icon: "AIR", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)", label: "Flight / Transit" },
  flight: { icon: "AIR", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)", label: "Flight" },
  check_in: { icon: "STAY", color: "#a77a2b", bg: "rgba(167, 122, 43, 0.12)", label: "Hotel Check-In" },
  check_out: { icon: "STAY", color: "#a77a2b", bg: "rgba(167, 122, 43, 0.12)", label: "Hotel Check-Out" },
  activity: { icon: "ACT", color: "#10b981", bg: "rgba(16, 185, 129, 0.12)", label: "Experience" },
  meal: { icon: "FOOD", color: "#ef4444", bg: "rgba(239, 68, 68, 0.12)", label: "Dining" },
  rest: { icon: "REST", color: "#6b7280", bg: "rgba(107, 114, 128, 0.1)", label: "Rest / Leisure" },
  free_time: { icon: "FREE", color: "#c9aa6c", bg: "rgba(201, 170, 108, 0.12)", label: "Free Exploration" },
  transfer: { icon: "RIDE", color: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)", label: "Local Transfer" },
};

function fmtDur(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h > 0 && `${h}h`, m > 0 && `${m}m`].filter(Boolean).join(" ");
}

function ItemRow({ item, isLast }: { item: ItineraryItem; isLast: boolean }) {
  const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.activity;

  return (
    <div style={{ display: "flex", gap: "1.25rem", position: "relative" }}>
      {/* Icon + timeline connector */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{
          width: "2.5rem",
          height: "2.5rem",
          borderRadius: "0.75rem",
          background: cfg.bg,
          border: `1px solid ${cfg.color}30`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.125rem",
          flexShrink: 0,
          boxShadow: "0 2px 8px -1px rgba(0, 0, 0, 0.4)",
        }}>
          {cfg.icon}
        </div>
        {!isLast && (
          <div style={{
            width: "2px",
            flex: 1,
            marginTop: "0.5rem",
            marginBottom: "0.5rem",
            background: "linear-gradient(to bottom, var(--color-border) 0%, rgba(0, 0, 0, 0.05) 100%)",
            minHeight: "2rem",
          }} />
        )}
      </div>

      {/* Content Card */}
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : "1.75rem", minWidth: 0 }}>
        <div className="card" style={{ padding: "1.125rem 1.25rem" }}>
          {/* Top row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.375rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
              <span style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                color: cfg.color,
                background: cfg.bg,
                padding: "0.1875rem 0.5rem",
                borderRadius: "0.375rem",
                border: `1px solid ${cfg.color}25`,
              }}>
                {item.time}
              </span>
              <span style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                {cfg.label}
              </span>
              {item.duration_minutes && (
                <span style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  <Clock className="w-3 h-3" />
                  {fmtDur(item.duration_minutes)}
                </span>
              )}
            </div>

            {item.estimated_cost > 0 && (
              <span style={{ fontSize: "0.875rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--color-text-primary)" }}>
                {formatINR(item.estimated_cost)}
              </span>
            )}
          </div>

          {/* Title & Description */}
          <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--color-text-primary)", lineHeight: 1.3, marginBottom: "0.25rem" }}>
            {item.title}
          </h4>

          {item.location && (
            <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "0.25rem", marginBottom: item.description ? "0.375rem" : 0 }}>
              <MapPin className="w-3 h-3 text-amber-700 shrink-0" />
              <span>{item.location}</span>
            </p>
          )}

          {item.description && (
            <p style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)", lineHeight: 1.65 }}>
              {item.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ItineraryTimeline({ days, selectedDayIndex, onSelectDay }: ItineraryTimelineProps) {
  const day = days[selectedDayIndex] || days[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Horizontal Day Switcher ──────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        overflowX: "auto",
        paddingBottom: "0.5rem",
        scrollbarWidth: "none",
      }}>
        {days.map((d, i) => {
          const active = i === selectedDayIndex;
          return (
            <button
              key={d.id || i}
              onClick={() => onSelectDay(i)}
              style={{
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "0.5rem 1rem",
                borderRadius: "0.625rem",
                cursor: "pointer",
                background: active ? "rgba(139, 92, 246, 0.1)" : "var(--color-bg-card)",
                border: active ? "1px solid rgba(139, 92, 246, 0.4)" : "1px solid var(--color-border)",
                color: active ? "var(--color-primary-600)" : "var(--color-text-secondary)",
                fontFamily: "inherit",
                transition: "all 0.15s ease",
                boxShadow: active ? "0 0 15px -3px rgba(139, 92, 246, 0.25)" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.02em" }}>
                  Day {d.day_number}
                </span>
                {active && <Sparkles className="w-2.5 h-2.5 text-amber-700" />}
              </div>
              <span style={{ fontSize: "0.6875rem", color: active ? "var(--color-text-secondary)" : "var(--color-text-muted)", marginTop: "0.125rem", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {d.location}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Day Header & Items ───────────────────────────────────── */}
      {day && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Day overview card */}
          <div className="card" style={{ padding: "1.25rem 1.5rem", background: "var(--color-bg-card)", borderColor: "var(--color-border)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.375rem" }}>
              <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--color-primary-600)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Day {day.day_number} Overview {day.date ? `• ${new Date(day.date).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}` : ""}
              </span>
              {day.total_cost > 0 && (
                <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>
                  Day Spend: {formatINR(day.total_cost)}
                </span>
              )}
            </div>
            <h3 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--color-text-primary)", marginBottom: "0.25rem" }}>
              {day.title}
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <MapPin className="w-3.5 h-3.5 text-amber-700" />
              {day.location}
            </p>
          </div>

          {/* Timeline stream */}
          <div style={{ marginTop: "0.5rem" }}>
            {day.items.map((item, i) => (
              <ItemRow key={item.id || i} item={item} isLast={i === day.items.length - 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}