"use client";

import useSWR from "swr";
import { useEffect } from "react";
import { useMarketStore } from "@/lib/store/market-store";
import { REFRESH_INTERVALS } from "@/lib/utils/constants";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useADRData() {
  const setADRData = useMarketStore((s) => s.setADRData);

  const { data, isLoading } = useSWR<{
    adr: Record<string, { pips: number; percent: number }>;
  }>("/api/technicals/adr", fetcher, {
    refreshInterval: REFRESH_INTERVALS.ADR_DATA,
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  useEffect(() => {
    if (data?.adr && Object.keys(data.adr).length > 0) {
      setADRData(data.adr);
    }
  }, [data, setADRData]);

  return { adrData: data?.adr ?? null, isLoading };
}
