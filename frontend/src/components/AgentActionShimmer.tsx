"use client";

import React from "react";
import { CheckCircle2, Compass, Hotel, MapPin, Plane, Sparkles, Wallet } from "lucide-react";
import { useTripStore } from "@/store/trip-store";
import { cn } from "@/lib/utils";

interface AgentActionShimmerProps {
  statusMessage?: string;
  tripId?: string;
  compact?: boolean;
  onOpenTrip?: () => void;
}

const AGENT_ORDER = ["user_preference", "destination", "transport", "hotel", "activity", "itinerary", "budget", "verification"];
const AGENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  user_preference: Sparkles,
  destination: MapPin,
  transport: Plane,
  hotel: Hotel,
  activity: Compass,
  budget: Wallet,
};

/** A deliberately quiet, ChatGPT-style status row for live planning work. */
export function AgentActionShimmer({ statusMessage, compact = false, onOpenTrip }: AgentActionShimmerProps) {
  const { agentActivities, isPlanning, tripState } = useTripStore();
  const currentKey = AGENT_ORDER.find((key) => agentActivities[key]?.status === "running")
    || (isPlanning ? AGENT_ORDER.find((key) => agentActivities[key]?.status !== "completed") : undefined);
  const activity = currentKey ? agentActivities[currentKey] : undefined;
  const Icon = currentKey ? AGENT_ICONS[currentKey] || Sparkles : Sparkles;
  const complete = tripState?.planning_status === "complete" || tripState?.planning_status === "ready";
  const message = statusMessage || activity?.message || (complete ? "Your itinerary is ready." : "Thinking through your trip...");

  return (
    <div className={cn("relative flex items-center gap-2.5 overflow-hidden py-2 text-xs text-muted-foreground", !compact && "max-w-[680px]")} role="status">
      {complete ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" /> : <Icon className="h-4 w-4 shrink-0 animate-pulse text-primary" />}
      <span className="relative z-10 truncate">{message}</span>
      {!complete && <span className="h-4 w-20 animate-pulse rounded bg-muted" aria-hidden="true" />}
      {complete && onOpenTrip && <button type="button" onClick={onOpenTrip} className="ml-auto shrink-0 text-primary hover:underline">Open itinerary</button>}
    </div>
  );
}
