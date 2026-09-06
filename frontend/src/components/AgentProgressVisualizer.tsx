'use client';

import { useTripStore } from '@/store/trip-store';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  MapPin,
  Plane,
  Hotel,
  Compass,
  Calendar,
  Wallet,
  ShieldCheck,
} from 'lucide-react';

interface StageConfig {
  id: string;
  name: string;
  label: string;
  icon: any;
  parallelGroup?: string;
  description: string;
}

const STAGES: StageConfig[] = [
  {
    id: 'user_preference',
    name: 'user_preference',
    label: 'Preference Agent',
    icon: Sparkles,
    description: 'Analyzes trip constraints, duration, and style',
  },
  {
    id: 'destination',
    name: 'destination',
    label: 'Destination Agent',
    icon: MapPin,
    description: 'Matches destinations and scores affinities',
  },
  // Parallel group
  {
    id: 'transport',
    name: 'transport',
    label: 'Transport Agent',
    icon: Plane,
    parallelGroup: 'research',
    description: 'Live flight and train options search',
  },
  {
    id: 'hotel',
    name: 'hotel',
    label: 'Hotel Agent',
    icon: Hotel,
    parallelGroup: 'research',
    description: 'Vetted accommodations & neighborhood pricing',
  },
  {
    id: 'activity',
    name: 'activity',
    label: 'Activity Agent',
    icon: Compass,
    parallelGroup: 'research',
    description: 'Top cultural sights, dining & local experiences',
  },
  // Sequential continuation
  {
    id: 'itinerary',
    name: 'itinerary',
    label: 'Itinerary Agent',
    icon: Calendar,
    description: 'Builds balanced day-by-day routing',
  },
  {
    id: 'budget',
    name: 'budget',
    label: 'Budget Agent',
    icon: Wallet,
    description: 'Calculates categorical totals and currency costs',
  },
  {
    id: 'verification',
    name: 'verification',
    label: 'Verification Agent',
    icon: ShieldCheck,
    description: 'Validates budget caps, travel times, and logic',
  },
];

export function AgentProgressVisualizer() {
  const { agentActivities, tripState } = useTripStore();

  const getStatus = (agentId: string) => {
    const act = agentActivities[agentId];
    if (!act) return 'waiting';
    return act.status;
  };

  const parallelStages = STAGES.filter((s) => s.parallelGroup === 'research');
  const sequentialBefore = STAGES.filter((s) => !s.parallelGroup && ['user_preference', 'destination'].includes(s.id));
  const sequentialAfter = STAGES.filter((s) => !s.parallelGroup && ['itinerary', 'budget', 'verification'].includes(s.id));

  const renderStageCard = (stage: StageConfig) => {
    const status = getStatus(stage.id);
    const activity = agentActivities[stage.id];
    const Icon = stage.icon;

    const isRunning = status === 'running';
    const isCompleted = status === 'completed';
    const isFailed = status === 'failed';
    const isTimeout = status === 'timeout';

    return (
      <div
        key={stage.id}
        className={`agent-pipeline-card ${
          isRunning
            ? 'agent-card-running'
            : isCompleted
            ? 'agent-card-completed'
            : isFailed || isTimeout
            ? 'agent-card-failed'
            : 'agent-card-waiting'
        }`}
      >
        <div className="agent-card-top">
          <div className="agent-card-lead">
            <div className={`agent-icon-box ${isRunning ? 'agent-icon-running' : isCompleted ? 'agent-icon-completed' : 'agent-icon-default'}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <span className="agent-card-name">{stage.label}</span>
              <span className="agent-card-desc">{stage.description}</span>
            </div>
          </div>

          <div className="agent-card-badge-wrap">
            {isRunning && (
              <span className="agent-status-pill pill-running">
                <span className="pill-dot-pulse" />
                Working
              </span>
            )}
            {isCompleted && (
              <span className="agent-status-pill pill-completed">
                <CheckCircle2 className="w-3 h-3" />
                Done
              </span>
            )}
            {(isFailed || isTimeout) && (
              <span className="agent-status-pill pill-failed">
                <AlertCircle className="w-3 h-3" />
                {isTimeout ? 'Timed out' : 'Fallback'}
              </span>
            )}
            {status === 'waiting' && (
              <span className="agent-status-pill pill-waiting">
                <Clock className="w-3 h-3" />
                Queued
              </span>
            )}
          </div>
        </div>

        {/* Live finding message or item count */}
        {activity && (activity.message || activity.itemsFound !== undefined) && (
          <div className="agent-card-footer">
            <p className="agent-card-message">{activity.message}</p>
            {activity.itemsFound !== undefined && (
              <span className="agent-items-pill">
                +{activity.itemsFound}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="agent-pipeline-container">
      {/* Header */}
      <div className="pipeline-header">
        <div>
          <h3 className="pipeline-title">Multi-Agent Planning Pipeline</h3>
          <p className="pipeline-subtitle">
            Coordinated execution of 9 specialized LangGraph agents in real time
          </p>
        </div>
        <span className="pipeline-mode-badge">
          LangGraph Parallel Flow
        </span>
      </div>

      {/* Phase 1 */}
      <div className="pipeline-phase-block">
        <span className="pipeline-phase-label">
          Phase 1: Discovery & Preferences
        </span>
        <div className="pipeline-grid grid-2">
          {sequentialBefore.map(renderStageCard)}
        </div>
      </div>

      {/* Phase 2 */}
      <div className="pipeline-parallel-panel">
        <div className="pipeline-parallel-header">
          <div className="parallel-header-title">
            <span className="parallel-live-dot" />
            <span>Phase 2: Parallel Research Node (asyncio.gather)</span>
          </div>
          <span className="parallel-meta">Concurrent Real-Time Execution</span>
        </div>
        <div className="pipeline-grid grid-3">
          {parallelStages.map(renderStageCard)}
        </div>
      </div>

      {/* Phase 3 */}
      <div className="pipeline-phase-block">
        <span className="pipeline-phase-label">
          Phase 3: Synthesis, Budgeting & Feasibility Verification
        </span>
        <div className="pipeline-grid grid-3">
          {sequentialAfter.map(renderStageCard)}
        </div>
      </div>

      {/* Verification status pill */}
      {tripState?.verification && (
        <div
          className={`pipeline-verification-banner ${
            tripState.verification.overall_status === 'passed'
              ? 'banner-passed'
              : 'banner-fallback'
          }`}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            <span className="font-semibold text-xs">
              Quality & Feasibility Check:{' '}
              {tripState.verification.overall_status === 'passed' ? 'Verified Passed' : 'Optimized with Fallbacks'}
            </span>
          </div>
          {tripState.verification.checks && (
            <span className="text-[11px] opacity-80">
              {tripState.verification.checks.length} checks performed
            </span>
          )}
        </div>
      )}
    </div>

  );
}
