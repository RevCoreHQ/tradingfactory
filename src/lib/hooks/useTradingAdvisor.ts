"use client";

import useSWR from "swr";
import type { TradeDeskSetup } from "@/lib/types/signals";
import type { TradingAdvisorRequest, TradingAdvisorResult } from "@/lib/types/llm";

const CACHE_KEY = "tradingfactory_advisor_cache";
const CACHE_TTL = 15 * 60 * 1000; // 15 min client-side

interface CachedAdvisor {
  data: TradingAdvisorResult;
  expiry: number;
  hash: string;
}

function getClientCache(hash: string): TradingAdvisorResult | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return null;
    const cached: CachedAdvisor = JSON.parse(stored);
    if (cached.hash === hash && Date.now() < cached.expiry) {
      return cached.data;
    }
  } catch {}
  return null;
}

function setClientCache(data: TradingAdvisorResult, hash: string): void {
  if (typeof window === "undefined") return;
  try {
    const cached: CachedAdvisor = { data, expiry: Date.now() + CACHE_TTL, hash };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {}
}

function buildSetupHash(
  setups: TradeDeskSetup[],
  trackedStatuses?: Record<string, string>
): string {
  const setupPart = setups
    .slice(0, 6)
    .map((s) => {
      const status = trackedStatuses?.[s.instrumentId] ?? "new";
      return `${s.instrumentId}:${s.conviction}:${s.direction}:${s.impulse}:${status}`;
    })
    .join("|");
  return setupPart;
}

async function fetchAdvisor(
  _key: string,
  { arg }: { arg: TradingAdvisorRequest }
): Promise<TradingAdvisorResult | null> {
  const res = await fetch("/api/analysis/trade-advisor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(arg),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.advisor ?? null;
}

interface UseTradingAdvisorParams {
  setups: TradeDeskSetup[];
  fearGreed: { value: number; label: string };
  dxy: { value: number; change: number };
  bondYields: { maturity: string; yield: number; change: number }[];
  accountEquity: number;
  riskPercent: number;
  trackedStatuses?: Record<string, string>; // instrumentId -> status label
}

export function useTradingAdvisor(params: UseTradingAdvisorParams | null) {
  const hash = params && params.setups.length > 0 ? buildSetupHash(params.setups, params.trackedStatuses) : null;

  const { data, error, isLoading, mutate } = useSWR(
    hash ? `trade-advisor:${hash}` : null,
    async () => {
      if (!params || params.setups.length === 0) return null;

      // Check client cache first
      const cached = getClientCache(hash!);
      if (cached) return cached;

      // Build request from setups
      const topSetups = params.setups.slice(0, 6);

      // Regime summary
      const regimeCounts: Record<string, number> = {};
      const impulseCounts: Record<string, number> = {};
      for (const s of params.setups) {
        regimeCounts[s.regime] = (regimeCounts[s.regime] || 0) + 1;
        impulseCounts[s.impulse] = (impulseCounts[s.impulse] || 0) + 1;
      }
      const regimeSummary = Object.entries(regimeCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([r, c]) => `${c} ${r}`)
        .join(", ");

      const totalBull = params.setups.reduce((s, x) => s + x.consensus.bullish, 0);
      const totalBear = params.setups.reduce((s, x) => s + x.consensus.bearish, 0);
      const totalNeut = params.setups.reduce((s, x) => s + x.consensus.neutral, 0);
      const consensusSummary = `${totalBull} bullish / ${totalBear} bearish / ${totalNeut} neutral across ${params.setups.length} instruments`;

      const impulseSummary = `GREEN: ${impulseCounts["green"] || 0}, RED: ${impulseCounts["red"] || 0}, BLUE: ${impulseCounts["blue"] || 0}`;

      const trackedStatuses = params.trackedStatuses ?? {};
      const request: TradingAdvisorRequest = {
        setups: topSetups.map((s) => ({
          instrument: s.instrumentId,
          symbol: s.symbol,
          category: s.category,
          direction: s.direction,
          conviction: s.conviction,
          convictionScore: s.convictionScore,
          regime: s.regimeLabel,
          adx: s.adx,
          impulse: s.impulse,
          signalsSummary: `${s.consensus.bullish} bullish, ${s.consensus.bearish} bearish, ${s.consensus.neutral} neutral`,
          systemsAgreeing: s.signals
            .filter((sig) => sig.direction === s.direction)
            .map((sig) => sig.system),
          entry: `${s.entry[0].toFixed(4)} – ${s.entry[1].toFixed(4)}`,
          stopLoss: s.stopLoss.toFixed(4),
          takeProfit: `TP1: ${s.takeProfit[0].toFixed(4)}, TP2: ${s.takeProfit[1].toFixed(4)}, TP3: ${s.takeProfit[2].toFixed(4)}`,
          riskReward: `1:${s.riskReward[0]} / 1:${s.riskReward[1]} / 1:${s.riskReward[2]}`,
          positionSize: `${s.positionSizeLots} lots ($${s.riskAmount} risk)`,
          currentPrice: s.currentPrice,
          trackedStatus: trackedStatuses[s.instrumentId],
        })),
        regimeSummary,
        consensusSummary,
        impulseSummary,
        fearGreed: params.fearGreed,
        dxy: params.dxy,
        bondYields: params.bondYields,
        accountEquity: params.accountEquity,
        riskPercent: params.riskPercent,
      };

      const result = await fetchAdvisor("", { arg: request });
      if (result) {
        setClientCache(result, hash!);
      }
      return result;
    },
    {
      revalidateOnFocus: false,
      refreshInterval: 0, // Manual refresh only
      dedupingInterval: 60_000,
    }
  );

  return {
    advisor: data ?? null,
    isLoading,
    error,
    refresh: () => {
      if (typeof window !== "undefined") {
        localStorage.removeItem(CACHE_KEY);
      }
      mutate();
    },
  };
}
