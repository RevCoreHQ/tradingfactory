"use client";

import useSWR from "swr";
import { useMemo } from "react";
import type { OHLCV } from "@/lib/types/market";
import type { TechnicalSummary } from "@/lib/types/indicators";
import { calculateAllIndicators } from "@/lib/calculations/technical-indicators";
import { useMarketStore } from "@/lib/store/market-store";
import { REFRESH_INTERVALS } from "@/lib/utils/constants";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const EMPTY_CANDLES: OHLCV[] = [];

export function useTechnicalData() {
  const instrument = useMarketStore((s) => s.selectedInstrument);
  const timeframe = useMarketStore((s) => s.selectedTimeframe);

  const { data, error, isLoading } = useSWR<{
    candles: OHLCV[];
    instrument: string;
    timeframe: string;
  }>(`/api/technicals/price-data?instrument=${instrument.id}&timeframe=${timeframe}`, fetcher, {
    refreshInterval: REFRESH_INTERVALS.INDICATORS,
    revalidateOnFocus: false,
  });

  // Use stable reference for empty array to prevent infinite re-render loops
  const candles = data?.candles ?? EMPTY_CANDLES;

  const indicators: TechnicalSummary | null = useMemo(() => {
    if (candles.length < 20) return null;
    return calculateAllIndicators(candles, instrument.id, timeframe);
  }, [candles, instrument.id, timeframe]);

  return {
    candles,
    indicators,
    isLoading,
    error,
  };
}

export function usePriceData(instrumentId: string, timeframe: string) {
  const { data, error, isLoading } = useSWR<{
    candles: OHLCV[];
  }>(`/api/technicals/price-data?instrument=${instrumentId}&timeframe=${timeframe}`, fetcher, {
    refreshInterval: REFRESH_INTERVALS.INDICATORS,
    revalidateOnFocus: false,
  });

  return {
    candles: data?.candles || [],
    isLoading,
    error,
  };
}
