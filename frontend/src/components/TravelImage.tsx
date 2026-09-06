"use client";

import { useState, useEffect } from "react";
import { MapPin, Hotel, Compass, Plane } from "lucide-react";

interface TravelImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  category?: "destination" | "hotel" | "activity" | "transport" | "scenic";
  title?: string;
}

const CATEGORY_FALLBACKS: Record<string, string> = {
  destination: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&auto=format&fit=crop&q=80",
  hotel: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1000&auto=format&fit=crop&q=80",
  activity: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1000&auto=format&fit=crop&q=80",
  transport: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1000&auto=format&fit=crop&q=80",
  scenic: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80",
};

export function TravelImage({
  src,
  alt = "",
  className = "",
  category,
  title,
  style,
  ...props
}: TravelImageProps) {
  const [hasError, setHasError] = useState(false);
  const [triedFallback, setTriedFallback] = useState(false);

  // Determine fallback image based on category or alt text heuristics
  const inferredCategory =
    category ||
    (alt.toLowerCase().includes("hotel") || alt.toLowerCase().includes("stay") || alt.toLowerCase().includes("resort")
      ? "hotel"
      : alt.toLowerCase().includes("flight") || alt.toLowerCase().includes("train") || alt.toLowerCase().includes("transit")
      ? "transport"
      : alt.toLowerCase().includes("tour") || alt.toLowerCase().includes("experience") || alt.toLowerCase().includes("activity") || alt.toLowerCase().includes("temple") || alt.toLowerCase().includes("museum")
      ? "activity"
      : "destination");

  const fallbackUrl = CATEGORY_FALLBACKS[inferredCategory] || CATEGORY_FALLBACKS.destination;

  // Reset error state if src changes
  useEffect(() => {
    setHasError(false);
    setTriedFallback(false);
  }, [src]);

  // Valid initial URL test
  const isValidUrl = Boolean(src && typeof src === "string" && src.trim().length > 5 && src.startsWith("http"));

  if (!isValidUrl || hasError) {
    if (!triedFallback && isValidUrl) {
      // Try high-quality Unsplash category image first
      return (
        <img
          src={fallbackUrl}
          alt={alt}
          className={className}
          style={style}
          onError={() => {
            setTriedFallback(true);
            setHasError(true);
          }}
          {...props}
        />
      );
    }

    // Elegant, resilient CSS/SVG styled placeholder if external images fail or no URL provided
    const IconComponent =
      inferredCategory === "hotel"
        ? Hotel
        : inferredCategory === "transport"
        ? Plane
        : inferredCategory === "activity"
        ? Compass
        : MapPin;

    return (
      <div
        className={`flex flex-col items-center justify-center relative overflow-hidden select-none ${className}`}
        style={{
          background: "linear-gradient(135deg, #182236 0%, #0d131f 100%)",
          minHeight: "140px",
          color: "rgba(255, 255, 255, 0.7)",
          ...style,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at 50% 30%, rgba(167, 122, 43, 0.15) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.07)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "0.5rem",
            border: "1px solid rgba(255, 255, 255, 0.12)",
          }}
        >
          <IconComponent className="w-5 h-5 text-amber-500" />
        </div>
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "rgba(255, 255, 255, 0.9)",
            textAlign: "center",
            padding: "0 1rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "90%",
          }}
        >
          {title || alt || "TripMind Discovery"}
        </span>
        <span
          style={{
            fontSize: "0.625rem",
            color: "rgba(255, 255, 255, 0.5)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginTop: "0.15rem",
          }}
        >
          {inferredCategory}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={() => {
        setHasError(true);
      }}
      {...props}
    />
  );
}
