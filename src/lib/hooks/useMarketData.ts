"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import type { NewsItem, EconomicEvent, FearGreedData, BondYield, CentralBankRate, PriceQuote, DXYData } from "@/lib/types/market";
import { REFRESH_INTERVALS } from "@/lib/utils/constants";
import { useMarketStore } from "@/lib/store/market-store";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Signal boot readiness once (first non-null data arrival) */
function useBootSignal(key: string, data: unknown) {
  const fired = useRef(false);
  const setBootReady = useMarketStore((s) => s.setBootReady);
  useEffect(() => {
    if (data && !fired.current) {
      fired.current = true;
      setBootReady(key);
    }
  }, [data, key, setBootReady]);
}

export function useMarketNews() {
  const instrument = useMarketStore((s) => s.selectedInstrument);
  const result = useSWR<{
    items: NewsItem[];
    aggregateSentiment: { avgScore: number; distribution: Record<string, number>; biasScore: number };
  }>(`/api/fundamentals/news?instrument=${instrument.id}`, fetcher, {
    refreshInterval: REFRESH_INTERVALS.NEWS,
    revalidateOnFocus: false,
  });
  useBootSignal("news", result.data);
  return result;
}

export function useEconomicCalendar() {
  return useSWR<{ events: EconomicEvent[] }>("/api/fundamentals/economic-calendar", fetcher, {
    refreshInterval: REFRESH_INTERVALS.ECONOMIC_CALENDAR,
    revalidateOnFocus: false,
  });
}

export function useRates() {
  const result = useSWR<{ quotes: Record<string, PriceQuote> }>("/api/fundamentals/rates", fetcher, {
    refreshInterval: REFRESH_INTERVALS.PRICES,
    revalidateOnFocus: true,
  });
  useBootSignal("rates", result.data);
  return result;
}

export function useFearGreed() {
  const result = useSWR<{ current: FearGreedData }>("/api/fundamentals/fear-greed", fetcher, {
    refreshInterval: REFRESH_INTERVALS.FEAR_GREED,
    revalidateOnFocus: false,
  });
  useBootSignal("fearGreed", result.data);
  return result;
}

export function useBondYields() {
  const result = useSWR<{
    yields: BondYield[];
    dxy: DXYData;
    fedRate: { current: number; previous: number; target: number };
  }>("/api/fundamentals/bond-yields", fetcher, {
    refreshInterval: REFRESH_INTERVALS.BOND_YIELDS,
    revalidateOnFocus: false,
  });
  useBootSignal("bonds", result.data);
  return result;
}

export function useCentralBanks() {
  return useSWR<{ banks: CentralBankRate[] }>("/api/fundamentals/central-banks", fetcher, {
    refreshInterval: 3600_000, // 1 hour - rarely changes
    revalidateOnFocus: false,
  });
}

export function useSentiment(instrument?: string) {
  return useSWR<{
    instrument: string;
    newsCount: number;
    avgScore: number;
    distribution: { bearish: number; neutral: number; bullish: number };
    biasScore: number;
  }>(instrument ? `/api/fundamentals/sentiment?instrument=${instrument}` : null, fetcher, {
    refreshInterval: REFRESH_INTERVALS.NEWS,
    revalidateOnFocus: false,
  });
}

export function useCOTData() {
  return useSWR<{
    positions: import("@/lib/types/cot").COTPosition[];
    lastUpdated: string;
  }>("/api/fundamentals/cot", fetcher, {
    refreshInterval: 3600_000, // 1 hour — COT data updates weekly
    revalidateOnFocus: false,
  });
}
