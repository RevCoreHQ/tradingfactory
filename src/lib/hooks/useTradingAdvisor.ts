"use client";

import { useRef } from "react";
import useSWR from "swr";
import type { BiasResult } from "@/lib/types/bias";
import type { TradeDeskSetup } from "@/lib/types/signals";
import type { TradingAdvisorRequest, TradingAdvisorResult } from "@/lib/types/llm";
import type { COTPosition } from "@/lib/types/cot";
import type { EconomicEvent } from "@/lib/types/market";
import type { PortfolioRiskAssessment } from "@/lib/types/risk";
import { readCache } from "@/lib/supabase-cache";
import { computeRateDifferentials } from "@/lib/calculations/rate-differentials";
import { useMarketStore } from "@/lib/store/market-store";
import { computeTradeFilter } from "@/lib/calculations/trade-filter";
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
  trackedStatuses?: Record<string, string>,
  cotPositions?: COTPosition[],
  eventCount?: number
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

  // Institutional fingerprint — bust cache when positioning or event count changes
  const cotHash = cotPositions?.slice(0, 3).map((c) => `${c.currency}:${c.netSpeculative}`).join(",") ?? "";

  return `${setups.length}:${entryZone}ez:${pending}p:${running}r|${setupPart}|cot:${cotHash}|ev:${eventCount ?? 0}`;
}

