"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRates } from "./useMarketData";
import { INSTRUMENTS } from "@/lib/utils/constants";
import {
  loadAllBiasHistory,
  fillOutcomesRetroactively,
  saveInstrumentHistory,
  calculateAccuracyStats,
  calculateInstrumentAccuracy,
} from "@/lib/calculations/bias-accuracy";
import type { BiasHistoryEntry, AccuracyStats } from "@/lib/types/bias";

export function useBiasAccuracy(instrumentId?: string) {
  const { data: ratesData } = useRates();
  const [allHistory, setAllHistory] = useState<Record<string, BiasHistoryEntry[]>>({});
  const initializedRef = useRef(false);

  // Load history on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    setAllHistory(loadAllBiasHistory());
  }, []);

  // Fill outcomes retroactively when prices arrive
  useEffect(() => {
    if (!ratesData?.quotes || Object.keys(allHistory).length === 0) return;

    let anyChanged = false;
    const updatedHistory = { ...allHistory };

    for (const [instId, history] of Object.entries(allHistory)) {
      const instrument = INSTRUMENTS.find((i) => i.id === instId);
      if (!instrument) continue;

      const quote = ratesData.quotes[instId];
      const currentPrice = quote?.mid || 0;
      if (currentPrice === 0) continue;

      const { updated, changed } = fillOutcomesRetroactively(history, currentPrice);
      if (changed) {
        updatedHistory[instId] = updated;
        saveInstrumentHistory(instId, updated);
        anyChanged = true;
      }
    }

    if (anyChanged) {
      setAllHistory(updatedHistory);
    }
  }, [ratesData, allHistory]);

  const stats = useMemo<AccuracyStats | null>(() => {
    if (Object.keys(allHistory).length === 0) return null;
    return calculateAccuracyStats(allHistory);
  }, [allHistory]);

  const instrumentStats = useMemo(() => {
    if (!instrumentId || !allHistory[instrumentId]) return null;
    return calculateInstrumentAccuracy(allHistory[instrumentId]);
  }, [allHistory, instrumentId]);

  return {
    stats,
    instrumentStats,
    allHistory,
    isLoading: !initializedRef.current,
  };
}
