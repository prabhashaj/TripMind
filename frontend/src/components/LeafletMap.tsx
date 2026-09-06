import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import type { MapPoint } from "./TripMap";

// Fix leaflet default icon issue in Next.js
const customIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// A component to automatically fit the map bounds to the markers
function BoundsFitter({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [map, points]);
  return null;
}

export default function LeafletMap({ points }: { points: MapPoint[] }) {
  // Only use points that have valid coordinates
  const validPoints = points.filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
  const positions: [number, number][] = validPoints.map((p) => [p.lat, p.lng]);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <MapContainer
      center={positions.length > 0 ? positions[0] : [0, 0]}
      zoom={13}
      scrollWheelZoom={true}
      className="w-full h-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {validPoints.map((point) => (
        <Marker key={point.id} position={[point.lat, point.lng]} icon={customIcon}>
          <Popup>
            <div className="font-semibold">{point.name}</div>
            <div className="text-xs text-muted capitalize">
              {point.type} {point.day_index !== undefined ? `- Day ${point.day_index}` : ""}
            </div>
          </Popup>
        </Marker>
      ))}
      {positions.length > 1 && (
        <Polyline positions={positions} pathOptions={{ color: "var(--color-primary-500)", weight: 3, opacity: 0.8 }} />
      )}
      <BoundsFitter points={validPoints} />
    </MapContainer>
  );
}
