'use client';

import type { HotelOption } from '@/lib/api';
import { TravelImage } from '@/components/TravelImage';
import { ProvenanceBadge } from '@/components/ProvenanceBadge';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HotelCardProps {
  hotel: HotelOption;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
}

function formatCurrency(amount: number, currency: string): string {
  if (currency === 'INR') return `₹${amount.toLocaleString('en-IN')}`;
  return `${currency} ${amount.toLocaleString()}`;
}

export function HotelCard({ hotel, onSelect, isSelected }: HotelCardProps) {
  const isMock = hotel.source === 'mock';
  const provenance = hotel.provenance || (isMock ? 'estimated' : 'verified');

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all duration-200 group flex flex-col justify-between border cursor-pointer",
        isSelected
          ? "border-primary ring-1 ring-primary shadow-md bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/30"
      )}
      onClick={() => onSelect?.(hotel.id)}
    >
      <div>
        {/* Image */}
        <div className="relative h-44 overflow-hidden bg-muted">
          <TravelImage
            src={hotel.image_url}
            alt={hotel.name}
            category="hotel"
            title={hotel.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-2">
            {hotel.free_cancellation && (
              <Badge variant="secondary" className="bg-green-500/20 backdrop-blur-md text-green-700 dark:text-green-400 border-none">
                Free cancellation
              </Badge>
            )}
            {hotel.breakfast_included && (
              <Badge variant="secondary" className="bg-background/85 backdrop-blur-md text-foreground border-none">
                Breakfast incl.
              </Badge>
            )}
          </div>

          {/* Provenance pill on image */}
          <div className="absolute bottom-3 right-3">
            <ProvenanceBadge provenance={provenance} category="hotel" />
          </div>
        </div>

        {/* Content */}
        <CardContent className="p-4 flex flex-col gap-3">
          {/* Name & Rating */}
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold leading-tight text-foreground group-hover:text-primary transition-colors">
              {hotel.name}
            </h3>
            {hotel.rating && (
              <Badge variant="secondary" className="flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-500 border-none shrink-0 px-2">
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                <span className="font-semibold">{hotel.rating.toFixed(1)}</span>
                {hotel.review_count && (
                  <span className="text-muted-foreground text-[10px] ml-0.5">({hotel.review_count})</span>
                )}
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground line-clamp-1">
            {hotel.location}
          </p>

          {/* Price row */}
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-foreground">
              {formatCurrency(hotel.price_per_night, hotel.currency)}
            </span>
            <span className="text-sm text-muted-foreground">/night</span>
            <span className="text-xs ml-auto text-muted-foreground">
              {formatCurrency(hotel.total_price, hotel.currency)} total
            </span>
          </div>

          {/* Provenance note */}
          <div>
            <ProvenanceBadge provenance={provenance} category="hotel" showNote={true} />
          </div>

          {/* Amenities */}
          {hotel.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {hotel.amenities.slice(0, 4).map((a, i) => (
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
        </CardContent>
      </div>

      <CardFooter className="p-4 pt-0 mt-auto">
        {/* CTA */}
        <Button
          type="button"
          variant={isSelected ? "default" : "outline"}
          className={cn(
            "w-full text-xs font-semibold h-9 rounded-xl transition-all",
            isSelected ? "shadow-md" : "hover:bg-primary/5 hover:border-primary/50"
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
