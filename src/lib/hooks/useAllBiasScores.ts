"use client";

import { useEffect, useMemo, useRef } from "react";
import useSWR from "swr";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { useMarketStore } from "@/lib/store/market-store";
import { useMarketNews, useFearGreed, useBondYields, useCentralBanks, useEconomicCalendar } from "./useMarketData";
import { useLLMBatchAnalysis } from "./useLLMAnalysis";
import { useADRData } from "./useADRData";
import { calculateFundamentalScore, calculateOverallBias, applyLLMAnalysis } from "@/lib/calculations/bias-engine";
import { computeADRRanks, calculateTradeSetup } from "@/lib/calculations/trade-setup";
import { getBiasDirection } from "@/lib/utils/formatters";
import type { BiasSignal, TechnicalScore } from "@/lib/types/bias";
import { buildDecisionLayer, computeDecisionRationale } from "@/lib/calculations/decision-context";
import type { MTFTrendSummary } from "@/lib/types/mtf";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const DEFAULT_FEAR_GREED = { value: 50, label: "Neutral", timestamp: 0, previousClose: 50, previousWeek: 50, previousMonth: 50 };
const DEFAULT_DXY = { value: 0, change: 0, changePercent: 0, history: [] as { value: number }[] };
const DEFAULT_TECHNICAL_SCORE: TechnicalScore = {
  total: 50,
  trendDirection: 50,
  momentum: 50,
  volatility: 50,
  volumeAnalysis: 50,
  supportResistance: 50,
};

// EMA smoothing alpha: 0 = fully previous, 1 = fully new.
// 0.5 means each recalculation blends 50/50 with previous,
// preventing single-calculation noise from flipping direction.
const SMOOTH_ALPHA = 0.5;

