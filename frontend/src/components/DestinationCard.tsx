'use client';

import type { Destination } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { MapPin, Sparkles, Calendar, Check, ArrowRight } from 'lucide-react';
import { TravelImage } from '@/components/TravelImage';
import { ProvenanceBadge } from '@/components/ProvenanceBadge';
import { cn } from '@/lib/utils';

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
    <Card
      onClick={() => onSelect(destination.id)}
      className={cn(
        "overflow-hidden cursor-pointer transition-all duration-200 group flex flex-col justify-between border",
        isSelected
          ? "border-primary ring-1 ring-primary shadow-md bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/30"
      )}
    >
      <div>
        {/* Destination Image / Header */}
        <div className="relative h-44 w-full bg-muted overflow-hidden">
          <TravelImage
            src={destination.image_url}
            alt={destination.name}
            category="destination"
            title={destination.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />

          {/* Duration Badge */}
          <div className="absolute top-3 left-3">
            <Badge variant="secondary" className="bg-background/80 backdrop-blur-md border-border/50 text-foreground text-[11px] gap-1 shadow-sm">
              <Calendar className="w-3 h-3 text-primary" />
              <span>{destination.recommended_duration_days} Days</span>
            </Badge>
          </div>

          {/* Match Score Badge */}
          {destination.match_score > 0 && (
            <div className="absolute top-3 right-3">
              <Badge variant="secondary" className="bg-background/80 backdrop-blur-md border-primary/30 text-primary text-[11px] font-mono gap-1 shadow-sm">
                <Sparkles className="w-3 h-3" />
                <span>{Math.round(destination.match_score * 100)}% Match</span>
              </Badge>
            </div>
          )}

          {/* Provenance Badge on Image */}
          <div className="absolute bottom-3 left-3">
            <ProvenanceBadge provenance={destination.provenance} category="destination" />
          </div>
        </div>

        {/* Content Body */}
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                {destination.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{[destination.state, destination.country].filter(Boolean).join(', ')}</span>
              </p>
            </div>

            {/* Budget estimate tag */}
            <div className="text-right shrink-0">
              <span className="text-xs font-semibold text-primary font-mono block">
                {formatCurrency(destination.estimated_cost_min, destination.currency)} - {formatCurrency(destination.estimated_cost_max, destination.currency)}
              </span>
              <span className="text-[10px] text-muted-foreground">est. total</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {destination.description}
          </p>

          {/* Highlights pills */}
          {destination.highlights && destination.highlights.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {destination.highlights.slice(0, 3).map((h, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-[10px] px-2 py-0 h-5 font-normal text-muted-foreground bg-muted/50 border-border"
                >
                  {h}
                </Badge>
              ))}
            </div>
          )}

          {/* Why it matches */}
          {destination.why_it_matches && (
            <div className="mt-1 p-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-[11px] text-green-700 dark:text-green-400 leading-relaxed">
              <span className="font-semibold block mb-0.5 text-green-800 dark:text-green-300">Why this fits you</span>
              {destination.why_it_matches}
            </div>
          )}
        </CardContent>
      </div>

      {/* Select Action Footer */}
      <CardFooter className="p-4 pt-0 mt-auto">
        <Button
          type="button"
          variant={isSelected ? "default" : "outline"}
          className={cn(
            "w-full text-xs font-semibold h-9 rounded-xl transition-all",
            isSelected ? "shadow-md" : "hover:bg-primary/5 hover:border-primary/50"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(destination.id);
          }}
        >
          {isSelected ? (
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> Destination Selected
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              Explore this route <ArrowRight className="w-3.5 h-3.5" />
            </span>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
