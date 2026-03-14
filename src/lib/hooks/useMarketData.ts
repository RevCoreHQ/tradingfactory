"use client";

import useSWR from "swr";
import type { NewsItem, EconomicEvent, FearGreedData, BondYield, CentralBankRate, PriceQuote, DXYData } from "@/lib/types/market";
import { REFRESH_INTERVALS } from "@/lib/utils/constants";
import { useMarketStore } from "@/lib/store/market-store";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useMarketNews() {
  const instrument = useMarketStore((s) => s.selectedInstrument);
  return useSWR<{
    items: NewsItem[];
    aggregateSentiment: { avgScore: number; distribution: Record<string, number>; biasScore: number };
  }>(`/api/fundamentals/news?instrument=${instrument.id}`, fetcher, {
    refreshInterval: REFRESH_INTERVALS.NEWS,
    revalidateOnFocus: false,
  });
}

export function useEconomicCalendar() {
  return useSWR<{ events: EconomicEvent[] }>("/api/fundamentals/economic-calendar", fetcher, {
    refreshInterval: REFRESH_INTERVALS.ECONOMIC_CALENDAR,
    revalidateOnFocus: false,
  });
}

export function useRates() {
  return useSWR<{ quotes: Record<string, PriceQuote> }>("/api/fundamentals/rates", fetcher, {
    refreshInterval: REFRESH_INTERVALS.PRICES,
    revalidateOnFocus: true,
  });
}

export function useFearGreed() {
  return useSWR<{ current: FearGreedData }>("/api/fundamentals/fear-greed", fetcher, {
    refreshInterval: REFRESH_INTERVALS.FEAR_GREED,
    revalidateOnFocus: false,
  });
}

export function useBondYields() {
  return useSWR<{
    yields: BondYield[];
    dxy: DXYData;
    fedRate: { current: number; previous: number; target: number };
  }>("/api/fundamentals/bond-yields", fetcher, {
    refreshInterval: REFRESH_INTERVALS.BOND_YIELDS,
    revalidateOnFocus: false,
  });
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
