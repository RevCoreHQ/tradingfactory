"use client";

import { useEffect, useMemo } from "react";
import { useMarketStore } from "@/lib/store/market-store";
import { useMarketNews, useFearGreed, useBondYields, useCentralBanks } from "./useMarketData";
import { useTechnicalData } from "./useTechnicalData";
import { calculateFundamentalScore, calculateTechnicalScore, calculateOverallBias } from "@/lib/calculations/bias-engine";

export function useBiasScore() {
  const instrument = useMarketStore((s) => s.selectedInstrument);
  const biasTimeframe = useMarketStore((s) => s.biasTimeframe);
  const setBiasResult = useMarketStore((s) => s.setBiasResult);
  const storedBias = useMarketStore((s) => s.biasResults[instrument.id]);

  const { data: newsData } = useMarketNews();
  const { data: fearGreedData } = useFearGreed();
  const { data: bondData } = useBondYields();
  const { data: bankData } = useCentralBanks();
  const { indicators, candles } = useTechnicalData();

  const biasResult = useMemo(() => {
    const news = newsData?.items || [];
    const fearGreed = fearGreedData?.current || { value: 50, label: "Neutral", timestamp: 0, previousClose: 50, previousWeek: 50, previousMonth: 50 };
    const yields = bondData?.yields || [];
    const dxy = bondData?.dxy || { value: 0, change: 0, changePercent: 0, history: [] };
    const banks = bankData?.banks || [];

    const fundamentalScore = calculateFundamentalScore(
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
    const technicalScore = indicators
      ? calculateTechnicalScore(indicators, currentPrice)
      : {
          total: 50,
          trendDirection: 50,
          momentum: 50,
          volatility: 50,
          volumeAnalysis: 50,
          supportResistance: 50,
        };

    return calculateOverallBias(fundamentalScore, technicalScore, biasTimeframe, instrument.id);
  }, [newsData, fearGreedData, bondData, bankData, indicators, candles, instrument.id, biasTimeframe]);

  useEffect(() => {
    if (biasResult) {
      setBiasResult(instrument.id, biasResult);
    }
  }, [biasResult, instrument.id, setBiasResult]);

  return { biasResult: biasResult || storedBias, isCalculating: !biasResult };
}
