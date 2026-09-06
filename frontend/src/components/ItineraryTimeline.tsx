'use client';

import { useState } from 'react';
import type { ItineraryDay, ItineraryItem, Activity, HotelOption } from '@/lib/api';
import { formatINR } from '@/lib/utils';
import {
  Clock,
  MapPin,
  Sparkles,
  Car,
  Footprints,
  Repeat,
  Map as MapIcon,
  List,
  X,
  Plane,
  Hotel,
  Compass,
  Utensils,
  Coffee,
} from 'lucide-react';
import { InteractiveTripMap } from './InteractiveTripMap';
import { TravelImage } from './TravelImage';

interface ItineraryTimelineProps {
  days: ItineraryDay[];
  selectedDayIndex: number;
  onSelectDay: (index: number) => void;
  allActivities?: Activity[];
  allHotels?: HotelOption[];
  destinationName?: string;
  selectedHotelId?: string;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  transport: { icon: Plane, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', label: 'Flight / Transit' },
  flight: { icon: Plane, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', label: 'Flight' },
  check_in: { icon: Hotel, color: '#a77a2b', bg: 'rgba(167, 122, 43, 0.12)', label: 'Hotel Check-In' },
  check_out: { icon: Hotel, color: '#a77a2b', bg: 'rgba(167, 122, 43, 0.12)', label: 'Hotel Check-Out' },
  activity: { icon: Compass, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', label: 'Experience' },
  meal: { icon: Utensils, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', label: 'Dining' },
  rest: { icon: Coffee, color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', label: 'Rest / Leisure' },
  free_time: { icon: Sparkles, color: '#c9aa6c', bg: 'rgba(201, 170, 108, 0.12)', label: 'Free Exploration' },
  transfer: { icon: Car, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', label: 'Local Transfer' },
};

function itemImage(item: ItineraryItem): { src: string; category: 'activity' | 'hotel' | 'transport'; alt: string } {
  if (['transport', 'transfer', 'flight'].includes(item.type)) {
    return { src: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=360&auto=format&fit=crop&q=80', category: 'transport', alt: item.location || item.title };
  }
  if (['check_in', 'check_out'].includes(item.type)) {
    return { src: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=360&auto=format&fit=crop&q=80', category: 'hotel', alt: item.location || item.title };
  }
  const title = `${item.title} ${item.location || ''}`.toLowerCase();
  const src = title.includes('beach') || title.includes('coast')
    ? 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=360&auto=format&fit=crop&q=80'
    : title.includes('temple') || title.includes('museum')
    ? 'https://images.unsplash.com/photo-1564399579883-451a5d44ec08?w=360&auto=format&fit=crop&q=80'
    : 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=360&auto=format&fit=crop&q=80';
  return { src, category: 'activity', alt: item.location || item.title };
}

function fmtDur(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h > 0 && `${h}h`, m > 0 && `${m}m`].filter(Boolean).join(' ');
}

export function ItineraryTimeline({
  days,
  selectedDayIndex,
  onSelectDay,
  allActivities = [],
  allHotels = [],
  destinationName,
  selectedHotelId,
}: ItineraryTimelineProps) {
  const [viewMode, setViewMode] = useState<'timeline' | 'map' | 'split'>('timeline');
  const [swappingItemIndex, setSwappingItemIndex] = useState<number | null>(null);

  const day = days[selectedDayIndex] || days[0];

  const handleSwapActivity = (index: number, newAct: Activity) => {
    if (!day) return;
    day.items[index] = {
      ...day.items[index],
      title: newAct.name,
      description: newAct.description,
      location: newAct.location,
      estimated_cost: newAct.price_per_person,
      activity_id: newAct.id,
    };
    setSwappingItemIndex(null);
  };

  return (
    <div className="itinerary-timeline flex flex-col gap-6">
      {/* Top Controls: Day selector & View Mode Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Horizontal Day Switcher */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {days.map((d, i) => {
            const active = i === selectedDayIndex;
            return (
              <button
                key={d.id || i}
                onClick={() => {
                  onSelectDay(i);
                  setSwappingItemIndex(null);
                }}
                className={`flex-shrink-0 flex flex-col items-start px-3.5 py-2 rounded-xl transition-all ${
                  active
                    ? 'bg-amber-500/15 border border-amber-500/40 text-amber-300 shadow-lg shadow-amber-500/10'
                    : 'bg-[var(--color-bg-card)] border border-[var(--color-border)] text-slate-300 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold font-mono">Day {d.day_number}</span>
                  {active && <Sparkles className="w-3 h-3 text-amber-500" />}
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5 max-w-[110px] truncate">
                  {d.location || 'Exploring'}
                </span>
              </button>
            );
          })}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-white/10 self-end md:self-auto">
          <button
            onClick={() => setViewMode('timeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              viewMode === 'timeline' ? 'bg-amber-500 text-black font-bold' : 'text-slate-300 hover:text-white'
            }`}
          >
            <List className="w-3.5 h-3.5" /> Timeline
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
              viewMode === 'map' ? 'bg-amber-500 text-black font-bold' : 'text-slate-300 hover:text-white'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" /> Route Map
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`hidden lg:flex px-3 py-1.5 rounded-lg text-xs font-medium items-center gap-1.5 transition-all ${
              viewMode === 'split' ? 'bg-amber-500 text-black font-bold' : 'text-slate-300 hover:text-white'
            }`}
          >
            Split View
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {day && (
        <div className={`grid gap-6 ${viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Timeline Column */}
          {(viewMode === 'timeline' || viewMode === 'split') && (
            <div className="space-y-4">
              {/* Day Overview Header */}
              <div className="p-4 md:p-5 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">
                    Day {day.day_number} •{' '}
                    {day.date
                      ? new Date(day.date).toLocaleDateString([], {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Planned Itinerary'}
                  </span>
                  {day.total_cost > 0 && (
                    <span className="text-xs font-bold font-mono text-emerald-400">
                      Est. Spend: {formatINR(day.total_cost)}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold font-display text-white mb-1">{day.title}</h3>
                <p className="text-xs text-slate-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-500" />
                  {day.location}
                </p>
              </div>

              {/* Items Timeline */}
              <div className="space-y-2">
                {day.items.map((item, i) => {
                  const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.activity;
                  const Icon = cfg.icon;
                  const isLast = i === day.items.length - 1;

                  return (
                    <div key={item.id || i} className="relative">
                      <div className="flex gap-4 items-start">
                        {/* Timeline Icon & Vertical Line */}
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border shadow-md"
                            style={{
                              background: cfg.bg,
                              borderColor: `${cfg.color}40`,
                              color: cfg.color,
                            }}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          {!isLast && (
                            <div
                              className="w-0.5 flex-1 my-1.5"
                              style={{
                                background:
                                  'linear-gradient(to bottom, var(--color-border), rgba(255,255,255,0.05))',
                                minHeight: '36px',
                              }}
                            />
                          )}
                        </div>

                        {/* Card Body */}
                        <div className="flex-1 pb-4 min-w-0">
                          <div className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-sm hover:border-white/20 transition-all">
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className="text-xs font-bold font-mono px-2 py-0.5 rounded-md"
                                  style={{
                                    color: cfg.color,
                                    background: cfg.bg,
                                    border: `1px solid ${cfg.color}30`,
                                  }}
                                >
                                  {item.time}
                                </span>
                                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                                  {cfg.label}
                                </span>
                                {item.duration_minutes && (
                                  <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {fmtDur(item.duration_minutes)}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {item.estimated_cost > 0 && (
                                  <span className="text-xs font-bold font-mono text-white">
                                    {formatINR(item.estimated_cost)}
                                  </span>
                                )}

                                {/* One-click Swap Trigger */}
                                {allActivities.length > 0 && item.type === 'activity' && (
                                  <button
                                    onClick={() =>
                                      setSwappingItemIndex(swappingItemIndex === i ? null : i)
                                    }
                                    title="Swap with alternative activity"
                                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-all"
                                  >
                                    <Repeat className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="flex items-start gap-3">
                              <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-bold text-white mb-1">{item.title}</h4>
                                {item.location && (
                                  <p className="text-xs text-slate-400 flex items-center gap-1 mb-2">
                                    <MapPin className="w-3 h-3 text-amber-500" />
                                    {item.location}
                                  </p>
                                )}
                                {item.description && <p className="text-xs text-slate-300 leading-relaxed">{item.description}</p>}
                              </div>
                              {(() => {
                                const image = itemImage(item);
                                return <TravelImage src={image.src} alt={image.alt} category={image.category} className="h-20 w-28 shrink-0 rounded-lg object-cover shadow-sm ring-1 ring-black/10 transition-transform duration-300 hover:scale-[1.04]" />;
                              })()}
                            </div>

                            {/* In-place Activity Swap Drawer */}
                            {swappingItemIndex === i && (
                              <div className="mt-3 pt-3 border-t border-white/10 space-y-2 animate-scale-in">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-amber-400">
                                    Select alternative experience:
                                  </span>
                                  <button
                                    onClick={() => setSwappingItemIndex(null)}
                                    className="text-slate-400 hover:text-white"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                                  {allActivities.slice(0, 5).map((act) => (
                                    <div
                                      key={act.id}
                                      onClick={() => handleSwapActivity(i, act)}
                                      className="p-2 rounded-lg bg-slate-800/80 hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/30 cursor-pointer flex items-center justify-between gap-2 text-xs transition-all"
                                    >
                                      <div className="min-w-0">
                                        <p className="font-semibold text-white truncate">
                                          {act.name}
                                        </p>
                                        <p className="text-[10px] text-slate-400 truncate">
                                          {act.location} • {act.duration_hours || 2}h
                                        </p>
                                      </div>
                                      <button className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                                        Swap
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Interactive Map Column */}
          {(viewMode === 'map' || viewMode === 'split') && (
            <div className="sticky top-20">
              <InteractiveTripMap
                destinationName={destinationName || day.location}
                day={day}
                hotels={allHotels}
                selectedHotelId={selectedHotelId}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
