'use client';

import { Info } from 'lucide-react';

interface ProvenanceBadgeProps {
  provenance?: 'verified' | 'estimated' | string;
  category?: 'flight' | 'train' | 'hotel' | 'activity' | 'destination' | 'general';
  showNote?: boolean;
  className?: string;
}

export function ProvenanceBadge({
  provenance = 'estimated',
  category = 'general',
  showNote = false,
  className = '',
}: ProvenanceBadgeProps) {
  const isVerified = provenance === 'verified';

  const categoryEntity =
    category === 'flight'
      ? 'airline'
      : category === 'train'
      ? 'rail operator'
      : category === 'hotel'
      ? 'property'
      : category === 'activity'
      ? 'operator'
      : 'provider';

  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all"
        style={{
          background: isVerified ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
          border: `1px solid ${isVerified ? 'rgba(16, 185, 129, 0.28)' : 'rgba(245, 158, 11, 0.25)'}`,
          color: isVerified ? 'var(--color-success)' : 'var(--color-warning)',
        }}
        title={
          isVerified
            ? `Verified live price directly from ${categoryEntity}`
            : `Estimated fare based on seasonal research — not yet live-booked with ${categoryEntity}`
        }
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: isVerified ? 'var(--color-success)' : 'var(--color-warning)',
            boxShadow: isVerified ? '0 0 6px rgba(16, 185, 129, 0.4)' : 'none',
          }}
        />
        <span>{isVerified ? 'Verified Live Price' : 'Estimated Fare'}</span>
      </div>

      {showNote && !isVerified && (
        <p
          className="text-[11px] flex items-center gap-1 mt-0.5"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <Info className="w-3 h-3 flex-shrink-0 text-amber-500/80" />
          <span>Estimated price — not yet verified with {categoryEntity}</span>
        </p>
      )}
    </div>
  );
}
