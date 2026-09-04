/**
 * Activity Card component for displaying attractions and experiences.
 */
'use client';

import { MapPin } from 'lucide-react';

import type { Activity } from '@/lib/api';

interface ActivityCardProps {
  activity: Activity;
  onAdd?: (id: string) => void;
  isAdded?: boolean;
}

function formatCurrency(amount: number, currency: string = 'INR'): string {
  if (!amount) return 'Free';
  if (currency === 'INR') return `₹${Math.round(amount).toLocaleString('en-IN')}/person`;
  return `${currency} ${amount}/person`;
}

export function ActivityCard({ activity, onAdd, isAdded }: ActivityCardProps) {
  return (
    <div
      className="rounded-2xl p-5 transition-all group animate-scale-in"
      style={{
        background: 'var(--color-bg-card)',
        border: isAdded
          ? '1px solid rgba(52, 211, 153, 0.4)'
          : '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: 'var(--color-bg-elevated)' }}
        >
          <MapPin className="w-5 h-5" style={{ color: 'var(--color-primary-500)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-semibold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              {activity.name}
            </h4>
            {activity.rating && (
              <span
                className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--color-primary-600)' }}
              >
                {activity.rating.toFixed(1)} ★
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {activity.location}
          </p>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--color-text-secondary)' }}>
        {activity.description}
      </p>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3 mb-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {activity.duration_hours && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {activity.duration_hours}h
          </span>
        )}
        <span className="font-medium" style={{ color: activity.price_per_person === 0 ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
          {formatCurrency(activity.price_per_person, activity.currency)}
        </span>
        {activity.opening_hours && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {activity.opening_hours}
          </span>
        )}
      </div>

      {/* Tags */}
      {activity.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {activity.tags.slice(0, 3).map((tag, i) => (
            <span
              key={i}
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: 'var(--color-bg-elevated)',
                color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* CTA */}
      {onAdd && (
        <button
          onClick={() => onAdd(activity.id)}
          className="w-full py-2 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: isAdded
              ? 'rgba(52, 211, 153, 0.15)'
              : 'var(--color-bg-elevated)',
            color: isAdded ? 'var(--color-success)' : 'var(--color-text-secondary)',
            border: isAdded
              ? '1px solid rgba(52, 211, 153, 0.3)'
              : '1px solid var(--color-border)',
          }}
        >
          {isAdded ? 'Added to itinerary' : 'Add to itinerary'}
        </button>
      )}
    </div>
  );
}
