'use client';

import { MapPin, Clock, Star, Sparkles } from 'lucide-react';
import type { Activity } from '@/lib/api';
import { ProvenanceBadge } from '@/components/ProvenanceBadge';
import { TravelImage } from '@/components/TravelImage';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ActivityCardProps {
  activity: Activity;
  onAdd?: (id: string) => void;
  isAdded?: boolean;
}

function fmtCurrency(amount: number, currency = 'INR'): string {
  if (!amount) return 'Free admission';
  if (currency === 'INR') return `₹${Math.round(amount).toLocaleString('en-IN')}/person`;
  return `${currency} ${amount}/person`;
}

/** Derives a one-line "why this fits you" from activity data. */
function deriveWhyItFits(activity: Activity): string | null {
  if (activity.why_it_matches) return activity.why_it_matches;
  if (activity.fit_reason) return activity.fit_reason;
  if (!activity.tags?.length) return null;
  return `Matches your interests: ${activity.tags.slice(0, 3).join(', ')}.`;
}

export function ActivityCard({ activity, onAdd, isAdded }: ActivityCardProps) {
  const isMock = activity.source === 'mock';
  const provenance = isMock ? 'mock' : (activity.provenance ?? 'estimated');
  const whyItFits = deriveWhyItFits(activity);

  return (
    <Card
      className={cn(
        'transition-all duration-200 group flex flex-col justify-between border overflow-hidden',
        isAdded
          ? 'border-green-500/40 ring-1 ring-green-500/20 shadow-md bg-green-50/10'
          : 'border-border shadow-sm hover:border-primary/30',
      )}
    >
      {/* ── Image — 16:9 aspect ratio ── */}
      {(activity.image_url || activity.category) && (
        <div className="card-image-16-9">
          <TravelImage
            src={activity.image_url}
            alt={activity.name}
            category="activity"
            title={activity.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent" />

          {activity.rating && (
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/70 backdrop-blur-sm text-white rounded-full px-2 py-0.5 text-xs font-semibold border border-white/15">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {activity.rating.toFixed(1)}
            </div>
          )}

          {/* Provenance on image */}
          <div className="absolute bottom-3 left-3">
            <ProvenanceBadge provenance={provenance} source={activity.source} category="activity" />
          </div>
        </div>
      )}

      <CardContent className="p-4 flex flex-col gap-2.5">
        {/* Header */}
        <div className="flex items-start gap-3">
          {!activity.image_url && (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 border border-primary/20">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-semibold leading-tight text-foreground">
                {activity.name}
              </h4>
              {!activity.image_url && activity.rating && (
                <Badge
                  variant="secondary"
                  className="flex items-center gap-0.5 px-1.5 py-0 h-5 bg-amber-500/10 text-amber-700 dark:text-amber-500 border-none shrink-0 text-[10px]"
                >
                  <span>{activity.rating.toFixed(1)}</span>
                  <Star className="w-2.5 h-2.5 fill-amber-500" />
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{activity.location}</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {activity.description}
        </p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {!activity.image_url && (
            <ProvenanceBadge provenance={provenance} source={activity.source} category="activity" />
          )}
          {activity.duration_hours && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              {activity.duration_hours}h
            </span>
          )}
          <span
            className={cn(
              'font-semibold',
              activity.price_per_person === 0
                ? 'text-green-600 dark:text-green-500'
                : 'text-foreground',
            )}
          >
            {fmtCurrency(activity.price_per_person, activity.currency)}
          </span>
        </div>

        {/* Tags */}
        {activity.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activity.tags.slice(0, 3).map((tag: string, i: number) => (
              <Badge
                key={i}
                variant="outline"
                className="text-[10px] px-2 py-0 h-5 font-normal text-muted-foreground bg-muted/50 border-border"
              >
                {tag}
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

      {onAdd && (
        <CardFooter className="p-4 pt-0 mt-auto">
          <Button
            type="button"
            variant={isAdded ? 'outline' : 'secondary'}
            size="sm"
            onClick={() => onAdd(activity.id)}
            className={cn(
              'w-full text-xs font-semibold h-8 rounded-lg transition-all',
              isAdded
                ? 'bg-green-50/50 hover:bg-green-100/50 text-green-700 dark:text-green-400 border-green-200/50 shadow-none'
                : 'bg-muted hover:bg-primary/10 hover:text-primary text-foreground shadow-sm',
            )}
          >
            {isAdded ? '✓ Added to Itinerary' : '+ Add to Itinerary'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
