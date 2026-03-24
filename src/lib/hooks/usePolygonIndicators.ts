"use client";

import useSWR from "swr";
import { useMarketStore } from "@/lib/store/market-store";

interface PolygonIndicatorValue {
  value: number;
  timestamp: number;
  signal?: number;
  histogram?: number;
}

interface PolygonIndicatorsData {
  instrument: string;
  timespan: string;
  indicators: {
    rsi: PolygonIndicatorValue | null;
    ema21: PolygonIndicatorValue | null;
    sma50: PolygonIndicatorValue | null;
    macd: (PolygonIndicatorValue & { signal?: number; histogram?: number }) | null;
  };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function usePolygonIndicators(timespan: "day" | "hour" = "day") {
  const instrument = useMarketStore((s) => s.selectedInstrument);

  const { data, isLoading } = useSWR<PolygonIndicatorsData>(
    `/api/technicals/polygon-indicators?instrument=${instrument.id}&timespan=${timespan}`,
    fetcher,
    {
      refreshInterval: 2 * 60_000,
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );

  return {
    indicators: data?.indicators || null,
    isLoading,
  };
}
