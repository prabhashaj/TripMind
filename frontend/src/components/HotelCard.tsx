'use client';

import type { HotelOption } from '@/lib/api';
import { TravelImage } from '@/components/TravelImage';
import { ProvenanceBadge } from '@/components/ProvenanceBadge';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HotelCardProps {
  hotel: HotelOption;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
}

function fmtCurrency(amount: number, currency: string): string {
  if (currency === 'INR') return `₹${Math.round(amount).toLocaleString('en-IN')}`;
  return `${currency} ${Math.round(amount).toLocaleString()}`;
}

/** Derives a one-line "why this fits you" from available hotel data if the backend
 *  didn't return an explicit field. Purely client-side fallback. */
function deriveWhyItFits(hotel: HotelOption): string | null {
  // Use explicit field if present
  if (hotel.why_it_matches) return hotel.why_it_matches;
  if (hotel.fit_reason) return hotel.fit_reason;

  // Build a short sentence from amenities + location
  const highlights: string[] = [];
  if (hotel.free_cancellation) highlights.push('free cancellation');
  if (hotel.breakfast_included) highlights.push('breakfast included');
  if (hotel.amenities?.length) {
    const top = hotel.amenities.slice(0, 2).join(' & ').toLowerCase();
    highlights.push(top);
  }
  if (!highlights.length) return null;
  return `Offers ${highlights.join(', ')} — a good match for your preferences.`;
}

export function HotelCard({ hotel, onSelect, isSelected }: HotelCardProps) {
  const isMock = hotel.source === 'mock';
  const provenance = isMock ? 'mock' : (hotel.provenance ?? 'estimated');
  const whyItFits = deriveWhyItFits(hotel);

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all duration-200 group flex flex-col justify-between border cursor-pointer',
        isSelected
          ? 'border-primary ring-1 ring-primary shadow-md bg-primary/5'
          : 'border-border hover:border-primary/50 hover:bg-muted/30',
      )}
      onClick={() => onSelect?.(hotel.id)}
    >
      <div>
        {/* ── Image — 16:9 consistent aspect ratio ── */}
        <div className="card-image-16-9">
          <TravelImage
            src={hotel.image_url}
            alt={hotel.name}
            category="hotel"
            title={hotel.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Amenity badges over image */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            {hotel.free_cancellation && (
              <Badge
                variant="secondary"
                className="bg-green-500/20 backdrop-blur-md text-green-700 dark:text-green-400 border-none text-[10px]"
              >
                Free cancellation
              </Badge>
            )}
            {hotel.breakfast_included && (
              <Badge
                variant="secondary"
                className="bg-background/85 backdrop-blur-md text-foreground border-none text-[10px]"
              >
                Breakfast incl.
              </Badge>
            )}
          </div>

          {/* Provenance pill — bottom right */}
          <div className="absolute bottom-3 right-3">
            <ProvenanceBadge provenance={provenance} source={hotel.source} category="hotel" />
          </div>
        </div>

        {/* ── Content ── */}
        <CardContent className="p-4 flex flex-col gap-2.5">
          {/* Name + Rating */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold leading-tight text-foreground group-hover:text-primary transition-colors">
              {hotel.name}
            </h3>
            {hotel.rating && (
              <Badge
                variant="secondary"
                className="flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-500 border-none shrink-0 px-2"
              >
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                <span className="font-semibold">{hotel.rating.toFixed(1)}</span>
                {hotel.review_count && (
                  <span className="text-muted-foreground text-[10px] ml-0.5">({hotel.review_count})</span>
                )}
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground line-clamp-1">{hotel.location}</p>

          {/* ── Price hierarchy ── */}
          <div className="flex items-baseline gap-2 mt-1">
            {/* Large: price per night */}
            <span className="text-2xl font-bold tabular-nums text-foreground">
              {fmtCurrency(hotel.price_per_night, hotel.currency)}
            </span>
            <span className="text-sm text-muted-foreground">/night</span>
          </div>
          {/* Small: total */}
          <p className="text-xs text-muted-foreground -mt-1 tabular-nums">
            {fmtCurrency(hotel.total_price, hotel.currency)} total
          </p>

          {/* Provenance note inline */}
          <ProvenanceBadge provenance={provenance} source={hotel.source} category="hotel" showNote />

          {/* Amenities */}
          {hotel.amenities?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {hotel.amenities.slice(0, 4).map((a: string, i: number) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-[10px] px-2 py-0 h-5 font-normal text-muted-foreground bg-muted/50 border-border"
                >
                  {a}
                </Badge>
              ))}
            </div>
          )}

          {/* ── Why this fits you ── */}
          {whyItFits && (
            <div className="mt-0.5 p-2.5 rounded-lg bg-violet-500/8 border border-violet-500/15 text-[11px] text-violet-700 dark:text-violet-300 leading-relaxed">
              <span className="flex items-center gap-1 font-semibold mb-0.5 text-violet-800 dark:text-violet-200">
                <Sparkles className="w-3 h-3" />
                Why this fits you
              </span>
              {whyItFits}
            </div>
          )}
        </CardContent>
      </div>

      <CardFooter className="p-4 pt-0 mt-auto">
        <Button
          type="button"
          variant={isSelected ? 'default' : 'outline'}
          className={cn(
            'w-full text-xs font-semibold h-9 rounded-xl transition-all',
            isSelected ? 'shadow-md' : 'hover:bg-primary/5 hover:border-primary/50',
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(hotel.id);
          }}
        >
          {isSelected ? 'Selected' : 'Select Hotel'}
        </Button>
      </CardFooter>
    </Card>
  );
}