/** Bust advisor cache when per-setup desk filter verdict changes (aligns LLM with cards). */
function deskHintsFingerprint(
  setups: TradeDeskSetup[],
  intraday: Record<string, BiasResult>
): string {
  return setups
    .map((s) => {
      const r = intraday[s.instrumentId];
      if (!r) return `${s.instrumentId}:_`;
      return `${s.instrumentId}:${computeTradeFilter(r).verdict}`;
    })
    .join(";");
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
 * Validate the LLM advisor response. LLM no longer picks trades or ranks setups —
 * it only provides risk commentary. Enforce deprecated fields are null/empty.
 */
function validateAdvisorResult(result: TradingAdvisorResult): TradingAdvisorResult {
  return { ...result, topPick: null, otherSetups: [] };
}

interface UseTradingAdvisorParams {
  setups: TradeDeskSetup[];
  fearGreed: { value: number; label: string };
  dxy: { value: number; change: number };
  bondYields: { maturity: string; yield: number; change: number }[];
  riskPercent: number;
  trackedStatuses?: Record<string, string>; // instrumentId -> status label
  // Institutional context
  cotPositions?: COTPosition[];
  highImpactEvents?: EconomicEvent[];
  portfolioRisk?: PortfolioRiskAssessment;
  centralBanks?: { bank: string; currency: string; rate: number; direction: string; stance: string }[];
}

export function useTradingAdvisor(params: UseTradingAdvisorParams | null) {
  const intradayBias = useMarketStore((s) => s.allBiasResults.intraday);
  const highImpactCount = params?.highImpactEvents?.filter((e) => e.impact === "high").length ?? 0;
  const hash = params && params.setups.length > 0
    ? `${buildSetupHash(params.setups, params.trackedStatuses, params.cotPositions, highImpactCount)}|dh:${deskHintsFingerprint(params.setups, intradayBias)}`
    : null;
  const advisorRequestRef = useRef<TradingAdvisorRequest | null>(null);

  const { data, error, isLoading, mutate } = useSWR(
    hash ? `trade-advisor:${hash}` : null,
    async () => {
      if (!params || params.setups.length === 0) return null;

      // Check client cache first — still validate against current setups
      const cached = getClientCache(hash!);
      if (cached) return validateAdvisorResult(cached);

      // Supabase fallback — slower than localStorage but survives across devices/sessions
      const supabaseCached = await readCache<TradingAdvisorResult>("trade_advisor");
      if (supabaseCached) {
        const validated = validateAdvisorResult(supabaseCached);
        setClientCache(validated, hash!);
        return validated;
      }

      // Pre-filter: separate actionable vs managed setups
      const trackedStatuses = params.trackedStatuses ?? {};
      const actionableSetups = params.setups.filter((s) => {
        const status = trackedStatuses[s.instrumentId];
        // "Awaiting Entry", "Entry Zone", or new (no status) are actionable
        return !status || status.includes("Await") || status.includes("Entry");
      });
      const managedSetups = params.setups.filter((s) => {
        const status = trackedStatuses[s.instrumentId];
        return status && (status.includes("Running") || status.includes("TP") || status.includes("Invalidated") || status.includes("SL"));
      });
      // Send actionable setups as primary, managed as context-only
      const topSetups = actionableSetups.length > 0 ? actionableSetups : params.setups;

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
          // Rich data from mechanical pipeline
          mtfAlignment: s.mtfTrend?.alignment,
          mtfDaily: s.mtfTrend?.anchorDirection,
          pullbackComplete: s.mtfTrend?.pullbackComplete,
          volatilityRegime: s.fullRegime?.volatility,
          wyckoffPhase: s.fullRegime?.phase,
          adxTrend: s.fullRegime?.adxTrend,
          structureBias: s.marketStructure?.latestStructure,
          structureScore: s.marketStructure?.structureScore,
          lastBOS: s.marketStructure?.lastBOS
            ? { direction: s.marketStructure.lastBOS.direction, price: s.marketStructure.lastBOS.price }
            : null,
          lastCHoCH: s.marketStructure?.lastCHoCH
            ? { direction: s.marketStructure.lastCHoCH.direction, price: s.marketStructure.lastCHoCH.price }
            : null,
          ictScore: s.ictContext?.ictScore,
          nearestFVG: s.ictContext?.nearestFVG ?? null,
          nearestOB: s.ictContext?.nearestOB
            ? { type: s.ictContext.nearestOB.type, strength: s.ictContext.nearestOB.strength }
            : null,
          displacement: s.ictContext?.displacementDetected,
          obRetest: s.ictContext?.obRetestDetected
            ? { direction: s.ictContext.obRetestDetected.direction, zoneType: s.ictContext.obRetestDetected.zone.type, strength: s.ictContext.obRetestDetected.strength }
            : null,
          bestEntryPattern: s.entryOptimization?.bestSignal?.type,
          entryScore: s.entryOptimization?.entryScore,
          pullbackDepth: s.entryOptimization?.pullbackDepth,
          learningWinRate: s.learningApplied?.winRate,
          learningTrades: s.learningApplied?.trades,
        })),
        managedSetups: managedSetups.map((s) => ({
          symbol: s.symbol,
          direction: s.direction,
          status: trackedStatuses[s.instrumentId] ?? "unknown",
        })),
        regimeSummary,
        consensusSummary,
        impulseSummary,
        fearGreed: params.fearGreed,
        dxy: params.dxy,
        bondYields: params.bondYields,
        riskPercent: params.riskPercent,
        // Institutional context
        cotPositioning: params.cotPositions?.map((p) => ({
          currency: p.currency,
          netSpeculative: p.netSpeculative,
          netSpecChange: p.netSpecChange,
          percentLong: p.percentLong,
          netCommercial: p.netCommercial,
        })),
        highImpactEvents: params.highImpactEvents
          ?.filter((e) => e.impact === "high")
          .slice(0, 8)
          .map((e) => ({
            event: e.event,
            currency: e.currency,
            date: e.date,
            time: e.time,
            forecast: e.forecast,
            previous: e.previous,
          })),
        portfolioRisk: params.portfolioRisk
          ? {
              exposures: params.portfolioRisk.exposures.map((e) => ({
                currency: e.currency,
                netExposure: e.netExposure,
              })),
              warnings: params.portfolioRisk.warnings.map((w) => ({
                type: w.type,
                severity: w.severity,
                message: w.message,
              })),
              diversificationScore: params.portfolioRisk.diversificationScore,
              concentrationRisk: params.portfolioRisk.concentrationRisk,
            }
          : undefined,
        rateDifferentials: params.centralBanks
          ? computeRateDifferentials(params.centralBanks)
          : undefined,
        centralBanks: params.centralBanks,
        instrumentDeskHints: (() => {
          const currentResults = useMarketStore.getState().allBiasResults.intraday;
          if (Object.keys(currentResults).length === 0) return undefined;
          return INSTRUMENTS.map((inst) => {
            const r = currentResults[inst.id];
            if (!r) return null;
            const tf = computeTradeFilter(r);
            return {
              symbol: inst.symbol,
              filter: tf.verdict,
              tier: r.tradeSetup?.confluenceTier,
              riskSizing: r.tradeSetup?.riskSizing,
            };
          }).filter((h): h is NonNullable<typeof h> => h !== null);
        })(),
      };

      advisorRequestRef.current = request;
      const raw = await fetchAdvisor("", { arg: request });
      if (!raw) return null;

      // Validate LLM output against mechanical setups — fix hallucinated instruments/levels
      const result = validateAdvisorResult(raw);
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
    advisorRequest: advisorRequestRef.current,
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
