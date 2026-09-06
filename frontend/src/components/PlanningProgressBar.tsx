'use client';

import { useTripStore } from '@/store/trip-store';
import {
  Sparkles,
  MapPin,
  Plane,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Clock,
} from 'lucide-react';

/** Maps user-facing stage names to the underlying agent keys that drive them. */
const STAGES = [
  {
    id: 'understanding',
    label: 'Understanding your trip',
    agentKeys: ['user_preference'],
    Icon: Sparkles,
  },
  {
    id: 'destinations',
    label: 'Finding destinations',
    agentKeys: ['destination'],
    Icon: MapPin,
  },
  {
    id: 'research',
    label: 'Comparing hotels & flights',
    agentKeys: ['transport', 'hotel', 'activity'],
    Icon: Plane,
  },
  {
    id: 'itinerary',
    label: 'Building your itinerary',
    agentKeys: ['itinerary', 'budget'],
    Icon: Calendar,
  },
  {
    id: 'verification',
    label: 'Double-checking everything',
    agentKeys: ['verification'],
    Icon: ShieldCheck,
  },
] as const;

type StageStatus = 'done' | 'running' | 'waiting';

interface ResolvedStage {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  status: StageStatus;
  /** Most recent live message from backend for this stage */
  message: string;
}

export function PlanningProgressBar() {
  const { agentActivities, isPlanning, tripState } = useTripStore();

  // Derive per-stage status from real SSE agent events
  const resolvedStages: ResolvedStage[] = STAGES.map((stage) => {
    const activities = stage.agentKeys.map((k) => agentActivities[k]).filter(Boolean);
    const running = activities.some((a) => a.status === 'running');
    const allDone = activities.length > 0 && activities.every((a) => a.status === 'completed' || a.status === 'failed' || a.status === 'timeout');

    let status: StageStatus = 'waiting';
    if (allDone) status = 'done';
    else if (running || (activities.length > 0 && activities.some((a) => a.status === 'running'))) status = 'running';

    // Pick the most informative message: prefer running agents, then any active agent
    const runningActivity = activities.find((a) => a.status === 'running');
    const message =
      runningActivity?.message ??
      activities.find((a) => a.message)?.message ??
      '';

    return { id: stage.id, label: stage.label, Icon: stage.Icon, status, message };
  });

  const doneCount = resolvedStages.filter((s) => s.status === 'done').length;
  const total = resolvedStages.length;
  const allDone = doneCount === total;

  // Don't render if trip is ready and not planning, unless there are activities to show
  const hasAnyActivity = Object.keys(agentActivities).length > 0;
  if (!isPlanning && !hasAnyActivity) return null;
  // If completed and verification done, collapse
  if (tripState?.planning_status === 'complete' && allDone) return null;

  return (
    <div className="ppb-root animate-fade-in">
      {/* Header row: title + fraction */}
      <div className="ppb-header">
        <span className="ppb-title">Planning your trip</span>
        <span className="ppb-fraction">{doneCount} / {total} stages</span>
      </div>

      {/* Segmented progress track */}
      <div className="ppb-track" role="progressbar" aria-valuenow={doneCount} aria-valuemax={total}>
        {resolvedStages.map((stage) => (
          <div
            key={stage.id}
            className={`ppb-segment ppb-segment--${stage.status}`}
          />
        ))}
      </div>

      {/* Stage list */}
      <div className="ppb-stages">
        {resolvedStages.map((stage) => {
          const { Icon } = stage;
          return (
            <div key={stage.id} className="ppb-stage-row">
              <div className={`ppb-stage-icon ppb-stage-icon--${stage.status}`}>
                {stage.status === 'done' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : stage.status === 'waiting' ? (
                  <Clock className="w-3.5 h-3.5" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="ppb-stage-body">
                <p className={`ppb-stage-name ppb-stage-name--${stage.status}`}>
                  {stage.label}
                </p>
                {stage.message && (
                  <p className={`ppb-stage-msg${stage.status === 'running' ? ' ppb-stage-msg--running' : ''}`}>
                    {stage.message}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
