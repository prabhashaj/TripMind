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
    <div className="w-full flex flex-col items-center gap-4">

      {/* Vibe chips */}
      {/* Search card */}
      <form className="search-card w-full" onSubmit={handleSubmit}>
        <div className="px-5 pt-[1.125rem] pb-3">
          <textarea
            ref={textareaRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Optional: where would you like to go, and where are you starting from?"
            rows={3}
            disabled={isLoading}
            className="w-full resize-none bg-transparent text-primary text-[0.9375rem] leading-[1.65] border-none outline-none min-h-[72px] font-inherit"
          />
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border bg-surface">
          <div className="flex items-center gap-2">
            <div className="live-dot" />
            <span className="text-xs text-muted">TripMind ready</span>
            <span className="text-xs text-muted">·</span>
            <span className="text-xs text-muted">
              Press <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[0.6875rem] font-mono text-secondary">Enter</kbd> to plan
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary shrink-0 min-w-[8rem]"
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
        <div className="w-full px-4 py-3 rounded-[0.625rem] bg-red-500/10 border border-red-500/30 text-destructive text-[0.8125rem] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

    </div>
  );
}
