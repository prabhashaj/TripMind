'use client';

import type { TransportLeg } from '@/lib/api';

interface TransportCardProps {
  leg: TransportLeg;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '--:--';
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === 'INR') return `₹${amount.toLocaleString('en-IN')}`;
  return `${currency} ${amount.toLocaleString()}`;
}

const MODE_ICONS: Record<string, string> = {
  flight: 'AIR',
  train: 'RAIL',
  bus: 'BUS',
  car: 'CAR',
};

const MODE_LABELS: Record<string, string> = {
  flight: 'Flight',
  train: 'Train',
  bus: 'Bus',
  car: 'Car',
};

export function TransportCard({ leg, onSelect, isSelected }: TransportCardProps) {
  const isMock = leg.source === 'mock';

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all cursor-pointer group animate-scale-in"
      style={{
        background: 'var(--color-bg-card)',
        border: isSelected
          ? '1px solid rgba(139, 92, 246, 0.5)'
          : '1px solid var(--color-border)',
        boxShadow: isSelected ? 'var(--shadow-primary)' : 'var(--shadow-lg)',
      }}
    >
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            {/* Mode badge */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{
                background: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'var(--color-bg-elevated)',
              }}
            >
              {MODE_ICONS[leg.mode] || 'CAR'}
            </div>
            <div>
              <div className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                {MODE_LABELS[leg.mode] || leg.mode}
              </div>
              <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {leg.carrier || leg.provider}
              </div>
            </div>
          </div>

          {/* Price */}
          <div className="text-right">
            <div className="text-xl font-bold font-display" style={{ color: isSelected ? 'var(--color-primary-600)' : 'var(--color-text-primary)' }}>
              {formatCurrency(leg.price, leg.currency)}
            </div>
            {leg.price_label && (
              <div
                className="text-xs px-2 py-0.5 rounded-full mt-1 inline-block"
                style={{
                  background: 'rgba(52, 211, 153, 0.1)',
                  color: 'var(--color-success)',
                }}
              >
                {leg.price_label}
              </div>
            )}
          </div>
        </div>

        {/* Route row */}
        <div className="flex items-center gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold font-display tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
              {formatTime(leg.departure_time)}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {leg.origin}
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center gap-1">
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {formatDuration(leg.duration_minutes)}
            </div>
            <div className="w-full flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--color-text-muted)' }} />
              <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
              {leg.stops === 0 ? (
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-success)' }}>Direct</span>
              ) : (
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>{leg.stops} stop{leg.stops > 1 ? 's' : ''}</span>
              )}
              <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--color-text-muted)' }} />
            </div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold font-display tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
              {formatTime(leg.arrival_time)}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {leg.destination}
            </div>
          </div>
        </div>

        {/* Freshness & mock warning */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: isMock ? 'var(--color-warning)' : 'var(--color-success)' }} />
            {isMock
              ? 'Estimated — live prices need Amadeus API'
              : `Checked ${new Date(leg.retrieved_at).toLocaleTimeString()}`}
          </div>
          {onSelect && (
            <button
              type="button"
              onClick={() => onSelect(leg.id)}
              className="text-xs px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: isSelected ? 'var(--gradient-primary)' : 'var(--color-bg-elevated)',
                color: isSelected ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                fontWeight: isSelected ? 600 : 400,
              }}
            >
              {isSelected ? 'Selected' : 'Select'}
            </button>
          )}
        </div>

        {/* Mock notes */}
        {leg.notes && (
          <div className="mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {leg.notes}
          </div>
        )}
      </div>
    </div>
  );
}
