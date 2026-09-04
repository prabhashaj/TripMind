'use client';

import type { Destination } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Sparkles, Calendar, Check, ArrowRight } from 'lucide-react';
import { TravelImage } from '@/components/TravelImage';

interface DestinationCardProps {
  destination: Destination;
  onSelect: (id: string) => void;
  isSelected?: boolean;
}

function formatCurrency(amount: number, currency: string = 'INR'): string {
  if (currency === 'INR') {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}k`;
    return `₹${amount}`;
  }
  return `${currency} ${amount.toLocaleString()}`;
}

export function DestinationCard({ destination, onSelect, isSelected }: DestinationCardProps) {
  return (
    <div
      onClick={() => onSelect(destination.id)}
      className={`rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 group flex flex-col justify-between border ${
        isSelected
          ? 'bg-[#151c2e] border-purple-400/80 ring-2 ring-purple-400/30 shadow-lg shadow-purple-500/10'
          : 'bg-[#0f1422] border-white/[0.08] hover:border-purple-500/30 hover:bg-[#131a2b]'
      }`}
    >
      <div>
        {/* Destination Image / Header */}
        <div className="relative h-44 w-full bg-[#161c2c] overflow-hidden">
          <TravelImage src={destination.image_url} alt={destination.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />

          {/* Duration Badge */}
          <div className="absolute top-3 left-3">
              <Badge variant="default" className="bg-black/75 backdrop-blur-md border-white/20 text-white text-[11px] gap-1">
              <Calendar className="w-3 h-3 text-purple-400" />
              <span>{destination.recommended_duration_days} Days</span>
            </Badge>
          </div>

          {/* Match Score Badge */}
          {destination.match_score > 0 && (
            <div className="absolute top-3 right-3">
              <Badge variant="purple" className="bg-black/80 backdrop-blur-md text-[11px] font-mono gap-1">
                <Sparkles className="w-3 h-3 text-purple-400" />
                <span>{Math.round(destination.match_score * 100)}% Match</span>
              </Badge>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h3 className="text-base font-bold text-white font-display leading-tight group-hover:text-purple-200 transition-colors">
                {destination.name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-500" />
                <span>{[destination.state, destination.country].filter(Boolean).join(', ')}</span>
              </p>
            </div>

            {/* Budget estimate tag */}
            <div className="text-right">
              <span className="text-xs font-semibold text-purple-300 font-mono">
                {formatCurrency(destination.estimated_cost_min, destination.currency)} - {formatCurrency(destination.estimated_cost_max, destination.currency)}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed line-clamp-2 mb-3">
            {destination.description}
          </p>

          {/* Highlights pills */}
          {destination.highlights && destination.highlights.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {destination.highlights.slice(0, 3).map((h, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-white/5"
                >
                  {h}
                </span>
              ))}
            </div>
          )}

          {/* Why it matches */}
          {destination.why_it_matches && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 leading-relaxed">
              <span className="font-semibold text-emerald-400">Match Insight: </span>
              {destination.why_it_matches}
            </div>
          )}
        </div>
      </div>

      {/* Select Button */}
      <div className="p-5 pt-0">
        <Button
          variant={isSelected ? 'purple' : 'outline'}
          size="sm"
          className="w-full gap-2 text-xs font-semibold"
        >
          {isSelected ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Selected Destination</span>
            </>
          ) : (
            <>
              <span>Explore Itinerary</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
