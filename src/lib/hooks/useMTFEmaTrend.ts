"use client";

import useSWR from "swr";
import type { MTFTrendSummary } from "@/lib/types/mtf";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useMTFEmaTrend() {
  const { data, isLoading } = useSWR<{ trends: Record<string, MTFTrendSummary | null> }>(
    "/api/technicals/mtf-ema-trend",
    fetcher,
    { refreshInterval: 5 * 60_000, revalidateOnFocus: false }
  );

  return { trends: data?.trends || {}, isLoading };
}
