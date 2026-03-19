"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { useFearGreed, useBondYields, useCentralBanks } from "./useMarketData";
import { useMarketStore } from "@/lib/store/market-store";
import { INSTRUMENTS } from "@/lib/utils/constants";
import type { BiasResult } from "@/lib/types/bias";
import type { MarketSummaryResult, SectorOutlook } from "@/lib/types/llm";

/**
 * Correct the LLM's sector outlook badges using actual bias results,
 * but keep the LLM's rich keyAssets descriptions intact.
 */
function correctSectorOutlooks(
  llmSectors: SectorOutlook[],
  results: Record<string, BiasResult>
): SectorOutlook[] {
  // Compute average bias per sector from actual scores
  const sectorBiases: Record<string, number[]> = {};
  for (const [id, result] of Object.entries(results)) {
    const inst = INSTRUMENTS.find((i) => i.id === id);
    if (!inst) continue;
    const key =
      inst.category === "index" ? "indices" : inst.category === "commodity" ? "commodities" : inst.category;
    (sectorBiases[key] ??= []).push(result.overallBias);
  }

  return llmSectors.map((sector) => {
    const biases = sectorBiases[sector.sector];
    if (!biases || biases.length === 0) return sector;
    const avg = biases.reduce((a, b) => a + b, 0) / biases.length;
    const correctedOutlook: "bullish" | "bearish" | "neutral" =
      avg > 10 ? "bullish" : avg < -10 ? "bearish" : "neutral";
    return { ...sector, outlook: correctedOutlook };
  });
}

const CACHE_KEY = "tf_market_summary";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCachedSummary(): MarketSummaryResult | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, expiry } = JSON.parse(raw);
    if (Date.now() > expiry) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data as MarketSummaryResult;
  } catch {
    return null;
  }
}

function setCachedSummary(summary: MarketSummaryResult) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data: summary, expiry: Date.now() + CACHE_TTL_MS })
    );
  } catch {
    // localStorage full or unavailable — ignore
  }
}

// Fetch general news (no instrument filter)
function useGeneralNews() {
  const fetcher = (url: string) => fetch(url).then((r) => r.json());
  return useSWR<{ items: { headline: string; sentimentLabel: string; sentimentScore: number }[] }>(
    "/api/fundamentals/news",
    fetcher,
    { revalidateOnFocus: false }
  );
}

export function useMarketSummary() {
  const { data: fearGreedData } = useFearGreed();
  const { data: bondData } = useBondYields();
  const { data: bankData } = useCentralBanks();
  const { data: newsData } = useGeneralNews();
  const allBiasResults = useMarketStore((s) => s.allBiasResults);
  const currentResults = allBiasResults.intraday;

  const cachedRef = useRef<MarketSummaryResult | null>(null);

  // Load from localStorage on first render
  if (cachedRef.current === null) {
    cachedRef.current = getCachedSummary() ?? undefined as unknown as null;
  }

  // Fire when any upstream data arrives, OR after 6s timeout (whichever first)
  const hasAnyData = !!(fearGreedData || bondData || newsData || bankData);
  const [timerReady, setTimerReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setTimerReady(true), 6000);
    return () => clearTimeout(timer);
  }, []);

  const instrumentBiases = Object.entries(currentResults).map(([id, result]) => {
    const inst = INSTRUMENTS.find((i) => i.id === id);
    return {
      symbol: inst?.symbol || id,
      category: inst?.category || "unknown",
      direction: result.direction,
      bias: Math.round(result.overallBias),
    };
  });

  // Always build request body with defaults for missing data
  const requestBody = {
    fearGreed: {
      value: fearGreedData?.current?.value ?? 50,
      label: fearGreedData?.current?.label ?? "Neutral",
    },
    dxy: {
      value: bondData?.dxy?.value ?? 0,
      change: bondData?.dxy?.change ?? 0,
    },
    bondYields: (bondData?.yields || []).map((y: { maturity: string; yield: number; change: number }) => ({
      maturity: y.maturity,
      yield: y.yield,
      change: y.change,
    })),
    centralBanks: (bankData?.banks || []).map((b: { bank: string; currentRate: number; rateDirection: string; policyStance: string }) => ({
      bank: b.bank,
      rate: b.currentRate,
      direction: b.rateDirection,
      stance: b.policyStance,
    })),
    newsHeadlines: (newsData?.items || []).slice(0, 10).map((n) => ({
      headline: n.headline,
      sentiment: n.sentimentLabel,
      score: n.sentimentScore,
    })),
    instrumentBiases: instrumentBiases.length > 0 ? instrumentBiases : undefined,
  };

  // Stable ref so SWR fetcher always uses latest data
  const bodyRef = useRef(requestBody);
  bodyRef.current = requestBody;

  const [manualRefresh, setManualRefresh] = useState(0);

  const hasCached = manualRefresh === 0 && !!getCachedSummary();
  const shouldFetch = (hasAnyData || timerReady) && !hasCached;

  const { data, error, isLoading } = useSWR<{ summary: MarketSummaryResult | null }>(
    shouldFetch ? `market-summary-${manualRefresh}` : null,
    async () => {
      const body = bodyRef.current;
      const res = await fetch("/api/analysis/market-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.json();
    },
    {
      refreshInterval: CACHE_TTL_MS,
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
      shouldRetryOnError: true,
      errorRetryCount: 2,
    }
  );

  // Persist new results to localStorage
  const freshSummary = data?.summary || null;
  useEffect(() => {
    if (freshSummary) {
      setCachedSummary(freshSummary);
      cachedRef.current = freshSummary;
    }
  }, [freshSummary]);

  // Return cached summary immediately, or fresh data when available
  const cached = getCachedSummary();
  const baseSummary = freshSummary || cached || cachedRef.current;

  // Correct the LLM's sector outlook badges using actual bias scores
  // so the badges always agree with Top Opportunities, while keeping the LLM's descriptions
  const hasBiasData = Object.keys(currentResults).length > 0;
  const summary = baseSummary && hasBiasData && baseSummary.sectorOutlook?.length
    ? { ...baseSummary, sectorOutlook: correctSectorOutlooks(baseSummary.sectorOutlook, currentResults) }
    : baseSummary;

  // Surface API-level error (returned as { summary: null, error: "..." })
  const apiError = data && !data.summary
    ? (data as Record<string, unknown>).error as string | undefined
    : undefined;

  const refresh = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    cachedRef.current = null;
    setManualRefresh((c) => c + 1);
  }, []);

  return {
    summary,
    isLoading: !summary && isLoading,
    isRefreshing: !!summary && isLoading,
    error,
    apiError,
    refresh,
  };
}
