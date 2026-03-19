"use client";

import useSWR from "swr";
import { useMemo } from "react";
import type { OHLCV } from "@/lib/types/market";
import type { TradeDeskSetup, PortfolioRisk, ConfluencePattern } from "@/lib/types/signals";
import { INSTRUMENTS, REFRESH_INTERVALS } from "@/lib/utils/constants";
import { calculateAllIndicators } from "@/lib/calculations/technical-indicators";
import { generateTradeDeskSetup, rankSetupsByConviction } from "@/lib/calculations/mechanical-signals";

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

async function fetchAllCandles(): Promise<Record<string, OHLCV[]>> {
  const results: Record<string, OHLCV[]> = {};
  const promises = INSTRUMENTS.map(async (inst) => {
    try {
      const res = await fetch(
        `/api/technicals/price-data?instrument=${inst.id}&timeframe=1h`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.candles?.length > 20) {
        results[inst.id] = data.candles;
      }
    } catch {}
  });
  await Promise.all(promises);
  return results;
}

export function useTradeDeskData(confluencePatterns?: Record<string, ConfluencePattern>) {
  const accountEquity = getStoredNumber(ACCOUNT_EQUITY_KEY, 10000);
  const riskPercent = getStoredNumber(RISK_PERCENT_KEY, 2);

  const { data: candleMap, isLoading, error } = useSWR(
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
      const candles = candleMap[inst.id];
      if (!candles || candles.length < 30) continue;

      const summary = calculateAllIndicators(candles, inst.id, "1h");
      const setup = generateTradeDeskSetup(
        candles,
        summary,
        inst,
        accountEquity,
        riskPercent,
        confluencePatterns
      );
      allSetups.push(setup);
    }

    const ranked = rankSetupsByConviction(allSetups);

    // Portfolio risk (simplified — no open positions tracked)
    const portfolioRisk: PortfolioRisk = {
      accountEquity,
      riskPerTrade: accountEquity * (riskPercent / 100),
      riskPercent,
      portfolioHeat: 0,
      canTrade: true,
      warning: null,
    };

    return { setups: ranked, portfolioRisk };
  }, [candleMap, accountEquity, riskPercent, confluencePatterns]);

  return {
    setups,
    portfolioRisk,
    isLoading,
    error,
    allInstrumentCount: INSTRUMENTS.length,
  };
}
