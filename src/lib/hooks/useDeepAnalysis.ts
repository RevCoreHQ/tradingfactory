"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import useSWR from "swr";
import { useTechnicalData } from "./useTechnicalData";
import { useMarketStore } from "@/lib/store/market-store";
import { detectSupplyDemandZones } from "@/lib/calculations/supply-demand-zones";
import { calculateConfluenceLevels } from "@/lib/calculations/confluence-levels";
import type { DeepAnalysisResult, DeepAnalysisLLMResult } from "@/lib/types/deep-analysis";
import type { TechnicalSummary } from "@/lib/types/indicators";
import type { BiasResult } from "@/lib/types/bias";

/**
 * Client-side deep analysis — S/D zones + confluence levels.
 * All computed from existing candle data, no API call.
 */
export function useDeepAnalysis(): {
  deepAnalysis: DeepAnalysisResult | null;
  indicators: TechnicalSummary | null;
  isLoading: boolean;
} {
  const { candles, indicators, isLoading } = useTechnicalData();

  const deepAnalysis = useMemo(() => {
    if (!indicators || candles.length < 20) return null;

    const { supplyZones, demandZones } = detectSupplyDemandZones(
      candles,
      indicators.atr.value
    );

    const confluenceLevels = calculateConfluenceLevels(
      indicators.currentPrice,
      indicators,
      supplyZones,
      demandZones
    );

    return {
      supplyZones,
      demandZones,
      confluenceLevels,
      currentPrice: indicators.currentPrice,
      timestamp: Date.now(),
    };
  }, [candles, indicators]);

  return { deepAnalysis, indicators, isLoading };
}

/**
 * AI trade ideas — optional LLM call triggered by user.
 * Accepts pre-computed data to avoid duplicating hook calls.
 */
export function useDeepAnalysisLLM(
  deepAnalysis: DeepAnalysisResult | null,
  indicators: TechnicalSummary | null,
  biasResult: BiasResult | null,
) {
  const [shouldFetch, setShouldFetch] = useState(false);
  const instrument = useMarketStore((s) => s.selectedInstrument);

  // Build request body only when user triggers generation
  // Only requires indicators — deepAnalysis (zones/confluence) is optional
  const requestBody = useMemo(() => {
    if (!shouldFetch || !indicators) return null;
    return {
      instrument: instrument.id,
      symbol: instrument.symbol,
      category: instrument.category,
      currentPrice: indicators.currentPrice,
      supplyZones: deepAnalysis?.supplyZones.slice(0, 5) ?? [],
      demandZones: deepAnalysis?.demandZones.slice(0, 5) ?? [],
      confluenceLevels: deepAnalysis?.confluenceLevels ?? [],
      trend: indicators.trend,
      rsi: indicators.rsi,
      macd: indicators.macd,
      bollingerBands: indicators.bollingerBands,
      bias: biasResult ? {
        overall: biasResult.overallBias,
        direction: biasResult.direction,
        confidence: biasResult.confidence,
      } : null,
    };
  }, [shouldFetch, deepAnalysis, indicators, biasResult, instrument]);

  // Stable SWR key + ref for body to prevent re-render loops
  const bodyRef = useRef(requestBody);
  bodyRef.current = requestBody;

  const [retryCount, setRetryCount] = useState(0);

  const { data, error, isLoading } = useSWR<{ analysis: DeepAnalysisLLMResult | null }>(
    shouldFetch && requestBody ? `deep-analysis-${instrument.id}-${retryCount}` : null,
    async () => {
      const body = bodyRef.current;
      if (!body) return { analysis: null };
      const res = await fetch("/api/analysis/deep-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 5 * 60 * 1000,
    }
  );

  const generate = useCallback(() => {
    setShouldFetch(true);
  }, []);

  const retry = useCallback(() => {
    setRetryCount((c) => c + 1);
  }, []);

  return {
    tradeIdeas: data?.analysis || null,
    isLoading,
    error,
    generate,
    retry,
    isRequested: shouldFetch,
  };
}
