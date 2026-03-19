"use client";

import { useEffect, useMemo, useRef } from "react";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { useMarketStore } from "@/lib/store/market-store";
import { useMarketNews, useFearGreed, useBondYields, useCentralBanks } from "./useMarketData";
import { useLLMBatchAnalysis } from "./useLLMAnalysis";
import { useADRData } from "./useADRData";
import { calculateFundamentalScore, calculateOverallBias, applyLLMAnalysis } from "@/lib/calculations/bias-engine";
import { computeADRRanks, calculateTradeSetup } from "@/lib/calculations/trade-setup";

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
  const setAllBiasResults = useMarketStore((s) => s.setAllBiasResults);
  const setBatchLLMResults = useMarketStore((s) => s.setBatchLLMResults);
  const setBatchLLMReady = useMarketStore((s) => s.setBatchLLMReady);
  const setBatchLLMError = useMarketStore((s) => s.setBatchLLMError);

  const { data: newsData } = useMarketNews();
  const { data: fearGreedData } = useFearGreed();
  const { data: bondData } = useBondYields();
  const { data: bankData } = useCentralBanks();
  const { adrData } = useADRData();

  const ruleBasedResults = useMemo(() => {
    const news = newsData?.items || [];
    const fearGreed = fearGreedData?.current || DEFAULT_FEAR_GREED;
    const yields = bondData?.yields || [];
    const dxy = bondData?.dxy || DEFAULT_DXY;
    const banks = bankData?.banks || [];

    const intradayResults: Record<string, ReturnType<typeof calculateOverallBias>> = {};
    const intraweekResults: Record<string, ReturnType<typeof calculateOverallBias>> = {};

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

      intradayResults[inst.id] = calculateOverallBias(
        fundamentalScore,
        DEFAULT_TECHNICAL_SCORE,
        "intraday",
        inst.id
      );
      intraweekResults[inst.id] = calculateOverallBias(
        fundamentalScore,
        DEFAULT_TECHNICAL_SCORE,
        "intraweek",
        inst.id
      );
    }

    return { intraday: intradayResults, intraweek: intraweekResults };
  }, [newsData, fearGreedData, bondData, bankData]);

  // Fetch LLM batch analysis using current timeframe results
  const currentTimeframeResults = biasTimeframe === "intraday" ? ruleBasedResults.intraday : ruleBasedResults.intraweek;
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
      intraweek: { ...ruleBasedResults.intraweek },
    };

    // Apply LLM analysis
    if (batchResults) {
      for (const [instrumentId, llmResult] of Object.entries(batchResults)) {
        if (enhanced.intraday[instrumentId]) {
          enhanced.intraday[instrumentId] = applyLLMAnalysis(enhanced.intraday[instrumentId], llmResult);
        }
        if (enhanced.intraweek[instrumentId]) {
          enhanced.intraweek[instrumentId] = applyLLMAnalysis(enhanced.intraweek[instrumentId], llmResult);
        }
      }
    }

    // Attach ADR + trade setup to each result
    if (adrRanks) {
      for (const timeframeKey of ["intraday", "intraweek"] as const) {
        for (const [instId, result] of Object.entries(enhanced[timeframeKey])) {
          const adr = adrRanks[instId];
          if (adr) {
            const inst = INSTRUMENTS.find((i) => i.id === instId);
            const pipSize = inst?.pipSize || 0.0001;
            // Use ADR as a proxy for ATR on homepage (no per-instrument candle data here)
            const atrEstimate = adr.pips * pipSize;
            // Get current price from the bias result's fundamental context (approximate)
            const currentPrice = atrEstimate / (adr.percent / 100) || 1;

            enhanced[timeframeKey][instId] = {
              ...result,
              adr,
              tradeSetup: calculateTradeSetup(
                result,
                atrEstimate,
                adr,
                currentPrice,
                timeframeKey
              ),
            };
          }
        }
      }
    }

    return enhanced;
  }, [ruleBasedResults, batchResults, adrRanks]);

  // Store all results, using ref to prevent infinite loops
  const prevHashRef = useRef("");
  useEffect(() => {
    const intradayHash = Object.values(allResults.intraday)
      .map((r) => `${r.instrument}:${r.overallBias.toFixed(1)}`)
      .join("|");
    const intraweekHash = Object.values(allResults.intraweek)
      .map((r) => `${r.instrument}:${r.overallBias.toFixed(1)}`)
      .join("|");
    const hash = `${intradayHash}||${intraweekHash}`;

    if (hash !== prevHashRef.current) {
      prevHashRef.current = hash;
      setAllBiasResults("intraday", allResults.intraday);
      setAllBiasResults("intraweek", allResults.intraweek);
      const currentResults = biasTimeframe === "intraday" ? allResults.intraday : allResults.intraweek;
      for (const [id, result] of Object.entries(currentResults)) {
        setBiasResult(id, result);
      }
    }
    // Always update batch LLM state regardless of hash — batch results can
    // arrive without changing the bias hash (e.g. small adjustments rounded away)
    setBatchLLMResults(batchResults);
    if (llmReady) setBatchLLMReady(true);
    if (llmApiError) setBatchLLMError(llmApiError);
  }, [allResults, batchResults, llmReady, llmApiError, setBiasResult, setAllBiasResults, setBatchLLMResults, setBatchLLMReady, setBatchLLMError, biasTimeframe]);

  return allResults;
}
