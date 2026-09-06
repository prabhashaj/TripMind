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

      <style jsx>{`
        .agent-pipeline-container {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          width: 100%;
        }

        .pipeline-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--color-border);
        }

        .pipeline-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--color-text-primary);
          letter-spacing: -0.01em;
        }

        .pipeline-subtitle {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          margin-top: 2px;
        }

        .pipeline-mode-badge {
          font-size: 0.6875rem;
          font-family: monospace;
          padding: 0.25rem 0.625rem;
          border-radius: 9999px;
          background: var(--color-primary-50);
          border: 1px solid var(--color-primary-200);
          color: var(--color-primary-800);
          font-weight: 600;
        }

        .pipeline-phase-block {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .pipeline-phase-label {
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-text-muted);
        }

        .pipeline-grid {
          display: grid;
          gap: 0.75rem;
        }

        .grid-2 {
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        }

        .grid-3 {
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }

        .pipeline-parallel-panel {
          padding: 1rem;
          border-radius: var(--radius-lg);
          background: rgba(167, 122, 43, 0.04);
          border: 1px solid rgba(167, 122, 43, 0.22);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .pipeline-parallel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .parallel-header-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--color-primary-700);
        }

        .parallel-live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--color-primary-500);
          animation: dot-pulse 1.8s infinite ease-in-out;
        }

        .parallel-meta {
          font-size: 0.6875rem;
          color: var(--color-text-muted);
        }

        .agent-pipeline-card {
          padding: 0.875rem 1rem;
          border-radius: 0.75rem;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
        }

        .agent-card-running {
          background: rgba(167, 122, 43, 0.06);
          border-color: var(--color-primary-400);
          box-shadow: 0 4px 14px rgba(167, 122, 43, 0.12);
        }

        .agent-card-completed {
          background: rgba(16, 185, 129, 0.04);
          border-color: rgba(16, 185, 129, 0.25);
        }

        .agent-card-failed {
          background: rgba(239, 68, 68, 0.05);
          border-color: rgba(239, 68, 68, 0.25);
        }

        .agent-card-waiting {
          opacity: 0.8;
        }

        .agent-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .agent-card-lead {
          display: flex;
          align-items: center;
          gap: 0.625rem;
        }

        .agent-icon-box {
          width: 2rem;
          height: 2rem;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .agent-icon-default {
          background: var(--color-bg-surface);
          color: var(--color-text-secondary);
          border: 1px solid var(--color-border);
        }

        .agent-icon-running {
          background: var(--color-primary-500);
          color: #ffffff;
          box-shadow: 0 2px 8px var(--color-primary-glow);
        }

        .agent-icon-completed {
          background: rgba(16, 185, 129, 0.15);
          color: var(--color-success);
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .agent-card-name {
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--color-text-primary);
          display: block;
        }

        .agent-card-desc {
          font-size: 0.6875rem;
          color: var(--color-text-muted);
          display: block;
          line-height: 1.3;
        }

        .agent-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.3125rem;
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 0.15rem 0.5rem;
          border-radius: 9999px;
          white-space: nowrap;
        }

        .pill-running {
          background: rgba(167, 122, 43, 0.12);
          border: 1px solid rgba(167, 122, 43, 0.3);
          color: var(--color-primary-700);
        }

        .pill-dot-pulse {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--color-primary-500);
          animation: dot-pulse 1.4s infinite ease-in-out;
        }

        .pill-completed {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.25);
          color: var(--color-success);
        }

        .pill-failed {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: var(--color-error);
        }

        .pill-waiting {
          background: var(--color-bg-surface);
          border: 1px solid var(--color-border);
          color: var(--color-text-muted);
        }

        .agent-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 0.375rem;
          margin-top: 0.25rem;
          border-top: 1px solid var(--color-border);
        }

        .agent-card-message {
          font-size: 0.6875rem;
          color: var(--color-text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 80%;
        }

        .agent-items-pill {
          font-size: 0.6875rem;
          font-weight: 700;
          font-family: monospace;
          color: var(--color-success);
          background: rgba(16, 185, 129, 0.1);
          padding: 0.1rem 0.4rem;
          border-radius: 0.25rem;
        }

        .pipeline-verification-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border-radius: 0.75rem;
          font-size: 0.75rem;
        }

        .banner-passed {
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.25);
          color: #166534;
        }

        .banner-fallback {
          background: rgba(167, 122, 43, 0.08);
          border: 1px solid rgba(167, 122, 43, 0.25);
          color: var(--color-primary-800);
        }
      `}</style>
    </div>
  );
}
