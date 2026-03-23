"use client";

import { useEffect, useMemo, useRef } from "react";
import useSWR from "swr";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { useMarketStore } from "@/lib/store/market-store";
import { useMarketNews, useFearGreed, useBondYields, useCentralBanks } from "./useMarketData";
import { useLLMBatchAnalysis } from "./useLLMAnalysis";
import { useADRData } from "./useADRData";
import { calculateFundamentalScore, calculateOverallBias, applyLLMAnalysis } from "@/lib/calculations/bias-engine";
import { computeADRRanks, calculateTradeSetup } from "@/lib/calculations/trade-setup";
import type { TechnicalScore } from "@/lib/types/bias";

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

export function useAllBiasScores() {
  const setBiasResult = useMarketStore((s) => s.setBiasResult);
  const setAllBiasResults = useMarketStore((s) => s.setAllBiasResults);
  const setBatchLLMResults = useMarketStore((s) => s.setBatchLLMResults);
  const setBatchLLMReady = useMarketStore((s) => s.setBatchLLMReady);
  const setBatchLLMError = useMarketStore((s) => s.setBatchLLMError);

  const { data: newsData } = useMarketNews();
  const { data: fearGreedData } = useFearGreed();
  const { data: bondData } = useBondYields();
  const { data: bankData } = useCentralBanks();
  const { adrData } = useADRData();

  // Fetch real technical scores for all instruments
  const { data: batchTechData } = useSWR<{
    scores: Record<string, { score: TechnicalScore; currentPrice: number }>;
  }>("/api/technicals/batch-scores", fetcher, {
    refreshInterval: 5 * 60_000, // 5 min
    revalidateOnFocus: false,
  });
  const techScores = batchTechData?.scores || {};

  const ruleBasedResults = useMemo(() => {
    const news = newsData?.items || [];
    const fearGreed = fearGreedData?.current || DEFAULT_FEAR_GREED;
    const yields = bondData?.yields || [];
    const dxy = bondData?.dxy || DEFAULT_DXY;
    const banks = bankData?.banks || [];

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

      const technicalScore = techScores[inst.id]?.score ?? DEFAULT_TECHNICAL_SCORE;

      intradayResults[inst.id] = calculateOverallBias(
        fundamentalResult.score,
        technicalScore,
        "intraday",
        inst.id,
        undefined,
        fundamentalResult.signals
      );
    }

    return { intraday: intradayResults, intraweek: {} as Record<string, ReturnType<typeof calculateOverallBias>> };
  }, [newsData, fearGreedData, bondData, bankData, techScores]);

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
          const currentPrice = atrEstimate / (adr.percent / 100) || 1;

          enhanced.intraday[instId] = {
            ...result,
            adr,
            tradeSetup: calculateTradeSetup(
              result,
              atrEstimate,
              adr,
              currentPrice,
              "intraday"
            ),
          };
        }
      }
    }

    return enhanced;
  }, [ruleBasedResults, batchResults, adrRanks]);

  // Store all results, using ref to prevent infinite loops
  const prevHashRef = useRef("");
  const setBootReady = useMarketStore((s) => s.setBootReady);
  useEffect(() => {
    const hash = Object.values(allResults.intraday)
      .map((r) => `${r.instrument}:${r.overallBias.toFixed(1)}`)
      .join("|");

    if (hash !== prevHashRef.current) {
      prevHashRef.current = hash;
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
