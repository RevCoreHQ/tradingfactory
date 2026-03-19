"use client";

import { useMemo } from "react";
import { useMarketStore } from "@/lib/store/market-store";
import { assessPortfolioRisk } from "@/lib/calculations/risk-correlation";
import type { PortfolioRiskAssessment } from "@/lib/types/risk";

export function useRiskCorrelation(): {
  assessment: PortfolioRiskAssessment | null;
} {
  const allBiasResults = useMarketStore((s) => s.allBiasResults);

  const assessment = useMemo(() => {
    const currentResults = allBiasResults.intraday;
    if (!currentResults || Object.keys(currentResults).length === 0) return null;
    return assessPortfolioRisk(currentResults);
  }, [allBiasResults]);

  return { assessment };
}
