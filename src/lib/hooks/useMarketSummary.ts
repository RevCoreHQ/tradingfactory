"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import { useFearGreed, useBondYields, useCentralBanks } from "./useMarketData";
import { useMarketStore } from "@/lib/store/market-store";
import { REFRESH_INTERVALS, INSTRUMENTS } from "@/lib/utils/constants";
import type { MarketSummaryResult } from "@/lib/types/llm";

const CACHE_KEY = "tf_market_summary";
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

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

const postFetcher = async ([url, body]: [string, unknown]) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
};

// Fetch general news (no instrument filter)
function useGeneralNews() {
  const fetcher = (url: string) => fetch(url).then((r) => r.json());
  return useSWR<{ items: { headline: string; sentimentLabel: string; sentimentScore: number }[] }>(
    "/api/fundamentals/news",
    fetcher,
    { refreshInterval: REFRESH_INTERVALS.NEWS, revalidateOnFocus: false }
  );
}

export function useMarketSummary() {
  const { data: fearGreedData } = useFearGreed();
  const { data: bondData } = useBondYields();
  const { data: bankData } = useCentralBanks();
  const { data: newsData } = useGeneralNews();
  const allBiasResults = useMarketStore((s) => s.allBiasResults);
  const biasTimeframe = useMarketStore((s) => s.biasTimeframe);
  const currentResults = allBiasResults[biasTimeframe];

  const cachedRef = useRef<MarketSummaryResult | null>(null);

  // Load from localStorage on first render
  if (cachedRef.current === null) {
    cachedRef.current = getCachedSummary() ?? undefined as unknown as null;
  }

  const instrumentBiases = Object.entries(currentResults).map(([id, result]) => {
    const inst = INSTRUMENTS.find((i) => i.id === id);
    return {
      symbol: inst?.symbol || id,
      category: inst?.category || "unknown",
      direction: result.direction,
      bias: Math.round(result.overallBias),
    };
  });

  // Build request body if any data is available and no valid cache
  const hasCached = !!getCachedSummary();
  const hasAnyData = !!(fearGreedData || bondData || newsData);

  const requestBody = hasAnyData && !hasCached
    ? {
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
      }
    : null;

  const { data, error, isLoading } = useSWR<{ summary: MarketSummaryResult | null }>(
    requestBody ? ["/api/analysis/market-summary", requestBody] : null,
    postFetcher,
    {
      refreshInterval: CACHE_TTL_MS,
      revalidateOnFocus: false,
      dedupingInterval: 60_000, // retry after 1 min if failed (not 4 hours)
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
  const summary = freshSummary || cached || cachedRef.current;

  return {
    summary,
    isLoading: !summary && isLoading,
    error,
  };
}