export function useAllBiasScores() {
  const setBiasResult = useMarketStore((s) => s.setBiasResult);
  const setAllBiasResults = useMarketStore((s) => s.setAllBiasResults);
  const setBatchLLMResults = useMarketStore((s) => s.setBatchLLMResults);
  const setBatchLLMReady = useMarketStore((s) => s.setBatchLLMReady);
  const setBatchLLMError = useMarketStore((s) => s.setBatchLLMError);
  const prevBiasRef = useRef<Record<string, number>>({});

  const { data: newsData } = useMarketNews();
  const { data: fearGreedData } = useFearGreed();
  const { data: bondData } = useBondYields();
  const { data: bankData } = useCentralBanks();
  const { adrData } = useADRData();
  const { data: calendarData } = useEconomicCalendar();

  // Fetch real technical scores for all instruments
  const { data: batchTechData } = useSWR<{
    scores: Record<
      string,
      {
        score: TechnicalScore;
        score15m: TechnicalScore;
        score1h: TechnicalScore;
        signals: BiasSignal[];
        currentPrice: number;
        technicalBasis: string;
        mtfAlignmentPercent: number;
        mtfEmaSummary: MTFTrendSummary | null;
      }
    >;
  }>("/api/technicals/batch-scores", fetcher, {
    refreshInterval: 5 * 60_000, // 5 min
    revalidateOnFocus: false,
  });
  const techScores = useMemo(() => batchTechData?.scores ?? {}, [batchTechData]);

  const ruleBasedResults = useMemo(() => {
    const news = newsData?.items || [];
    const fearGreed = fearGreedData?.current || DEFAULT_FEAR_GREED;
    const yields = bondData?.yields || [];
    const dxy = bondData?.dxy || DEFAULT_DXY;
    const banks = bankData?.banks || [];
    const calendarEvents = calendarData?.events ?? [];
    const fearVal = fearGreed.value;
    const y10 = yields.find((b) => b.maturity === "10Y");
    const yield10Change = y10?.change ?? 0;

    const intradayResults: Record<string, ReturnType<typeof calculateOverallBias>> = {};

    for (const inst of INSTRUMENTS) {
      const fundamentalResult = calculateFundamentalScore(
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

      const techEntry = techScores[inst.id];
      const technicalScore = techEntry?.score ?? DEFAULT_TECHNICAL_SCORE;
      const technical15m = techEntry?.score15m ?? technicalScore;
      const technical1h = techEntry?.score1h ?? technicalScore;
      const technicalSignals = techEntry?.signals ?? [];
      const allSignals = [...fundamentalResult.signals, ...technicalSignals];

      const ruleBased = calculateOverallBias(
        fundamentalResult.score,
        technicalScore,
        "intraday",
        inst.id,
        undefined,
        allSignals
      );

      const decision = buildDecisionLayer(
        inst.id,
        fundamentalResult.score,
        technical15m,
        technical1h,
        fundamentalResult.signals,
        fearVal,
        dxy.change,
        yield10Change,
        calendarEvents,
        ruleBased.overallBias,
        ruleBased.confidence
      );

      intradayResults[inst.id] = {
        ...ruleBased,
        ...decision,
        technicalBasis: techEntry?.technicalBasis,
        mtfAlignmentPercent: techEntry?.mtfAlignmentPercent,
        mtfEmaSummary: techEntry?.mtfEmaSummary ?? null,
      };
    }

    // EMA smoothing: blend new bias with previous to prevent oscillation.
    // On first load (no previous values), raw values pass through unchanged.
    for (const inst of INSTRUMENTS) {
      const result = intradayResults[inst.id];
      const prevBias = prevBiasRef.current[inst.id];
      if (result && prevBias !== undefined) {
        const smoothedBias = SMOOTH_ALPHA * result.overallBias + (1 - SMOOTH_ALPHA) * prevBias;
        intradayResults[inst.id] = {
          ...result,
          overallBias: smoothedBias,
          direction: getBiasDirection(smoothedBias),
        };
      }
    }

    return { intraday: intradayResults, intraweek: {} as Record<string, ReturnType<typeof calculateOverallBias>> };
  }, [newsData, fearGreedData, bondData, bankData, techScores, calendarData]);

  // Fetch LLM batch analysis using intraday results
  const currentTimeframeResults = ruleBasedResults.intraday;
  const { batchResults, isReady: llmReady, apiError: llmApiError } = useLLMBatchAnalysis(currentTimeframeResults);

  // Compute ADR ranks
  const adrRanks = useMemo(() => {
    if (!adrData) return null;
    return computeADRRanks(adrData);
  }, [adrData]);

  // Enhance results with LLM analysis + ADR + trade setups
  const allResults = useMemo(() => {
    const enhanced = {
      intraday: { ...ruleBasedResults.intraday },
      intraweek: {} as typeof ruleBasedResults.intraday,
    };

    // Apply LLM analysis
    if (batchResults) {
      for (const [instrumentId, llmResult] of Object.entries(batchResults)) {
        if (enhanced.intraday[instrumentId]) {
          enhanced.intraday[instrumentId] = applyLLMAnalysis(enhanced.intraday[instrumentId], llmResult);
        }
      }
    }

    // Attach ADR + trade setup to each result
    if (adrRanks) {
      for (const [instId, result] of Object.entries(enhanced.intraday)) {
        const adr = adrRanks[instId];
        if (adr) {
          const inst = INSTRUMENTS.find((i) => i.id === instId);
          const pipSize = inst?.pipSize || 0.0001;
          const atrEstimate = adr.pips * pipSize;
          const adrDerivedPrice = atrEstimate / (adr.percent / 100) || 1;
          const techPrice = techScores[instId]?.currentPrice;
          const currentPrice =
            techPrice !== undefined && techPrice > 0 ? techPrice : adrDerivedPrice;

          const tradeSetup = calculateTradeSetup(
            result,
            atrEstimate,
            adr,
            currentPrice,
            "intraday"
          );
          const withSetup = { ...result, adr, tradeSetup };
          enhanced.intraday[instId] = {
            ...withSetup,
            decisionRationale: computeDecisionRationale(withSetup),
          };
        }
      }
    }

    return enhanced;
  }, [ruleBasedResults, batchResults, adrRanks, techScores]);

  // Store all results, using ref to prevent infinite loops
  const prevHashRef = useRef("");
  const setBootReady = useMarketStore((s) => s.setBootReady);
  useEffect(() => {
    const hash = Object.values(allResults.intraday)
      .map((r) => `${r.instrument}:${r.overallBias.toFixed(1)}`)
      .join("|");

    if (hash !== prevHashRef.current) {
      prevHashRef.current = hash;
      // Update smoothing ref with latest values for next recalculation
      const newPrevBias: Record<string, number> = {};
      for (const [id, result] of Object.entries(allResults.intraday)) {
        newPrevBias[id] = result.overallBias;
      }
      prevBiasRef.current = newPrevBias;

      setAllBiasResults("intraday", allResults.intraday);
      for (const [id, result] of Object.entries(allResults.intraday)) {
        setBiasResult(id, result);
      }
      if (Object.keys(allResults.intraday).length > 0) {
        setBootReady("bias");
      }
    }
    setBatchLLMResults(batchResults);
    if (llmReady) {
      setBatchLLMReady(true);
      setBootReady("llmBatch");
    }
    if (llmApiError) {
      setBatchLLMError(llmApiError);
      setBootReady("llmBatch"); // unblock boot on error too
    }
  }, [allResults, batchResults, llmReady, llmApiError, setBiasResult, setAllBiasResults, setBatchLLMResults, setBatchLLMReady, setBatchLLMError, setBootReady]);

  return allResults;
}
