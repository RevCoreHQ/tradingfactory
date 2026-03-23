"use client";

import useSWR from "swr";
import { useMemo, useRef } from "react";
import type { OHLCV } from "@/lib/types/market";
import type { TradeDeskSetup, TrackedSetup, PortfolioRisk, ConfluencePattern, MarketPhase, TradingStyle } from "@/lib/types/signals";
import { INSTRUMENTS, REFRESH_INTERVALS } from "@/lib/utils/constants";
import { calculateAllIndicators } from "@/lib/calculations/technical-indicators";
import { generateTradeDeskSetup, rankSetupsByConviction, selectTradingStyle, STYLE_TIMEFRAMES } from "@/lib/calculations/mechanical-signals";
import { getSessionRelevance } from "@/lib/calculations/session-scoring";
import { calculateMTFTrendSummary, type CandlesByTimeframe } from "@/lib/calculations/mtf-trend";
import { evaluatePortfolioGate } from "@/lib/calculations/portfolio-risk-gate";
import { getOptimizedOverrides } from "@/lib/storage/backtest-storage";

const RISK_PERCENT_KEY = "tradingfactory_risk_percent";

function getStoredNumber(key: string, defaultValue: number): number {
  if (typeof window === "undefined") return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    if (stored) return Number(stored);
  } catch {}
  return defaultValue;
}

interface InstrumentCandles {
  candles: CandlesByTimeframe;
  style: TradingStyle;
}

const BATCH_SIZE = 2;
const BATCH_DELAY_MS = 3000; // 3s between batches — keeps us under 55 req/min

/** TF string → API interval parameter */
const TF_API_MAP: Record<string, string> = {
  "5m": "5min", "15m": "15min", "1h": "1h", "4h": "4h", "1d": "1d", "1w": "1w",
};

