"use client";

import { useMemo } from "react";
import { useMarketStore } from "@/lib/store/market-store";
import { assessPortfolioRisk } from "@/lib/calculations/risk-correlation";
import type { PortfolioRiskAssessment } from "@/lib/types/risk";

export function useRiskCorrelation(): {
  assessment: PortfolioRiskAssessment | null;
} {
  const allBiasResults = useMarketStore((s) => s.allBiasResults);
  const biasTimeframe = useMarketStore((s) => s.biasTimeframe);

  const assessment = useMemo(() => {
    const currentResults = allBiasResults[biasTimeframe];
    if (!currentResults || Object.keys(currentResults).length === 0) return null;
    return assessPortfolioRisk(currentResults);
  }, [allBiasResults, biasTimeframe]);

  return { assessment };
}
