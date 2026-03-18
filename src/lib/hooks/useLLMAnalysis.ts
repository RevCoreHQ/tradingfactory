"use client";

import useSWR from "swr";
import { useMarketStore } from "@/lib/store/market-store";
import { useMarketNews, useFearGreed, useBondYields, useCentralBanks } from "./useMarketData";
import { useTechnicalData } from "./useTechnicalData";
import { REFRESH_INTERVALS, INSTRUMENTS } from "@/lib/utils/constants";
import type { LLMAnalysisResult, LLMAnalysisRequest, LLMBatchResult } from "@/lib/types/llm";
import type { BiasResult } from "@/lib/types/bias";

const postFetcher = async ([url, body]: [string, unknown]) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
};

function buildLLMRequest(
  instrumentId: string,
  category: string,
  newsData: { items?: { headline: string; sentimentLabel: string; sentimentScore: number }[] } | undefined,
  fearGreedData: { current?: { value: number; label: string } } | undefined,
  bondData: { yields?: { maturity: string; yield: number; change: number }[]; dxy?: { value: number; change: number } } | undefined,
  bankData: { banks?: { bank: string; currentRate: number; rateDirection: string; policyStance: string }[] } | undefined,
  indicators: { rsi: { value: number; signal: string }; macd: { histogram: number; crossover: string | null }; trend: { direction: string; strength: number }; bollingerBands: { percentB: number } } | null,
  candles: { close: number }[],
  ruleBasedBias: BiasResult | undefined,
): LLMAnalysisRequest {
  const news = newsData?.items || [];
  const fearGreed = fearGreedData?.current || { value: 50, label: "Neutral" };
  const yields = bondData?.yields || [];
  const dxy = bondData?.dxy || { value: 0, change: 0 };
  const banks = bankData?.banks || [];

  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
  const priceChange24h = candles.length > 1
    ? ((candles[candles.length - 1].close - candles[0].close) / candles[0].close) * 100
    : 0;

  return {
    instrument: instrumentId,
    category,
    currentPrice,
    priceChange24h,
    fearGreed: { value: fearGreed.value, label: fearGreed.label },
    dxy: { value: dxy.value, change: dxy.change },
    bondYields: yields.map((y) => ({ maturity: y.maturity, yield: y.yield, change: y.change })),
    centralBanks: banks.map((b) => ({
      bank: b.bank, rate: b.currentRate, direction: b.rateDirection, stance: b.policyStance,
    })),
    newsHeadlines: news.slice(0, 5).map((n) => ({
      headline: n.headline, sentiment: n.sentimentLabel, score: n.sentimentScore,
    })),
    technicals: indicators ? {
      rsi: indicators.rsi.value,
      rsiSignal: indicators.rsi.signal,
      macdHistogram: indicators.macd.histogram,
      macdCrossover: indicators.macd.crossover,
      trend: indicators.trend.direction,
      trendStrength: indicators.trend.strength,
      bbPercentB: indicators.bollingerBands.percentB,
    } : null,
    ruleBasedScores: ruleBasedBias ? {
      fundamentalTotal: ruleBasedBias.fundamentalScore.total,
      technicalTotal: ruleBasedBias.technicalScore.total,
      overallBias: ruleBasedBias.overallBias,
      direction: ruleBasedBias.direction,
    } : { fundamentalTotal: 50, technicalTotal: 50, overallBias: 0, direction: "neutral" },
  };
}

export function useLLMAnalysis() {
  const instrument = useMarketStore((s) => s.selectedInstrument);
  const storedBias = useMarketStore((s) => s.biasResults[instrument.id]);

  const { data: newsData } = useMarketNews();
  const { data: fearGreedData } = useFearGreed();
  const { data: bondData } = useBondYields();
  const { data: bankData } = useCentralBanks();
  const { indicators, candles } = useTechnicalData();

  const hasData = !!fearGreedData;

  const requestBody = hasData ? buildLLMRequest(
    instrument.id, instrument.category,
    newsData, fearGreedData, bondData, bankData,
    indicators, candles, storedBias,
  ) : null;

  const { data, error, isLoading } = useSWR<{ analysis: LLMAnalysisResult | null }>(
    requestBody ? ["/api/analysis/llm", requestBody] : null,
    postFetcher,
    {
      refreshInterval: REFRESH_INTERVALS.LLM_ANALYSIS,
      revalidateOnFocus: false,
      dedupingInterval: REFRESH_INTERVALS.LLM_ANALYSIS,
    }
  );

  return {
    llmAnalysis: data?.analysis || null,
    isLoading,
    error,
  };
}

export function useLLMBatchAnalysis(allBiasResults: Record<string, BiasResult>) {
  const { data: newsData } = useMarketNews();
  const { data: fearGreedData } = useFearGreed();
  const { data: bondData } = useBondYields();
  const { data: bankData } = useCentralBanks();

  const hasData = !!fearGreedData;

  const requestBody = hasData ? {
    instruments: INSTRUMENTS.map(inst => buildLLMRequest(
      inst.id, inst.category,
      newsData, fearGreedData, bondData, bankData,
      null, [],
      allBiasResults[inst.id],
    )),
  } : null;

  const { data, error, isLoading } = useSWR<{ batch: { results: Record<string, LLMAnalysisResult> } | null }>(
    hasData ? ["/api/analysis/llm-batch", requestBody] : null,
    postFetcher,
    {
      refreshInterval: REFRESH_INTERVALS.LLM_BATCH_ANALYSIS,
      revalidateOnFocus: false,
      dedupingInterval: REFRESH_INTERVALS.LLM_BATCH_ANALYSIS,
    }
  );

  return {
    batchResults: data?.batch?.results || null,
    isLoading,
    isReady: !!data && !isLoading,
    error,
  };
}
