"use client";

import useSWR from "swr";
import { useMemo } from "react";
import type { OHLCV } from "@/lib/types/market";
import type { TradeDeskSetup, PortfolioRisk, ConfluencePattern } from "@/lib/types/signals";
import { INSTRUMENTS, REFRESH_INTERVALS } from "@/lib/utils/constants";
import { calculateAllIndicators } from "@/lib/calculations/technical-indicators";
import { generateTradeDeskSetup, rankSetupsByConviction, selectTradingStyle } from "@/lib/calculations/mechanical-signals";
import { getSessionRelevance } from "@/lib/calculations/session-scoring";

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

interface DualCandles {
  candles1h: OHLCV[];
  candles4h: OHLCV[];
}

const BATCH_SIZE = 4; // Process 4 instruments at a time to stay under 55 req/min
const BATCH_DELAY_MS = 2000; // 2s between batches

async function fetchAllCandles(): Promise<Record<string, DualCandles>> {
  const results: Record<string, DualCandles> = {};

  // Process instruments in batches to avoid blowing Twelve Data rate limit
  for (let i = 0; i < INSTRUMENTS.length; i += BATCH_SIZE) {
    const batch = INSTRUMENTS.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (inst) => {
        try {
          const [res1h, res4h] = await Promise.all([
            fetch(`/api/technicals/price-data?instrument=${inst.id}&timeframe=1h`),
            fetch(`/api/technicals/price-data?instrument=${inst.id}&timeframe=4h`),
          ]);

          const data1h = res1h.ok ? await res1h.json() : { candles: [] };
          const data4h = res4h.ok ? await res4h.json() : { candles: [] };

          // Need at least 4h data; 1h is optional (fallback to swing)
          if (data4h.candles?.length > 20) {
            results[inst.id] = {
              candles1h: data1h.candles?.length > 20 ? data1h.candles : [],
              candles4h: data4h.candles,
            };
          }
        } catch {}
      })
    );
    // Wait between batches (skip delay after last batch)
    if (i + BATCH_SIZE < INSTRUMENTS.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }
  return results;
}

export function useTradeDeskData(confluencePatterns?: Record<string, ConfluencePattern>) {
  const accountEquity = getStoredNumber(ACCOUNT_EQUITY_KEY, 10000);
  const riskPercent = getStoredNumber(RISK_PERCENT_KEY, 2);

  const { data: candleMap, isLoading, error, mutate } = useSWR(
    "trade-desk-candles",
    fetchAllCandles,
    {
      refreshInterval: REFRESH_INTERVALS.INDICATORS,
      revalidateOnFocus: false,
    }
  );

  const { setups, portfolioRisk } = useMemo(() => {
    if (!candleMap || Object.keys(candleMap).length === 0) {
      return {
        setups: [] as TradeDeskSetup[],
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
      const dual = candleMap[inst.id];
      if (!dual || dual.candles4h.length < 30) continue;

      // Always compute 4h summary for regime detection
      const summary4h = calculateAllIndicators(dual.candles4h, inst.id, "4h");
      const adx = summary4h.adx.adx;

      // Select trading style based on 4h regime + session
      const session = getSessionRelevance(inst.id);
      const style = selectTradingStyle(adx, session.sessionScore);

      // Pick candles for the selected timeframe
      let candles: OHLCV[];
      let summary;

      if (style === "intraday" && dual.candles1h.length >= 30) {
        candles = dual.candles1h;
        summary = calculateAllIndicators(dual.candles1h, inst.id, "1h");
      } else {
        // Fallback to swing if 1h data unavailable
        candles = dual.candles4h;
        summary = summary4h;
      }

      const effectiveStyle = style === "intraday" && dual.candles1h.length >= 30 ? "intraday" : "swing";

      const setup = generateTradeDeskSetup(
        candles,
        summary,
        inst,
        accountEquity,
        riskPercent,
        confluencePatterns,
        effectiveStyle
      );
      allSetups.push(setup);
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
    return { setups: ranked, portfolioRisk, instrumentsWithData };
  }, [candleMap, accountEquity, riskPercent, confluencePatterns]);

  return {
    setups,
    portfolioRisk,
    instrumentsWithData: setups.length > 0 ? INSTRUMENTS.length : (candleMap ? Object.keys(candleMap).length : 0),
    isLoading,
    error,
    allInstrumentCount: INSTRUMENTS.length,
    refresh: () => mutate(),
  };
}
