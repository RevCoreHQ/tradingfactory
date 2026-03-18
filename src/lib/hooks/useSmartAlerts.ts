"use client";

import { useEffect, useRef } from "react";
import { useMarketStore } from "@/lib/store/market-store";
import { useRates } from "@/lib/hooks/useMarketData";
import { evaluateAlerts, pruneExpiredAlerts } from "@/lib/calculations/alert-engine";

export function useSmartAlerts() {
  const biasTimeframe = useMarketStore((s) => s.biasTimeframe);
  const hashRef = useRef("");

  const { data: ratesData } = useRates();

  useEffect(() => {
    const state = useMarketStore.getState();
    if (!state.alertConfig.enabled) return;

    const quotes = ratesData?.quotes;
    if (!quotes) return;

    const allBias = state.allBiasResults[biasTimeframe];
    const llm = state.batchLLMResults;
    if (!allBias || Object.keys(allBias).length === 0) return;

    // Build prices map from quotes
    const prices: Record<string, number> = {};
    for (const [id, q] of Object.entries(quotes)) {
      if (q && typeof q === "object" && "mid" in q) {
        prices[id] = (q as { mid: number }).mid;
      }
    }

    // Hash to avoid re-evaluating on same data
    const hash = JSON.stringify(Object.values(prices).map((p) => Math.round(p * 100)));
    if (hash === hashRef.current) return;
    hashRef.current = hash;

    // Prune expired alerts first
    const pruned = pruneExpiredAlerts(state.alerts);
    if (pruned.length !== state.alerts.length) {
      useMarketStore.setState({ alerts: pruned });
    }

    // Evaluate new alerts
    const newAlerts = evaluateAlerts(prices, allBias, llm, pruned, state.alertConfig);
    if (newAlerts.length > 0) {
      state.addAlerts(newAlerts);
    }
  }, [ratesData, biasTimeframe]);
}
