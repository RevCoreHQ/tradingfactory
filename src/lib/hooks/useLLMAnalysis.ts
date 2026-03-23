"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { useMarketStore } from "@/lib/store/market-store";
import { useMarketNews, useFearGreed, useBondYields, useCentralBanks } from "./useMarketData";
import { useTechnicalData } from "./useTechnicalData";
import { REFRESH_INTERVALS, INSTRUMENTS } from "@/lib/utils/constants";
import type { LLMAnalysisResult, LLMAnalysisRequest, LLMBatchResult } from "@/lib/types/llm";
import type { BiasResult } from "@/lib/types/bias";
import { readCache } from "@/lib/supabase-cache";

// ---------------------------------------------------------------------------
// localStorage cache for batch results (4 hours)
// ---------------------------------------------------------------------------
const BATCH_CACHE_KEY = "tf_llm_batch";
const BATCH_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function getCachedBatch(): Record<string, LLMAnalysisResult> | null {
  try {
    const raw = localStorage.getItem(BATCH_CACHE_KEY);
    if (!raw) return null;
    const { data, expiry } = JSON.parse(raw);
    if (Date.now() > expiry) {
      localStorage.removeItem(BATCH_CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCachedBatch(results: Record<string, LLMAnalysisResult>) {
  try {
    localStorage.setItem(
      BATCH_CACHE_KEY,
      JSON.stringify({ data: results, expiry: Date.now() + BATCH_CACHE_TTL_MS })
    );
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Request builder — handles missing data with sensible defaults
// ---------------------------------------------------------------------------

function buildLLMRequest(
  instrumentId: string,
  category: string,
  newsData: { items?: { headline: string; sentimentLabel: string; sentimentScore: number }[] } | undefined,
  fearGreedData: { current?: { value: number; label: string } } | undefined,
  bondData: { yields?: { maturity: string; yield: number; change: number }[]; dxy?: { value: number; change: number } } | undefined,
  bankData: { banks?: { bank: string; currentRate: number; rateDirection: string; policyStance: string }[] } | undefined,
  indicators: { rsi: { value: number; signal: string }; macd: { histogram: number; crossover: string | null }; trend: { direction: string; strength: number }; bollingerBands: { percentB: number } } | null,
  candles: { close: number }[],
  ruleBasedBias: BiasResult | undefined,
): LLMAnalysisRequest {
  const news = newsData?.items || [];
  const fearGreed = fearGreedData?.current || { value: 50, label: "Neutral" };
  const yields = bondData?.yields || [];
  const dxy = bondData?.dxy || { value: 0, change: 0 };
  const banks = bankData?.banks || [];

  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
  const priceChange24h = candles.length > 1
    ? ((candles[candles.length - 1].close - candles[0].close) / candles[0].close) * 100
    : 0;

  return {
    instrument: instrumentId,
    category,
    currentPrice,
    priceChange24h,
    fearGreed: { value: fearGreed.value, label: fearGreed.label },
    dxy: { value: dxy.value, change: dxy.change },
    bondYields: yields.map((y) => ({ maturity: y.maturity, yield: y.yield, change: y.change })),
    centralBanks: banks.map((b) => ({
      bank: b.bank, rate: b.currentRate, direction: b.rateDirection, stance: b.policyStance,
    })),
    newsHeadlines: news.slice(0, 5).map((n) => ({
      headline: n.headline, sentiment: n.sentimentLabel, score: n.sentimentScore,
    })),
    technicals: indicators ? {
      rsi: indicators.rsi.value,
      rsiSignal: indicators.rsi.signal,
      macdHistogram: indicators.macd.histogram,
      macdCrossover: indicators.macd.crossover,
      trend: indicators.trend.direction,
      trendStrength: indicators.trend.strength,
      bbPercentB: indicators.bollingerBands.percentB,
    } : null,
    ruleBasedScores: ruleBasedBias ? {
      fundamentalTotal: ruleBasedBias.fundamentalScore.total,
      technicalTotal: ruleBasedBias.technicalScore.total,
      overallBias: ruleBasedBias.overallBias,
      direction: ruleBasedBias.direction,
    } : { fundamentalTotal: 50, technicalTotal: 50, overallBias: 0, direction: "neutral" },
  };
}

// ---------------------------------------------------------------------------
// Single instrument LLM analysis (instrument detail page)
// ---------------------------------------------------------------------------

export function useLLMAnalysis() {
  const instrument = useMarketStore((s) => s.selectedInstrument);

  const { data: newsData } = useMarketNews();
  const { data: fearGreedData } = useFearGreed();
  const { data: bondData } = useBondYields();
  const { data: bankData } = useCentralBanks();
  const { indicators, candles } = useTechnicalData();

  // Fire when any data arrives, or after 6s timeout
  const hasAnyData = !!(fearGreedData || bondData || newsData || bankData);
  const [timerReady, setTimerReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimerReady(true), 6000);
    return () => clearTimeout(timer);
  }, []);
  const ready = hasAnyData || timerReady;

  // Read storedBias non-reactively to avoid re-render loops.
  const bodyRef = useRef<LLMAnalysisRequest | null>(null);
  if (ready) {
    const storedBias = useMarketStore.getState().biasResults[instrument.id];
    bodyRef.current = buildLLMRequest(
      instrument.id, instrument.category,
      newsData, fearGreedData, bondData, bankData,
      indicators, candles, storedBias,
    );
  }

  const { data, error, isLoading } = useSWR<{ analysis: LLMAnalysisResult | null }>(
    ready ? `llm-single-${instrument.id}` : null,
    async () => {
      const body = bodyRef.current;
      if (!body) return { analysis: null };
      const res = await fetch("/api/analysis/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    },
    {
      refreshInterval: REFRESH_INTERVALS.LLM_ANALYSIS,
      revalidateOnFocus: false,
      dedupingInterval: REFRESH_INTERVALS.LLM_ANALYSIS,
    }
  );

  return {
    llmAnalysis: data?.analysis || null,
    isLoading,
    error,
  };
}

// ---------------------------------------------------------------------------
// Batch LLM analysis (homepage) — cached in localStorage for 4 hours
// ---------------------------------------------------------------------------

export function useLLMBatchAnalysis(allBiasResults: Record<string, BiasResult>) {
  const { data: newsData } = useMarketNews();
  const { data: fearGreedData } = useFearGreed();
  const { data: bondData } = useBondYields();
  const { data: bankData } = useCentralBanks();

  // Fire when any upstream data arrives, or after 6s timeout
  const hasAnyData = !!(fearGreedData || bondData || newsData || bankData);
  const [timerReady, setTimerReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimerReady(true), 6000);
    return () => clearTimeout(timer);
  }, []);
  const ready = hasAnyData || timerReady;

  // Supabase cache (async — fills in after ~200ms if localStorage is empty)
  const [supabaseBatch, setSupabaseBatch] = useState<Record<string, LLMAnalysisResult> | null>(null);
  const supabaseFetched = useRef(false);
  useEffect(() => {
    if (supabaseFetched.current) return;
    supabaseFetched.current = true;
    readCache<LLMBatchResult>("llm_batch").then((cached) => {
      if (cached?.results) {
        setSupabaseBatch(cached.results);
        // Backfill localStorage if empty
        if (!getCachedBatch()) setCachedBatch(cached.results);
      }
    });
  }, []);

  // Skip API call if we have a valid cached batch (localStorage or Supabase)
  const hasCached = (typeof window !== "undefined" ? !!getCachedBatch() : false) || !!supabaseBatch;

  // Always build request body — uses defaults for any missing data
  const requestBody = {
    instruments: INSTRUMENTS.map(inst => buildLLMRequest(
      inst.id, inst.category,
      newsData, fearGreedData, bondData, bankData,
      null, [],
      allBiasResults[inst.id],
    )),
  };

  // Stable ref so SWR fetcher always uses latest data
  const bodyRef = useRef(requestBody);
  bodyRef.current = requestBody;

  // Track whether batch has been attempted (success or failure)
  const attemptedRef = useRef(false);

  const shouldFetch = ready && !hasCached;

  const { data, error, isLoading } = useSWR<{ batch: { results: Record<string, LLMAnalysisResult> } | null }>(
    shouldFetch ? "llm-batch" : null,
    async () => {
      // Short delay to let market summary start first
      await new Promise((r) => setTimeout(r, 3_000));
      const body = bodyRef.current;
      const res = await fetch("/api/analysis/llm-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      attemptedRef.current = true;
      return res.json();
    },
    {
      refreshInterval: BATCH_CACHE_TTL_MS,
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
      shouldRetryOnError: true,
      errorRetryCount: 2,
    }
  );

  // Persist fresh results to localStorage
  const freshResults = data?.batch?.results || null;
  useEffect(() => {
    if (freshResults && Object.keys(freshResults).length > 0) {
      setCachedBatch(freshResults);
    }
  }, [freshResults]);

  // Return fresh → localStorage → Supabase
  const cached = typeof window !== "undefined" ? getCachedBatch() : null;
  const batchResults = freshResults || cached || supabaseBatch;

  // Surface API-level error (returned as { batch: null, error: "..." })
  const apiError = data && !data.batch
    ? (data as Record<string, unknown>).error as string | undefined
    : undefined;

  return {
    batchResults,
    isLoading: !batchResults && isLoading,
    isReady: !!batchResults || attemptedRef.current || (!!data && !isLoading) || !!error,
    error,
    apiError,
  };
}
