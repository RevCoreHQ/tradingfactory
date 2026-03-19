"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { useMarketStore } from "@/lib/store/market-store";
import { calculateAllIndicators } from "@/lib/calculations/technical-indicators";
import { computeMTFTimeframeResult, calculateMTFConfluence } from "@/lib/calculations/mtf-confluence";
import type { OHLCV } from "@/lib/types/market";
import type { MTFConfluenceResult } from "@/lib/types/mtf";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TIMEFRAMES = ["1h", "4h", "1d"] as const;

export function useMultiTimeframeAnalysis(): {
  confluence: MTFConfluenceResult | null;
  isLoading: boolean;
  insufficientData: boolean;
} {
  const instrument = useMarketStore((s) => s.selectedInstrument);

  const results = TIMEFRAMES.map((tf) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data, isLoading } = useSWR<{ candles: OHLCV[] }>(
      `/api/technicals/price-data?instrument=${instrument.id}&timeframe=${tf}`,
      fetcher,
      {
        revalidateOnFocus: false,
        dedupingInterval: 120_000,
      }
    );
    return { data, isLoading, tf };
  });

  const isLoading = results.some((r) => r.isLoading);
  const allLoaded = results.every((r) => !r.isLoading);
  const allReady = results.every((r) => r.data && r.data.candles && r.data.candles.length >= 20);

  const confluence = useMemo<MTFConfluenceResult | null>(() => {
    if (!allReady) return null;

    const tfResults = results.map((r) => {
      const candles = r.data!.candles;
      const currentPrice = candles[candles.length - 1].close;
      const summary = calculateAllIndicators(candles, instrument.id, r.tf);
      return computeMTFTimeframeResult(summary, currentPrice, r.tf);
    });

    return calculateMTFConfluence(tfResults);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allReady, instrument.id, ...results.map((r) => r.data)]);

  return { confluence, isLoading, insufficientData: allLoaded && !allReady };
}
