"use client";

import { useEffect, useMemo, useRef } from "react";
import useSWR from "swr";
import { useMarketStore } from "@/lib/store/market-store";
import {
  useMarketNews,
  useFearGreed,
  useBondYields,
  useCentralBanks,
  useEconomicCalendar,
} from "./useMarketData";
import { useTechnicalData } from "./useTechnicalData";
import { useLLMAnalysis } from "./useLLMAnalysis";
import { calculateFundamentalScore, calculateTechnicalScore, calculateOverallBias, applyLLMAnalysis } from "@/lib/calculations/bias-engine";
import { calculateTradeSetup } from "@/lib/calculations/trade-setup";
import { buildDecisionLayer } from "@/lib/calculations/decision-context";
import type { TechnicalScore } from "@/lib/types/bias";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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

export function useBiasScore() {
  const instrument = useMarketStore((s) => s.selectedInstrument);
  const biasTimeframe = "intraday" as const;
  const setBiasResult = useMarketStore((s) => s.setBiasResult);
  // Read storedBias non-reactively to avoid re-render cascades
  // (useAllBiasScores on the homepage writes to biasResults for all instruments)
  const storedBiasRef = useRef(useMarketStore.getState().biasResults[instrument.id]);
  const adrData = useMarketStore((s) => s.adrData);

  const { data: newsData } = useMarketNews();
  const { data: fearGreedData } = useFearGreed();
  const { data: bondData } = useBondYields();
  const { data: bankData } = useCentralBanks();
  const { data: calendarData } = useEconomicCalendar();
  const { indicators, candles } = useTechnicalData();
  const { llmAnalysis } = useLLMAnalysis();

  const { data: batchTechData } = useSWR<{
    scores: Record<
      string,
      {
        score: TechnicalScore;
        score15m: TechnicalScore;
        score1h: TechnicalScore;
        mtfAlignmentPercent: number;
      }
    >;
  }>("/api/technicals/batch-scores", fetcher, {
    refreshInterval: 5 * 60_000,
    revalidateOnFocus: false,
  });

  const biasResult = useMemo(() => {
    const news = newsData?.items || [];
    const fearGreed = fearGreedData?.current || DEFAULT_FEAR_GREED;
    const yields = bondData?.yields || [];
    const dxy = bondData?.dxy || DEFAULT_DXY;
    const banks = bankData?.banks || [];
    const calendarEvents = calendarData?.events ?? [];
    const y10 = yields.find((b) => b.maturity === "10Y");
    const yield10Change = y10?.change ?? 0;
    const techEntry = batchTechData?.scores?.[instrument.id];

    const fundamentalResult = calculateFundamentalScore(
      news,
      [],
      { cpi: 0, gdp: 0, unemployment: 0 },
      banks,
      fearGreed,
      dxy,
      yields,
      {},
      instrument.id
    );

    const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
    const technicalResult = indicators
      ? calculateTechnicalScore(indicators, currentPrice)
      : null;

    const fundamentalScore = fundamentalResult.score;
    const technicalScore = technicalResult?.score ?? DEFAULT_TECHNICAL_SCORE;
    const technical15m = techEntry?.score15m ?? technicalScore;
    const technical1h = techEntry?.score1h ?? technicalScore;
    const allSignals = [...fundamentalResult.signals, ...(technicalResult?.signals ?? [])];

    const ruleBasedResult = calculateOverallBias(fundamentalScore, technicalScore, biasTimeframe, instrument.id, undefined, allSignals);

    const decision = techEntry
      ? buildDecisionLayer(
          instrument.id,
          fundamentalScore,
          technical15m,
          technical1h,
          fundamentalResult.signals,
          fearGreed.value,
          dxy.change,
          yield10Change,
          calendarEvents
        )
      : {};

    // Enhance with LLM analysis
    let result = applyLLMAnalysis(
      {
        ...ruleBasedResult,
        ...decision,
        mtfAlignmentPercent: techEntry?.mtfAlignmentPercent,
      },
      llmAnalysis
    );

    // Attach ADR + trade setup if available
    const instAdr = adrData?.[instrument.id];
    if (instAdr && currentPrice > 0) {
      const atr = indicators?.atr?.value || (instAdr.pips * instrument.pipSize);
      const adrWithRank = { ...instAdr, rank: 50 }; // single instrument doesn't have ranking context
      result = {
        ...result,
        adr: adrWithRank,
        tradeSetup: calculateTradeSetup(
          result,
          atr,
          adrWithRank,
          currentPrice,
          biasTimeframe
        ),
      };
    }

    return result;
  }, [
    newsData,
    fearGreedData,
    bondData,
    bankData,
    calendarData,
    batchTechData,
    indicators,
    candles,
    instrument,
    biasTimeframe,
    llmAnalysis,
    adrData,
  ]);

  // Use a ref to avoid setBiasResult triggering re-renders that cause infinite loops
  const prevBiasRef = useRef<string>("");
  useEffect(() => {
    if (!biasResult) return;
    const key = `${instrument.id}:${biasResult.overallBias.toFixed(2)}:${biasResult.direction}`;
    if (key !== prevBiasRef.current) {
      prevBiasRef.current = key;
      setBiasResult(instrument.id, biasResult);
    }
  }, [biasResult, instrument.id, setBiasResult]);

  return { biasResult: biasResult || storedBiasRef.current, isCalculating: !biasResult };
}
