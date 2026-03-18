"use client";

import useSWR from "swr";
import { useFearGreed, useBondYields, useCentralBanks } from "./useMarketData";
import { REFRESH_INTERVALS } from "@/lib/utils/constants";
import type { MarketSummaryResult } from "@/lib/types/llm";

const postFetcher = async ([url, body]: [string, unknown]) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
};

// Fetch general news (no instrument filter)
function useGeneralNews() {
  const fetcher = (url: string) => fetch(url).then((r) => r.json());
  return useSWR<{ items: { headline: string; sentimentLabel: string; sentimentScore: number }[] }>(
    "/api/fundamentals/news",
    fetcher,
    { refreshInterval: REFRESH_INTERVALS.NEWS, revalidateOnFocus: false }
  );
}

export function useMarketSummary() {
  const { data: fearGreedData } = useFearGreed();
  const { data: bondData } = useBondYields();
  const { data: bankData } = useCentralBanks();
  const { data: newsData } = useGeneralNews();

  const hasData = !!fearGreedData;

  const requestBody = hasData
    ? {
        fearGreed: {
          value: fearGreedData.current?.value ?? 50,
          label: fearGreedData.current?.label ?? "Neutral",
        },
        dxy: {
          value: bondData?.dxy?.value ?? 0,
          change: bondData?.dxy?.change ?? 0,
        },
        bondYields: (bondData?.yields || []).map((y: { maturity: string; yield: number; change: number }) => ({
          maturity: y.maturity,
          yield: y.yield,
          change: y.change,
        })),
        centralBanks: (bankData?.banks || []).map((b: { bank: string; currentRate: number; rateDirection: string; policyStance: string }) => ({
          bank: b.bank,
          rate: b.currentRate,
          direction: b.rateDirection,
          stance: b.policyStance,
        })),
        newsHeadlines: (newsData?.items || []).slice(0, 10).map((n) => ({
          headline: n.headline,
          sentiment: n.sentimentLabel,
          score: n.sentimentScore,
        })),
      }
    : null;

  const { data, error, isLoading } = useSWR<{ summary: MarketSummaryResult | null }>(
    hasData ? ["/api/analysis/market-summary", requestBody] : null,
    postFetcher,
    {
      refreshInterval: REFRESH_INTERVALS.MARKET_SUMMARY,
      revalidateOnFocus: false,
      dedupingInterval: REFRESH_INTERVALS.MARKET_SUMMARY,
    }
  );

  return {
    summary: data?.summary || null,
    isLoading,
    error,
  };
}
