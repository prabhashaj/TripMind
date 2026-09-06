"use client";

import dynamic from "next/dynamic";
import React from "react";
import { Loader2 } from "lucide-react";
import "leaflet/dist/leaflet.css";

// Use dynamic import with ssr: false to avoid Next.js server-side rendering issues with Leaflet
const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-card border border-border rounded-xl">
      <Loader2 className="w-8 h-8 animate-spin text-amber-700" />
    </div>
  ),
});

export type MapPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: "hotel" | "activity" | "destination";
  day_index?: number;
};

interface TripMapProps {
  points: MapPoint[];
  className?: string;
}

export function TripMap({ points, className = "" }: TripMapProps) {
  return (
    <div className={`trip-map-container ${className} w-full h-full min-h-[400px] rounded-xl overflow-hidden border border-border`}>
      <LeafletMap points={points} />
    </div>
  );
}
