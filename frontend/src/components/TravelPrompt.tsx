"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, getUserId } from "@/lib/api";
import { useTripStore } from "@/store/trip-store";
import {
  ArrowRight,
  AlertCircle,
  Loader2,
} from "lucide-react";

export function TravelPrompt() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const { setTripId, setIsPlanning, reset } = useTripStore();

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [query]);

  const handleSubmit = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const detail = query.trim() || textareaRef.current?.value.trim() || "Anywhere";
    if (isLoading) return;
    const trimmed = detail;
    setError("");
    setIsLoading(true);
    try {
      reset();
      const response = await api.startPlanning(trimmed, getUserId());
      setTripId(response.trip_id);
      setIsPlanning(true);
      router.push(`/plan/${response.trip_id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown request error";
      setError(`Could not start planning: ${message}. Check that the backend is running on port 8000.`);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>

      {/* Vibe chips */}
      {/* Search card */}
      <form className="search-card" style={{ width: "100%" }} onSubmit={handleSubmit}>
        <div style={{ padding: "1.125rem 1.25rem 0.75rem" }}>
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Optional: where would you like to go, and where are you starting from?"
            rows={3}
            disabled={isLoading}
            style={{
              width: "100%",
              resize: "none",
              background: "transparent",
              color: "var(--color-text-primary)",
              fontSize: "0.9375rem",
              lineHeight: 1.65,
              border: "none",
              outline: "none",
              minHeight: "72px",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Footer row */}
        <div style={{ padding: "0.75rem 1.25rem", borderTop: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", background: "var(--color-bg-surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div className="live-dot" />
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>TripMind ready</span>
            <span style={{ color: "var(--color-border-strong)", fontSize: "0.75rem" }}>·</span>
            <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
              Press <kbd style={{ padding: "0.125rem 0.375rem", background: "var(--color-bg-muted)", border: "1px solid var(--color-border)", borderRadius: "0.25rem", fontSize: "0.6875rem", fontFamily: "monospace", color: "var(--color-text-secondary)" }}>Enter</kbd> to plan
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary"
            style={{ flexShrink: 0, minWidth: "8rem" }}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Planning...
              </>
            ) : (
              <>
                Plan my trip
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div style={{ width: "100%", padding: "0.75rem 1rem", borderRadius: "0.625rem", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "var(--color-error)", fontSize: "0.8125rem", display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

    </div>
  );
}
