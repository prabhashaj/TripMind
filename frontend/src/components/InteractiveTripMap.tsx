'use client';

import { useEffect, useRef, useState } from 'react';
import type { ItineraryDay, HotelOption } from '@/lib/api';
import { Navigation, Clock } from 'lucide-react';

interface InteractiveTripMapProps {
  destinationName?: string;
  day?: ItineraryDay;
  hotels?: HotelOption[];
  selectedHotelId?: string;
}

// Coordinate fallbacks for known destinations
const DESTINATION_COORDS: Record<string, [number, number]> = {
  srinagar: [34.0837, 74.7973],
  kashmir: [34.0837, 74.7973],
  goa: [15.2993, 74.124],
  coorg: [12.3375, 75.8069],
  udaipur: [24.5854, 73.7125],
  kyoto: [35.0116, 135.7681],
  tokyo: [35.6762, 139.6503],
  paris: [48.8566, 2.3522],
  london: [51.5074, -0.1278],
  amalfi: [40.634, 14.6027],
  default: [20.5937, 78.9629],
};

function getCenter(name?: string): [number, number] {
  if (!name) return DESTINATION_COORDS.default;
  const lower = name.toLowerCase();
  for (const [k, coords] of Object.entries(DESTINATION_COORDS)) {
    if (lower.includes(k)) return coords;
  }
  return DESTINATION_COORDS.default;
}

export function InteractiveTripMap({
  destinationName,
  day,
  hotels = [],
  selectedHotelId,
}: InteractiveTripMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const lineRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [resolvedStops, setResolvedStops] = useState<Record<string, [number, number]>>({});

  // Resolve itinerary labels through Mapbox before placing pins. No estimated
  // coordinates are used, so every displayed stop is an actual geocoding hit.
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token || !day?.items?.length) return;
    let cancelled = false;
    const resolve = async () => {
      const entries = await Promise.all(day.items.map(async (item, index) => {
        if (item.geo?.lat !== undefined && item.geo?.lng !== undefined) return [String(index), [item.geo.lat, item.geo.lng] as [number, number]];
        const query = [item.location || item.title, destinationName].filter(Boolean).join(', ');
        try {
          const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=1&access_token=${token}`);
          const data = await response.json();
          const center = data.features?.[0]?.center;
          return center ? [String(index), [center[1], center[0]] as [number, number]] : null;
        } catch { return null; }
      }));
      if (!cancelled) setResolvedStops(Object.fromEntries(entries.filter(Boolean) as [string, [number, number]][]));
    };
    void resolve();
    return () => { cancelled = true; };
  }, [day, destinationName]);

  // Dynamically load Leaflet assets on client
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ((window as any).L) {
      setMapLoaded(true);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => setMapLoaded(true);
    document.body.appendChild(script);

    return () => {
      // Keep script cached
    };
  }, []);

  // Initialize or update Map
  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const center = getCenter(destinationName);

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView(center, 12);

      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      const tileUrl = mapboxToken
        ? `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}@2x?access_token=${mapboxToken}`
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
      L.tileLayer(tileUrl, mapboxToken
        ? { maxZoom: 20, tileSize: 512, zoomOffset: -1 }
        : { maxZoom: 19, subdomains: 'abcd' }
      ).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear previous markers & lines
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];
    if (lineRef.current) {
      map.removeLayer(lineRef.current);
      lineRef.current = null;
    }

    const points: [number, number][] = [];

    // Add selected hotel marker if available
    const selectedHotel = hotels.find((h) => h.id === selectedHotelId) || hotels[0];
    if (selectedHotel?.geo?.lat !== undefined && selectedHotel.geo?.lng !== undefined) {
      const hotelLat = selectedHotel.geo.lat;
      const hotelLng = selectedHotel.geo.lng;
      points.push([hotelLat, hotelLng]);

      const hotelIcon = L.divIcon({
        className: 'custom-map-icon',
        html: `<div style="background:#a77a2b;color:white;width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.3);font-size:14px;border:2px solid white;">🏨</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const hotelMarker = L.marker([hotelLat, hotelLng], { icon: hotelIcon })
        .addTo(map)
        .bindPopup(
          `<b>${selectedHotel.name}</b><br/>⭐ ${selectedHotel.rating || 4.5} • ₹${selectedHotel.price_per_night}/night`
        );
      markersRef.current.push(hotelMarker);
    }

    // Add Day Items markers
    if (day && day.items) {
      day.items.forEach((item, idx) => {
        // Never invent a location. Only map coordinates supplied by a provider.
        const resolved = item.geo?.lat !== undefined && item.geo?.lng !== undefined
          ? [item.geo.lat, item.geo.lng] as [number, number]
          : resolvedStops[String(idx)];
        if (!resolved) return;
        const [itemLat, itemLng] = resolved;

        points.push([itemLat, itemLng]);

        const markerIcon = L.divIcon({
          className: 'custom-map-icon',
          html: `<div style="background:#8b5cf6;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(139,92,246,0.5);font-size:11px;font-weight:700;border:2px solid white;">${
            idx + 1
          }</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([itemLat, itemLng], { icon: markerIcon })
          .addTo(map)
          .bindPopup(`<b>${item.time} - ${item.title}</b><br/>${item.location || ''}`);
        markersRef.current.push(marker);
      });
    }

    // Draw the actual Mapbox road route when at least two verified points exist.
    if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40] });
      const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (token) {
        const coordinates = points.map(([lat, lng]) => `${lng},${lat}`).join(';');
        void fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&overview=full&access_token=${token}`)
          .then((response) => response.json())
          .then((data) => {
            const route = data.routes?.[0]?.geometry?.coordinates;
            if (!route || !mapInstanceRef.current) return;
            if (lineRef.current) map.removeLayer(lineRef.current);
            lineRef.current = L.polyline(route.map(([lng, lat]: [number, number]) => [lat, lng]), {
              color: '#6d28d9', weight: 4, opacity: 0.82,
            }).addTo(map);
          })
          .catch(() => undefined);
      }
    } else {
      map.setView(center, 12);
    }
  }, [mapLoaded, destinationName, day, hotels, selectedHotelId, resolvedStops]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-[var(--color-border-strong)] shadow-lg bg-[var(--color-bg-card)]">
      {/* Map Header Overlay */}
      <div className="absolute top-3 left-3 z-[1000] bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[var(--color-border)] flex items-center gap-2 text-xs shadow-md">
        <Navigation className="w-3.5 h-3.5 text-amber-500" />
        <span className="font-semibold text-[var(--color-text-primary)]">
          {day ? `Day ${day.day_number} Route Map` : 'Interactive Destination Map'}
        </span>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          • {day?.items.length || 0} stops
        </span>
      </div>

      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-[360px] md:h-[420px]" />

      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 text-[var(--color-text-secondary)] text-xs">
          <Clock className="w-4 h-4 mr-2 animate-spin text-amber-500" />
          Loading interactive map...
        </div>
      )}
    </div>
  );
}
