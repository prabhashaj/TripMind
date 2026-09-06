"use client";

import { useTripStore } from "@/store/trip-store";
import { CheckCircle2, AlertCircle, Clock, Activity } from "lucide-react";

const AGENT_ORDER = [
  "orchestrator", "user_preference", "destination", "transport",
  "hotel", "activity", "itinerary", "budget", "verification", "replanning",
];

function Dot({ status }: { status: string }) {
  if (status === "running")
    return <span className="aap-dot aap-dot--running" />;
  if (status === "completed")
    return <CheckCircle2 className="aap-dot-icon aap-dot-icon--done" />;
  if (status === "failed")
    return <AlertCircle className="aap-dot-icon aap-dot-icon--failed" />;
  return <Clock className="aap-dot-icon aap-dot-icon--waiting" />;
}

export function AgentActivityPanel({ compact }: { compact?: boolean }) {
  const { agentActivities, recentEvents } = useTripStore();
  const active = AGENT_ORDER.filter((k) => agentActivities[k]);
  const running = active.filter((k) => agentActivities[k]?.status === "running").length;
  const done = active.filter((k) => agentActivities[k]?.status === "completed").length;

  if (compact) {
    return (
      <div className="aap-compact-root">
        <div className="aap-compact-header">
          <span className="aap-compact-label">Agents</span>
          <span className="aap-compact-count">{done}/{active.length}</span>
        </div>
        {AGENT_ORDER.map((k) => {
          const a = agentActivities[k];
          if (!a) return null;
          const isRunning = a.status === "running";
          const isDone = a.status === "completed";
          return (
            <div key={k} className={`aap-compact-row${isRunning ? " aap-compact-row--running" : ""}`}>
              <Dot status={a.status} />
              <span className={`aap-compact-name${isDone ? " aap-compact-name--done" : ""}`}>{a.name}</span>
              {a.itemsFound !== undefined && (
                <span className="aap-compact-items">+{a.itemsFound}</span>
              )}
            </div>
          );
        })}
        {running > 0 && (
          <p className="aap-running-note">{running} agent{running > 1 ? "s" : ""} working...</p>
        )}
      </div>
    );
  }

  return (
    <div className="aap-root">
      {/* Stats grid */}
      <div className="aap-stats-grid">
        <div className="aap-stat-card">
          <p className="aap-stat-value">{done}</p>
          <p className="aap-stat-label">Completed</p>
        </div>
        <div className={`aap-stat-card${running > 0 ? " aap-stat-card--running" : ""}`}>
          <p className={`aap-stat-value${running > 0 ? " aap-stat-value--running" : ""}`}>{running}</p>
          <p className="aap-stat-label">Running</p>
        </div>
      </div>

      {/* Agent network list */}
      <div className="aap-network-card">
        <div className="aap-network-header">
          <span className="aap-network-label">Agent network</span>
          <span className="aap-network-count">{active.length}/{AGENT_ORDER.length}</span>
        </div>
        <div className="aap-network-list">
          {AGENT_ORDER.map((k) => {
            const a = agentActivities[k];
            if (!a) return null;
            const isRunning = a.status === "running";
            const isDone = a.status === "completed";
            return (
              <div key={k} className={`aap-agent-row${isRunning ? " aap-agent-row--running" : ""}`}>
                <Dot status={a.status} />
                <div className="min-w-0 flex-1">
                  <p className={`aap-agent-name${isDone ? " aap-agent-name--done" : ""}`}>{a.name}</p>
                  {a.status !== "waiting" && (
                    <p className="aap-agent-msg">{a.message}</p>
                  )}
                </div>
                {a.itemsFound !== undefined && (
                  <span className="aap-agent-count">+{a.itemsFound}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Live log */}
      {recentEvents.length > 0 && (
        <div className="aap-log-card">
          <div className="aap-log-header">
            <Activity className="w-3 h-3 text-primary" />
            <span className="aap-log-label">Live log</span>
          </div>
          <div className="aap-log-body">
            {recentEvents.slice(0, 8).map((ev, index) => (
              <div key={`${ev.event_id || "event"}-${ev.timestamp}-${index}`} className="aap-log-row">
                <span className="aap-log-time">
                  {new Date(ev.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className="aap-log-msg">{ev.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}