async function fetchTf(instId: string, tf: string): Promise<OHLCV[]> {
  const apiTf = TF_API_MAP[tf] || tf;
  const limit = tf === "1d" || tf === "1w" ? "&limit=250" : "";
  try {
    const res = await fetch(`/api/technicals/price-data?instrument=${instId}&timeframe=${apiTf}${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.candles?.length > 20 ? data.candles : [];
  } catch {
    return [];
  }
}

/**
 * Two-phase candle fetch:
 *   Phase 1: Fetch 1h, 4h, 1d (common) → determine style from 4H ADX + session
 *   Phase 2: Fetch style-specific extras — swing: 1w, intraday: 15m + 5m
 */
async function fetchAllCandles(): Promise<Record<string, InstrumentCandles>> {
  const results: Record<string, InstrumentCandles> = {};

  // Phase 1: common TFs (1h, 4h, 1d) for all instruments
  for (let i = 0; i < INSTRUMENTS.length; i += BATCH_SIZE) {
    const batch = INSTRUMENTS.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (inst) => {
        const [candles1h, candles4h, candles1d] = await Promise.all([
          fetchTf(inst.id, "1h"),
          fetchTf(inst.id, "4h"),
          fetchTf(inst.id, "1d"),
        ]);

        if (candles4h.length > 20) {
          // Determine style from 4H ADX + session
          const summary4h = calculateAllIndicators(candles4h, inst.id, "4h");
          const session = getSessionRelevance(inst.id);
          const style = selectTradingStyle(summary4h.adx.adx, session.sessionScore);

          results[inst.id] = {
            candles: { "1h": candles1h, "4h": candles4h, "1d": candles1d },
            style,
          };
        }
      })
    );
    if (i + BATCH_SIZE < INSTRUMENTS.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  // Phase 2: fetch style-specific extra TFs
  const extraFetches: { instId: string; tf: string }[] = [];
  for (const [instId, data] of Object.entries(results)) {
    if (data.style === "swing") {
      extraFetches.push({ instId, tf: "1w" });
    } else {
      extraFetches.push({ instId, tf: "15m" });
      extraFetches.push({ instId, tf: "5m" });
    }
  }

  for (let i = 0; i < extraFetches.length; i += BATCH_SIZE * 2) {
    const batch = extraFetches.slice(i, i + BATCH_SIZE * 2);
    await Promise.all(
      batch.map(async ({ instId, tf }) => {
        const candles = await fetchTf(instId, tf);
        if (candles.length > 20) {
          results[instId].candles[tf as keyof CandlesByTimeframe] = candles;
        }
      })
    );
    if (i + BATCH_SIZE * 2 < extraFetches.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  return results;
}

export function useTradeDeskData(
  confluencePatterns?: Record<string, ConfluencePattern>,
  activeSetups?: TrackedSetup[],
  historySetups?: TrackedSetup[]
) {
  const riskPercent = getStoredNumber(RISK_PERCENT_KEY, 2);
  const previousPhases = useRef<Record<string, MarketPhase>>({});

  const { data: candleMap, isLoading, error, mutate } = useSWR(
    "trade-desk-candles",
    fetchAllCandles,
    {
      refreshInterval: REFRESH_INTERVALS.INDICATORS,
      revalidateOnFocus: false,
    }
  );

  const { setups, allSetups, portfolioRisk } = useMemo(() => {
    if (!candleMap || Object.keys(candleMap).length === 0) {
      return {
        setups: [] as TradeDeskSetup[],
        allSetups: [] as TradeDeskSetup[],
        portfolioRisk: {
          riskPercent,
          canTrade: true,
          warning: null,
        } as PortfolioRisk,
      };
    }

    const allSetups: TradeDeskSetup[] = [];

    for (const inst of INSTRUMENTS) {
      const multi = candleMap[inst.id];
      if (!multi || !multi.candles["4h"]?.length || multi.candles["4h"].length < 30) continue;

      const candles4h = multi.candles["4h"]!;
      const candles1h = multi.candles["1h"] || [];

      // Always compute 4h summary for regime detection
      const summary4h = calculateAllIndicators(candles4h, inst.id, "4h");

      // Style was already determined during fetch
      const style = multi.style;

      // Pick candles for the selected timeframe (signal generation)
      let candles: OHLCV[];
      let summary;

      if (style === "intraday" && candles1h.length >= 30) {
        candles = candles1h;
        summary = calculateAllIndicators(candles1h, inst.id, "1h");
      } else {
        candles = candles4h;
        summary = summary4h;
      }

      const effectiveStyle: TradingStyle = style === "intraday" && candles1h.length >= 30 ? "intraday" : "swing";

      // Load optimized params from Weekend Lab if available
      const labOverrides = getOptimizedOverrides(inst.id, effectiveStyle) ?? undefined;

      const setup = generateTradeDeskSetup(
        candles,
        summary,
        inst,
        riskPercent,
        confluencePatterns,
        effectiveStyle,
        undefined,
        labOverrides,
        previousPhases.current[inst.id]
      );

      // Store current phase for next iteration (phase transition detection)
      if (setup.fullRegime) {
        previousPhases.current[inst.id] = setup.fullRegime.phase;
      }

      // Calculate MTF trend alignment with style-specific TFs
      const styleConfig = STYLE_TIMEFRAMES[effectiveStyle];
      const mtfTrend = calculateMTFTrendSummary(multi.candles, styleConfig);

      if (mtfTrend) {
        setup.mtfTrend = mtfTrend;
        // Apply MTF conviction modifier
        setup.convictionScore = Math.max(0, Math.min(100, setup.convictionScore + mtfTrend.convictionModifier));
      }

      allSetups.push(setup);
    }

    // Apply portfolio risk gate per setup
    if (activeSetups && historySetups) {
      for (const setup of allSetups) {
        const gate = evaluatePortfolioGate(
          setup,
          activeSetups,
          historySetups
        );
        setup.portfolioGate = gate;

        // If can't open new, cap conviction to D (filtered by hard filters)
        if (!gate.canOpenNew) {
          setup.convictionScore = Math.min(setup.convictionScore, 19);
          setup.conviction = "D";
        }

        // Apply drawdown throttle to position size
        if (gate.drawdownThrottle < 1.0) {
          setup.positionSizeLots = Number(
            (setup.positionSizeLots * gate.drawdownThrottle).toFixed(2)
          );
          setup.riskAmount = Number(
            (setup.riskAmount * gate.drawdownThrottle).toFixed(2)
          );
        }
      }
    }

    const ranked = rankSetupsByConviction(allSetups);

    const portfolioRisk: PortfolioRisk = {
      riskPercent,
      canTrade: true,
      warning: null,
    };

    const instrumentsWithData = Object.keys(candleMap).length;
    return { setups: ranked, allSetups, portfolioRisk, instrumentsWithData };
  }, [candleMap, riskPercent, confluencePatterns, activeSetups, historySetups]);

  return {
    setups,
    allSetups,
    portfolioRisk,
    instrumentsWithData: setups.length > 0 ? INSTRUMENTS.length : (candleMap ? Object.keys(candleMap).length : 0),
    isLoading,
    error,
    allInstrumentCount: INSTRUMENTS.length,
    refresh: () => mutate(),
  };
}
