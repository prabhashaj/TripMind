'use client';

import { Info } from 'lucide-react';

type ProvenanceTier = 'live' | 'estimated' | 'mock';

interface ProvenanceBadgeProps {
  /** Raw provenance value from the backend */
  provenance?: 'verified' | 'estimated' | 'mock' | string;
  /** Source field — 'mock' maps to the mock tier */
  source?: string;
  category?: 'flight' | 'train' | 'hotel' | 'activity' | 'destination' | 'general';
  /** When true, show a one-line explanatory note below the badge */
  showNote?: boolean;
  className?: string;
}

function resolveTier(provenance?: string, source?: string): ProvenanceTier {
  if (source === 'mock' || provenance === 'mock') return 'mock';
  if (provenance === 'verified') return 'live';
  return 'estimated';
}

const CATEGORY_ENTITY: Record<string, string> = {
  flight:      'airline',
  train:       'rail operator',
  hotel:       'property',
  activity:    'operator',
  destination: 'source',
  general:     'provider',
};

const TIER_CONFIG: Record<ProvenanceTier, { label: string; noteTemplate: (entity: string) => string }> = {
  live: {
    label: 'Live price',
    noteTemplate: (entity) => `Verified live price direct from ${entity}`,
  },
  estimated: {
    label: 'Estimated',
    noteTemplate: (entity) => `Estimated fare — not yet confirmed with ${entity}`,
  },
  mock: {
    label: 'Mock data',
    noteTemplate: () => 'Mock data — connect an API key for live prices',
  },
};

export function ProvenanceBadge({
  provenance,
  source,
  category = 'general',
  showNote = false,
  className = '',
}: ProvenanceBadgeProps) {
  const tier = resolveTier(provenance, source);
  const entity = CATEGORY_ENTITY[category] ?? 'provider';
  const config = TIER_CONFIG[tier];

  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      <div
        className={`provenance-badge provenance-badge--${tier}`}
        title={config.noteTemplate(entity)}
      >
        <span className={`provenance-dot provenance-dot--${tier}`} />
        <span>{config.label}</span>
      </div>

      {showNote && tier !== 'live' && (
        <p className="provenance-note">
          <Info className="w-3 h-3 flex-shrink-0 provenance-note-icon" />
          <span>{config.noteTemplate(entity)}</span>
        </p>
      )}
    </div>
  );
}
