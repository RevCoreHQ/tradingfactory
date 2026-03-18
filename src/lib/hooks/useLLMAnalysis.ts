"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import { useMarketStore } from "@/lib/store/market-store";
import { useMarketNews, useFearGreed, useBondYields, useCentralBanks } from "./useMarketData";
import { useTechnicalData } from "./useTechnicalData";
import { REFRESH_INTERVALS, INSTRUMENTS } from "@/lib/utils/constants";
import type { LLMAnalysisResult, LLMAnalysisRequest } from "@/lib/types/llm";
import type { BiasResult } from "@/lib/types/bias";

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
// Fetchers
// ---------------------------------------------------------------------------

const postFetcher = async ([url, body]: [string, unknown]) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
};

// Delayed fetcher — avoids simultaneous Anthropic calls that hit rate limits
const delayedPostFetcher = async ([url, body]: [string, unknown]) => {
  await new Promise((r) => setTimeout(r, 15_000)); // wait 15s for market summary to finish
  return postFetcher([url, body]);
};

// ---------------------------------------------------------------------------
// Request builder
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
  const storedBias = useMarketStore((s) => s.biasResults[instrument.id]);

  const { data: newsData } = useMarketNews();
  const { data: fearGreedData } = useFearGreed();
  const { data: bondData } = useBondYields();
  const { data: bankData } = useCentralBanks();
  const { indicators, candles } = useTechnicalData();

  const hasData = !!fearGreedData;

  const requestBody = hasData ? buildLLMRequest(
    instrument.id, instrument.category,
    newsData, fearGreedData, bondData, bankData,
    indicators, candles, storedBias,
  ) : null;

  const { data, error, isLoading } = useSWR<{ analysis: LLMAnalysisResult | null }>(
    requestBody ? ["/api/analysis/llm", requestBody] : null,
    postFetcher,
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

  const hasData = !!fearGreedData;

  // Skip API call if we have a valid cached batch
  const hasCached = typeof window !== "undefined" ? !!getCachedBatch() : false;

  // Build request body (changes as data updates)
  const requestBody = hasData ? {
    instruments: INSTRUMENTS.map(inst => buildLLMRequest(
      inst.id, inst.category,
      newsData, fearGreedData, bondData, bankData,
      null, [],
      allBiasResults[inst.id],
    )),
  } : null;

  // Keep latest body in a ref so the fetcher always uses current data
  // without changing the SWR key (which would reset data/loading state)
  const bodyRef = useRef(requestBody);
  bodyRef.current = requestBody;

  // Track whether batch has been attempted (success or failure)
  const attemptedRef = useRef(false);

  // Stable SWR key — only null when cache exists or data not ready
  const shouldFetch = hasData && !hasCached;

  const { data, error, isLoading } = useSWR<{ batch: { results: Record<string, LLMAnalysisResult> } | null }>(
    shouldFetch ? "llm-batch" : null,
    async () => {
      // Wait 15s to avoid colliding with market summary on Anthropic rate limit
      await new Promise((r) => setTimeout(r, 15_000));
      const body = bodyRef.current;
      if (!body) return { batch: null };
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
      dedupingInterval: BATCH_CACHE_TTL_MS,
    }
  );

  // Persist fresh results to localStorage
  const freshResults = data?.batch?.results || null;
  useEffect(() => {
    if (freshResults && Object.keys(freshResults).length > 0) {
      setCachedBatch(freshResults);
    }
  }, [freshResults]);

  // Return cached or fresh
  const cached = typeof window !== "undefined" ? getCachedBatch() : null;
  const batchResults = freshResults || cached;

  return {
    batchResults,
    isLoading: !batchResults && isLoading,
    isReady: !!batchResults || attemptedRef.current || (!!data && !isLoading) || !!error,
    error,
  };
}
