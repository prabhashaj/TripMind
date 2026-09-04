'use client';

import type { HotelOption } from '@/lib/api';
import { TravelImage } from '@/components/TravelImage';

interface HotelCardProps {
  hotel: HotelOption;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === 'INR') return `₹${amount.toLocaleString('en-IN')}`;
  return `${currency} ${amount.toLocaleString()}`;
}

const STAR_ICONS = (rating: number) =>
  Array.from({ length: 5 }, (_, i) => i < Math.floor(rating));

export function HotelCard({ hotel, onSelect, isSelected }: HotelCardProps) {
  const isMock = hotel.source === 'mock';

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all group animate-scale-in"
      style={{
        background: 'var(--color-bg-card)',
        border: isSelected
          ? '1px solid rgba(139, 92, 246, 0.5)'
          : '1px solid var(--color-border)',
        boxShadow: isSelected ? 'var(--shadow-primary)' : 'var(--shadow-lg)',
      }}
    >
      {/* Image */}
      <div
        className="relative h-44 overflow-hidden"
        style={{ background: 'var(--color-bg-elevated)' }}
      >
        <TravelImage src={hotel.image_url} alt={hotel.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {hotel.free_cancellation && (
            <div
              className="px-2 py-1 rounded-lg text-xs font-medium"
              style={{
                background: 'rgba(52, 211, 153, 0.15)',
                backdropFilter: 'blur(8px)',
                color: 'var(--color-success)',
              }}
            >
              Free cancellation
            </div>
          )}
          {hotel.breakfast_included && (
            <div
              className="px-2 py-1 rounded-lg text-xs font-medium"
              style={{
                background: 'rgba(10, 11, 14, 0.85)',
                backdropFilter: 'blur(8px)',
                color: 'var(--color-text-secondary)',
              }}
            >
              Breakfast incl.
            </div>
          )}
        </div>

        {/* Mock warning */}
        {isMock && (
          <div
            className="absolute bottom-3 right-3 px-2 py-1 rounded-lg text-xs"
            style={{
              background: 'rgba(251, 191, 36, 0.15)',
              backdropFilter: 'blur(8px)',
              color: 'var(--color-warning)',
            }}
          >
            Estimated
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Name & Rating */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-base font-semibold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
            {hotel.name}
          </h3>
          {hotel.rating && (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-lg flex-shrink-0"
              style={{ background: 'rgba(251, 191, 36, 0.1)' }}
            >
              <svg className="w-3 h-3" fill="#a77a2b" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-xs font-semibold" style={{ color: 'var(--color-primary-600)' }}>
                {hotel.rating.toFixed(1)}
              </span>
              {hotel.review_count && (
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  ({hotel.review_count})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Location */}
        <div className="flex items-center gap-1.5 mb-3">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {hotel.location}
            {hotel.distance_from_center_km && ` · ${hotel.distance_from_center_km}km from center`}
          </span>
        </div>

        {/* Price row */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-2xl font-bold font-display" style={{ color: 'var(--color-text-primary)' }}>
            {formatCurrency(hotel.price_per_night, hotel.currency)}
          </span>
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>/night</span>
          <span className="text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>
            {formatCurrency(hotel.total_price, hotel.currency)} total
          </span>
        </div>

        {/* Amenities */}
        {hotel.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {hotel.amenities.slice(0, 4).map((a, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {a}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => onSelect?.(hotel.id)}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: isSelected
              ? 'var(--gradient-primary)'
              : 'var(--color-bg-elevated)',
            color: isSelected ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
            border: isSelected ? 'none' : '1px solid var(--color-border)',
          }}
        >
          {isSelected ? 'Selected' : 'Select Hotel'}
        </button>
      </div>
    </div>
  );
}
