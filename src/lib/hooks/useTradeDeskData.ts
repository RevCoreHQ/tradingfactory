"use client";

import useSWR from "swr";
import { useMemo } from "react";
import type { OHLCV } from "@/lib/types/market";
import type { TradeDeskSetup, TrackedSetup, PortfolioRisk, ConfluencePattern } from "@/lib/types/signals";
import { INSTRUMENTS, REFRESH_INTERVALS } from "@/lib/utils/constants";
import { calculateAllIndicators } from "@/lib/calculations/technical-indicators";
import { generateTradeDeskSetup, rankSetupsByConviction, selectTradingStyle } from "@/lib/calculations/mechanical-signals";
import { getSessionRelevance } from "@/lib/calculations/session-scoring";
import { calculateMTFTrendSummary } from "@/lib/calculations/mtf-trend";
import { evaluatePortfolioGate } from "@/lib/calculations/portfolio-risk-gate";

const ACCOUNT_EQUITY_KEY = "tradingfactory_account_equity";
const RISK_PERCENT_KEY = "tradingfactory_risk_percent";

function getStoredNumber(key: string, defaultValue: number): number {
  if (typeof window === "undefined") return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    if (stored) return Number(stored);
  } catch {}
  return defaultValue;
}

interface MultiCandles {
  candles15m: OHLCV[];
  candles1h: OHLCV[];
  candles4h: OHLCV[];
  candles1d: OHLCV[];
}

const BATCH_SIZE = 2; // 2 instruments × 4 timeframes = 8 requests per batch
const BATCH_DELAY_MS = 3000; // 3s between batches — keeps us under 55 req/min

async function fetchAllCandles(): Promise<Record<string, MultiCandles>> {
  const results: Record<string, MultiCandles> = {};

  for (let i = 0; i < INSTRUMENTS.length; i += BATCH_SIZE) {
    const batch = INSTRUMENTS.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (inst) => {
        try {
          const [res15m, res1h, res4h, res1d] = await Promise.all([
            fetch(`/api/technicals/price-data?instrument=${inst.id}&timeframe=15min`),
            fetch(`/api/technicals/price-data?instrument=${inst.id}&timeframe=1h`),
            fetch(`/api/technicals/price-data?instrument=${inst.id}&timeframe=4h`),
            fetch(`/api/technicals/price-data?instrument=${inst.id}&timeframe=1d&limit=250`),
          ]);

          const data15m = res15m.ok ? await res15m.json() : { candles: [] };
          const data1h = res1h.ok ? await res1h.json() : { candles: [] };
          const data4h = res4h.ok ? await res4h.json() : { candles: [] };
          const data1d = res1d.ok ? await res1d.json() : { candles: [] };

          // Need at least 4h data; other TFs are optional
          if (data4h.candles?.length > 20) {
            results[inst.id] = {
              candles15m: data15m.candles?.length > 20 ? data15m.candles : [],
              candles1h: data1h.candles?.length > 20 ? data1h.candles : [],
              candles4h: data4h.candles,
              candles1d: data1d.candles?.length > 20 ? data1d.candles : [],
            };
          }
        } catch {}
      })
    );
    if (i + BATCH_SIZE < INSTRUMENTS.length) {
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
  const accountEquity = getStoredNumber(ACCOUNT_EQUITY_KEY, 0);
  const riskPercent = getStoredNumber(RISK_PERCENT_KEY, 2);

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
          accountEquity,
          riskPerTrade: accountEquity * (riskPercent / 100),
          riskPercent,
          portfolioHeat: 0,
          canTrade: true,
          warning: null,
        } as PortfolioRisk,
      };
    }

    const allSetups: TradeDeskSetup[] = [];

    for (const inst of INSTRUMENTS) {
      const multi = candleMap[inst.id];
      if (!multi || multi.candles4h.length < 30) continue;

      // Always compute 4h summary for regime detection
      const summary4h = calculateAllIndicators(multi.candles4h, inst.id, "4h");
      const adx = summary4h.adx.adx;

      // Select trading style based on 4h regime + session
      const session = getSessionRelevance(inst.id);
      const style = selectTradingStyle(adx, session.sessionScore);

      // Pick candles for the selected timeframe
      let candles: OHLCV[];
      let summary;

      if (style === "intraday" && multi.candles1h.length >= 30) {
        candles = multi.candles1h;
        summary = calculateAllIndicators(multi.candles1h, inst.id, "1h");
      } else {
        candles = multi.candles4h;
        summary = summary4h;
      }

      const effectiveStyle = style === "intraday" && multi.candles1h.length >= 30 ? "intraday" : "swing";

      const setup = generateTradeDeskSetup(
        candles,
        summary,
        inst,
        accountEquity,
        riskPercent,
        confluencePatterns,
        effectiveStyle
      );

      // Calculate MTF trend alignment
      const mtfTrend = calculateMTFTrendSummary({
        candles15m: multi.candles15m,
        candles1h: multi.candles1h,
        candles4h: multi.candles4h,
        candles1d: multi.candles1d,
      });

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
          historySetups,
          accountEquity
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
      accountEquity,
      riskPerTrade: accountEquity * (riskPercent / 100),
      riskPercent,
      portfolioHeat: 0,
      canTrade: true,
      warning: null,
    };

    const instrumentsWithData = Object.keys(candleMap).length;
    return { setups: ranked, allSetups, portfolioRisk, instrumentsWithData };
  }, [candleMap, accountEquity, riskPercent, confluencePatterns, activeSetups, historySetups]);

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
