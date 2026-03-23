"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { useFearGreed, useBondYields, useCentralBanks } from "./useMarketData";
import { useMarketStore } from "@/lib/store/market-store";
import { INSTRUMENTS } from "@/lib/utils/constants";
import type { BiasResult } from "@/lib/types/bias";
import type { MarketSummaryResult, SectorOutlook } from "@/lib/types/llm";

/** Signal boot readiness once when market summary is available */
function useMarketSummaryBootSignal(summary: MarketSummaryResult | null | undefined) {
  const fired = useRef(false);
  const setBootReady = useMarketStore((s) => s.setBootReady);
  useEffect(() => {
    if (summary && !fired.current) {
      fired.current = true;
      setBootReady("marketSummary");
    }
  }, [summary, setBootReady]);
}

const STRONG_CONVICTION_THRESHOLD = 45;

/**
 * Correct the LLM's sector outlook badges using actual bias results.
 * Strong conviction instruments (|bias| >= 45) dominate: if any exist
 * in a sector, the outlook is driven by those instruments alone.
 * Otherwise falls back to the average of all instruments in the sector.
 */
function correctSectorOutlooks(
  llmSectors: SectorOutlook[],
  results: Record<string, BiasResult>
): SectorOutlook[] {
  const sectorBiases: Record<string, number[]> = {};
  const sectorStrongBiases: Record<string, number[]> = {};

  for (const [id, result] of Object.entries(results)) {
    const inst = INSTRUMENTS.find((i) => i.id === id);
    if (!inst) continue;
    const key =
      inst.category === "index" ? "indices" : inst.category === "commodity" ? "commodities" : inst.category;
    (sectorBiases[key] ??= []).push(result.overallBias);
    if (Math.abs(result.overallBias) >= STRONG_CONVICTION_THRESHOLD) {
      (sectorStrongBiases[key] ??= []).push(result.overallBias);
    }
  }

  return llmSectors.map((sector) => {
    // If ANY strong conviction instruments exist in this sector,
    // derive outlook from those alone — don't let neutral peers dilute it
    const strong = sectorStrongBiases[sector.sector];
    if (strong && strong.length > 0) {
      const strongAvg = strong.reduce((a, b) => a + b, 0) / strong.length;
      const correctedOutlook: "bullish" | "bearish" | "neutral" =
        strongAvg > 0 ? "bullish" : strongAvg < 0 ? "bearish" : "neutral";
      return { ...sector, outlook: correctedOutlook };
    }
    // No strong conviction — use sector-wide average
    const biases = sectorBiases[sector.sector];
    if (!biases || biases.length === 0) return sector;
    const avg = biases.reduce((a, b) => a + b, 0) / biases.length;
    const correctedOutlook: "bullish" | "bearish" | "neutral" =
      avg > 10 ? "bullish" : avg < -10 ? "bearish" : "neutral";
    return { ...sector, outlook: correctedOutlook };
  });
}

/**
 * Ensure Focus Today includes ALL strong conviction instruments from the
 * bias engine, regardless of what the LLM chose. Also remove any strong
 * conviction instruments from Sit Out (contradicts the mechanical brain).
 */
function enforceFocusToday(
  llmFocus: string[],
  llmSitOut: string[],
  results: Record<string, BiasResult>
): { focusToday: string[]; sitOutToday: string[] } {
  const strongInstruments: { symbol: string; id: string }[] = [];
  for (const [id, result] of Object.entries(results)) {
    if (Math.abs(result.overallBias) >= STRONG_CONVICTION_THRESHOLD) {
      const inst = INSTRUMENTS.find((i) => i.id === id);
      if (inst) strongInstruments.push({ symbol: inst.symbol, id });
    }
  }

  // Helper: check if a symbol is already in a list (fuzzy match on symbol format)
  const symbolInList = (sym: string, list: string[]) =>
    list.some((item) => item === sym || item.includes(sym) || sym.includes(item) || item.replace("/", "") === sym.replace("/", ""));

  // Inject missing strong conviction instruments into Focus Today
  const focusToday = [...llmFocus];
  for (const sc of strongInstruments) {
    if (!symbolInList(sc.symbol, focusToday)) {
      focusToday.push(sc.symbol);
    }
  }

  // Remove strong conviction instruments from Sit Out (they should be focused, not avoided)
  const sitOutToday = llmSitOut.filter(
    (item) => !strongInstruments.some((sc) => symbolInList(sc.symbol, [item]))
  );

  return { focusToday, sitOutToday };
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

  // Fire when critical data (fear-greed) has arrived along with any other source,
  // OR after 6s timeout (whichever first). Previously fired on ANY data arrival,
  // which caused the LLM to receive the default fearGreed=50 when bonds loaded first.
  const hasCriticalData = !!fearGreedData;
  const hasAnyData = hasCriticalData && !!(bondData || newsData || bankData);
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

  // Build request body — use actual data when available, mark as unavailable otherwise
  const requestBody = {
    fearGreed: {
      value: fearGreedData?.current?.value ?? null,
      label: fearGreedData?.current?.label ?? "Unavailable",
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

  // ── Single Brain Corrections ──
  // Override LLM outputs with mechanical bias truth so every section of
  // the dashboard agrees with the one centralized bias engine.
  const hasBiasData = Object.keys(currentResults).length > 0;
  let summary = baseSummary;
  if (baseSummary && hasBiasData) {
    const corrected: Partial<MarketSummaryResult> = {};

    // 1. Sector outlooks: strong conviction instruments dominate their sector
    if (baseSummary.sectorOutlook?.length) {
      corrected.sectorOutlook = correctSectorOutlooks(baseSummary.sectorOutlook, currentResults);
    }

    // 2. Focus Today / Sit Out: inject missing strong conviction, remove contradictions
    const { focusToday, sitOutToday } = enforceFocusToday(
      baseSummary.focusToday || [],
      baseSummary.sitOutToday || [],
      currentResults
    );
    corrected.focusToday = focusToday;
    corrected.sitOutToday = sitOutToday;

    summary = { ...baseSummary, ...corrected };
  }

  // Surface API-level error (returned as { summary: null, error: "..." })
  const apiError = data && !data.summary
    ? (data as Record<string, unknown>).error as string | undefined
    : undefined;

  const refresh = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    cachedRef.current = null;
    setManualRefresh((c) => c + 1);
  }, []);

  // Signal boot when summary is available (cached or fresh)
  useMarketSummaryBootSignal(summary);

  return {
    summary,
    isLoading: !summary && isLoading,
    isRefreshing: !!summary && isLoading,
    error,
    apiError,
    refresh,
  };
}
