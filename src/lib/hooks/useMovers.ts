"use client";

import useSWR from "swr";
import type { MoverEntry } from "@/lib/api/massive";

interface MoversData {
  gainers: MoverEntry[];
  losers: MoverEntry[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useMovers() {
  const { data, isLoading } = useSWR<MoversData>(
    "/api/fundamentals/movers",
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: false }
  );

  return {
    gainers: data?.gainers || [],
    losers: data?.losers || [],
    isLoading,
  };
}
