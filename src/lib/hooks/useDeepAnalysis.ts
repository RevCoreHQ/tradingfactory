"use client";

import { useMemo, useState, useCallback } from "react";
import useSWR from "swr";
import { useTechnicalData } from "./useTechnicalData";
import { useBiasScore } from "./useBiasScore";
import { useMarketStore } from "@/lib/store/market-store";
import { useMarketNews, useFearGreed, useBondYields, useCentralBanks } from "./useMarketData";
import { detectSupplyDemandZones } from "@/lib/calculations/supply-demand-zones";
import { calculateConfluenceLevels } from "@/lib/calculations/confluence-levels";
import type { DeepAnalysisResult, DeepAnalysisLLMResult } from "@/lib/types/deep-analysis";

/**
 * Client-side deep analysis — S/D zones + confluence levels.
 * All computed from existing candle data, no API call.
 */
export function useDeepAnalysis(): {
  deepAnalysis: DeepAnalysisResult | null;
  isLoading: boolean;
} {
  const { candles, indicators, isLoading } = useTechnicalData();

  const deepAnalysis = useMemo(() => {
    if (!indicators || candles.length < 50) return null;

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

  return { deepAnalysis, isLoading };
}

/**
 * AI trade ideas — optional LLM call triggered by user.
 */
export function useDeepAnalysisLLM(deepAnalysis: DeepAnalysisResult | null) {
  const [shouldFetch, setShouldFetch] = useState(false);
  const instrument = useMarketStore((s) => s.selectedInstrument);
  const { biasResult } = useBiasScore();
  const { indicators } = useTechnicalData();
  const { data: newsData } = useMarketNews();
  const { data: fearGreedData } = useFearGreed();
  const { data: bondData } = useBondYields();
  const { data: bankData } = useCentralBanks();

  const requestBody = shouldFetch && deepAnalysis && indicators ? {
    instrument: instrument.id,
    symbol: instrument.symbol,
    category: instrument.category,
    currentPrice: indicators.currentPrice,
    supplyZones: deepAnalysis.supplyZones.slice(0, 5),
    demandZones: deepAnalysis.demandZones.slice(0, 5),
    confluenceLevels: deepAnalysis.confluenceLevels,
    trend: indicators.trend,
    rsi: indicators.rsi,
    macd: indicators.macd,
    bollingerBands: indicators.bollingerBands,
    bias: biasResult ? {
      overall: biasResult.overallBias,
      direction: biasResult.direction,
      confidence: biasResult.confidence,
    } : null,
    fearGreed: fearGreedData?.current ? {
      value: fearGreedData.current.value,
      label: fearGreedData.current.label,
    } : null,
    dxy: bondData?.dxy ? {
      value: bondData.dxy.value,
      change: bondData.dxy.change,
    } : null,
    news: (newsData?.items || []).slice(0, 3).map((n: { headline: string; sentimentLabel: string }) => ({
      headline: n.headline,
      sentiment: n.sentimentLabel,
    })),
    centralBanks: (bankData?.banks || []).slice(0, 3).map((b: { bank: string; currentRate: number; policyStance: string }) => ({
      bank: b.bank,
      rate: b.currentRate,
      stance: b.policyStance,
    })),
  } : null;

  const { data, error, isLoading } = useSWR<{ analysis: DeepAnalysisLLMResult | null }>(
    requestBody ? ["deep-analysis-llm", instrument.id] : null,
    async () => {
      const res = await fetch("/api/analysis/deep-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
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

  return {
    tradeIdeas: data?.analysis || null,
    isLoading,
    error,
    generate,
    isRequested: shouldFetch,
  };
}
