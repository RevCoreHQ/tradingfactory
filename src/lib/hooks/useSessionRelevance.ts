"use client";

import { useEffect, useState } from "react";
import { getSessionRelevance, getAllSessionRelevances } from "@/lib/calculations/session-scoring";
import type { SessionRelevance } from "@/lib/calculations/session-scoring";

export function useSessionRelevance(instrumentId?: string) {
  const [relevance, setRelevance] = useState<SessionRelevance | null>(
    instrumentId ? getSessionRelevance(instrumentId) : null
  );
  const [allRelevances, setAllRelevances] = useState<Record<string, SessionRelevance>>(
    getAllSessionRelevances
  );

  useEffect(() => {
    // Update immediately when instrumentId changes
    if (instrumentId) {
      setRelevance(getSessionRelevance(instrumentId));
    }

    // Refresh every 60 seconds
    const timer = setInterval(() => {
      if (instrumentId) setRelevance(getSessionRelevance(instrumentId));
      setAllRelevances(getAllSessionRelevances());
    }, 60_000);

    return () => clearInterval(timer);
  }, [instrumentId]);

  return { relevance, allRelevances };
}
