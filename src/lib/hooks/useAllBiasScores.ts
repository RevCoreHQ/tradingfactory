"use client";

import { useEffect, useMemo, useRef } from "react";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { useMarketStore } from "@/lib/store/market-store";
import { useMarketNews, useFearGreed, useBondYields, useCentralBanks } from "./useMarketData";
import { calculateFundamentalScore, calculateOverallBias } from "@/lib/calculations/bias-engine";

const DEFAULT_FEAR_GREED = { value: 50, label: "Neutral", timestamp: 0, previousClose: 50, previousWeek: 50, previousMonth: 50 };
const DEFAULT_DXY = { value: 0, change: 0, changePercent: 0, history: [] as { value: number }[] };
const DEFAULT_TECHNICAL_SCORE = {
  total: 50,
  trendDirection: 50,
  momentum: 50,
  volatility: 50,
  volumeAnalysis: 50,
  supportResistance: 50,
};

export function useAllBiasScores() {
  const biasTimeframe = useMarketStore((s) => s.biasTimeframe);
  const setBiasResult = useMarketStore((s) => s.setBiasResult);

  const { data: newsData } = useMarketNews();
  const { data: fearGreedData } = useFearGreed();
  const { data: bondData } = useBondYields();
  const { data: bankData } = useCentralBanks();

  const allResults = useMemo(() => {
    const news = newsData?.items || [];
    const fearGreed = fearGreedData?.current || DEFAULT_FEAR_GREED;
    const yields = bondData?.yields || [];
    const dxy = bondData?.dxy || DEFAULT_DXY;
    const banks = bankData?.banks || [];

    const results: Record<string, ReturnType<typeof calculateOverallBias>> = {};

    for (const inst of INSTRUMENTS) {
      const fundamentalScore = calculateFundamentalScore(
        news,
        [],
        { cpi: 0, gdp: 0, unemployment: 0 },
        banks,
        fearGreed,
        dxy,
        yields,
        {},
        inst.id
      );

      results[inst.id] = calculateOverallBias(
        fundamentalScore,
        DEFAULT_TECHNICAL_SCORE,
        biasTimeframe,
        inst.id
      );
    }

    return results;
  }, [newsData, fearGreedData, bondData, bankData, biasTimeframe]);

  // Store all results, using ref to prevent infinite loops
  const prevHashRef = useRef("");
  useEffect(() => {
    const hash = Object.values(allResults)
      .map((r) => `${r.instrument}:${r.overallBias.toFixed(1)}`)
      .join("|");
    if (hash !== prevHashRef.current) {
      prevHashRef.current = hash;
      for (const [id, result] of Object.entries(allResults)) {
        setBiasResult(id, result);
      }
    }
  }, [allResults, setBiasResult]);

  return allResults;
}
