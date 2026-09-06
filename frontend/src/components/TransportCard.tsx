'use client';

import type { TransportLeg } from '@/lib/api';
import { ProvenanceBadge } from '@/components/ProvenanceBadge';
import { Plane, Train, Bus, Car } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

function renderModeIcon(mode: string) {
  switch (mode) {
    case 'flight':
      return <Plane className="w-4 h-4 text-sky-500" />;
    case 'train':
      return <Train className="w-4 h-4 text-green-500" />;
    case 'bus':
      return <Bus className="w-4 h-4 text-amber-500" />;
    default:
      return <Car className="w-4 h-4 text-purple-500" />;
  }
}

const MODE_LABELS: Record<string, string> = {
  flight: 'Flight',
  train: 'Train',
  bus: 'Bus',
  car: 'Car',
};

export function TransportCard({ leg, onSelect, isSelected }: TransportCardProps) {
  const isMock = leg.source === 'mock';
  const provenance = leg.provenance || (isMock ? 'estimated' : 'verified');
  const category = leg.mode === 'flight' ? 'flight' : leg.mode === 'train' ? 'train' : 'general';

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all duration-200 cursor-pointer group flex flex-col justify-between border",
        isSelected
          ? "border-primary ring-1 ring-primary shadow-md bg-primary/5"
          : "border-border shadow-sm hover:border-primary/30"
      )}
    >
      <CardContent className="p-4 flex flex-col gap-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Mode badge */}
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                isSelected ? "bg-primary/10 border-primary/20" : "bg-muted border-border"
              )}
            >
              {renderModeIcon(leg.mode)}
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                {MODE_LABELS[leg.mode] || leg.mode}
              </div>
              <div className="text-sm font-semibold text-foreground">
                {leg.carrier || leg.provider}
              </div>
            </div>
          </div>

          {/* Price */}
          <div className="text-right">
            <div className={cn(
              "text-xl font-bold font-display",
              isSelected ? "text-primary" : "text-foreground"
            )}>
              {formatCurrency(leg.price, leg.currency)}
            </div>
            {leg.price_label && (
              <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400 mt-1 border-none text-[10px] py-0">
                {leg.price_label}
              </Badge>
            )}
          </div>
        </div>

        {/* Route row */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold font-display tabular-nums text-foreground">
              {formatTime(leg.departure_time)}
            </div>
            <div className="text-xs mt-0.5 text-muted-foreground">
              {leg.origin}
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center gap-1">
            <div className="text-xs text-muted-foreground">
              {formatDuration(leg.duration_minutes)}
            </div>
            <div className="w-full flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-muted-foreground" />
              <div className="flex-1 h-px bg-border" />
              {leg.stops === 0 ? (
                <span className="text-xs shrink-0 text-green-600 dark:text-green-500">Direct</span>
              ) : (
                <span className="text-xs shrink-0 text-muted-foreground">{leg.stops} stop{leg.stops > 1 ? 's' : ''}</span>
              )}
              <div className="flex-1 h-px bg-border" />
              <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-muted-foreground" />
            </div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold font-display tabular-nums text-foreground">
              {formatTime(leg.arrival_time)}
            </div>
            <div className="text-xs mt-0.5 text-muted-foreground">
              {leg.destination}
            </div>
          </div>
        </div>

        {/* Provenance badge & details */}
        <div className="mt-1 pt-3 border-t border-border flex flex-col gap-1.5">
          <ProvenanceBadge provenance={provenance} category={category} showNote={true} />
        </div>
      </CardContent>

      {onSelect && (
        <CardFooter className="p-4 pt-0 mt-auto">
          <Button
            type="button"
            variant={isSelected ? "default" : "outline"}
            onClick={() => onSelect(leg.id)}
            className={cn(
              "w-full text-xs font-semibold h-9 rounded-xl transition-all",
              isSelected ? "shadow-md" : "hover:bg-primary/5 hover:border-primary/50"
            )}
          >
            {isSelected ? 'Selected Transport' : 'Select This Route'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
