"use client";

import useSWR from "swr";
import type { TradeDeskSetup } from "@/lib/types/signals";
import type { TradingAdvisorRequest, TradingAdvisorResult } from "@/lib/types/llm";
import { INSTRUMENTS } from "@/lib/utils/constants";

const CACHE_KEY = "tradingfactory_advisor_cache";
const CACHE_TTL = 2 * 60 * 1000; // 2 min client-side — keep desk manager near-real-time

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
  const statuses = trackedStatuses ?? {};
  const setupPart = setups
    .map((s) => {
      const status = statuses[s.instrumentId] ?? "new";
      return `${s.instrumentId}:${s.conviction}:${s.direction}:${s.impulse}:${status}`;
    })
    .join("|");

  // Include status distribution so ANY transition busts the cache
  const statusValues = Object.values(statuses);
  const entryZone = statusValues.filter((s) => s.includes("Entry")).length;
  const pending = statusValues.filter((s) => s.includes("Await")).length;
  const running = statusValues.filter((s) => s.includes("Running")).length;

  return `${setups.length}:${entryZone}ez:${pending}p:${running}r|${setupPart}`;
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

/**
 * Validate and fix the LLM advisor response against actual mechanical setups.
 * LLMs can hallucinate instrument names (e.g. "XAG/USD" instead of "XAU/USD")
 * or levels. Override with mechanical truth.
 */
function validateAdvisorResult(
  result: TradingAdvisorResult,
  setups: TradeDeskSetup[],
  trackedStatuses: Record<string, string>
): TradingAdvisorResult {
  if (!result.topPick || setups.length === 0) return result;

  const validSymbols = new Set(INSTRUMENTS.map((i) => i.symbol));
  const setupSymbols = new Set(setups.map((s) => s.symbol));

  // Check if the top pick instrument exists in our system
  const topInstrument = result.topPick.instrument;
  const matchedSetup = setups.find(
    (s) =>
      s.symbol === topInstrument ||
      s.instrumentId === topInstrument ||
      s.symbol.replace("/", "") === topInstrument.replace("/", "") ||
      topInstrument.includes(s.symbol) ||
      s.symbol.includes(topInstrument)
  );

  if (matchedSetup) {
    // Found a match — override levels with mechanical data
    const status = trackedStatuses[matchedSetup.instrumentId];
    const isRunning = status && (status.includes("Running") || status.includes("TP"));

    return {
      ...result,
      topPick: {
        ...result.topPick,
        instrument: matchedSetup.symbol,
        action: matchedSetup.direction === "bullish" ? "LONG" : "SHORT",
        conviction: matchedSetup.conviction,
        levels: `Entry: ${matchedSetup.entry[0].toFixed(4)} – ${matchedSetup.entry[1].toFixed(4)} | SL: ${matchedSetup.stopLoss.toFixed(4)} | TP1: ${matchedSetup.takeProfit[0].toFixed(4)}, TP2: ${matchedSetup.takeProfit[1].toFixed(4)}, TP3: ${matchedSetup.takeProfit[2].toFixed(4)} | R:R 1:${matchedSetup.riskReward[0]}`,
        // Keep the LLM's reasoning — that's the value-add
      },
    };
  }

  // No match — LLM hallucinated an instrument. Use the #1 ranked actionable setup.
  const actionableSetup = setups.find((s) => {
    const status = trackedStatuses[s.instrumentId];
    return !status || status.includes("Await") || status.includes("Entry");
  }) || setups[0];

  return {
    ...result,
    topPick: {
      instrument: actionableSetup.symbol,
      action: actionableSetup.direction === "bullish" ? "LONG" : "SHORT",
      conviction: actionableSetup.conviction,
      reasoning: result.topPick.reasoning || `Highest conviction ${actionableSetup.conviction} setup with ${actionableSetup.consensus.bullish + actionableSetup.consensus.bearish} systems aligned.`,
      levels: `Entry: ${actionableSetup.entry[0].toFixed(4)} – ${actionableSetup.entry[1].toFixed(4)} | SL: ${actionableSetup.stopLoss.toFixed(4)} | TP1: ${actionableSetup.takeProfit[0].toFixed(4)}, TP2: ${actionableSetup.takeProfit[1].toFixed(4)}, TP3: ${actionableSetup.takeProfit[2].toFixed(4)} | R:R 1:${actionableSetup.riskReward[0]}`,
    },
  };
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

      // Check client cache first — still validate against current setups
      const cached = getClientCache(hash!);
      if (cached) return validateAdvisorResult(cached, params.setups, params.trackedStatuses ?? {});

      // Build request from setups
      const topSetups = params.setups; // Send all A+/A setups (max 13 instruments)

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

      const raw = await fetchAdvisor("", { arg: request });
      if (!raw) return null;

      // Validate LLM output against mechanical setups — fix hallucinated instruments/levels
      const result = validateAdvisorResult(raw, params.setups, trackedStatuses);
      setClientCache(result, hash!);
      return result;
    },
    {
      revalidateOnFocus: false,
      refreshInterval: 0,
      dedupingInterval: 30_000, // Allow re-fetch after 30s if hash changed
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
