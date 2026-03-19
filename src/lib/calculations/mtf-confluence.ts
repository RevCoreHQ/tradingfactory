import type { TechnicalSummary } from "@/lib/types/indicators";
import type { MTFTimeframeResult, MTFConfluenceResult } from "@/lib/types/mtf";
import { calculateTechnicalScore } from "./bias-engine";

const TF_LABELS: Record<string, string> = {
  "1h": "1H",
  "4h": "4H",
  "1d": "1D",
};

const TF_WEIGHTS: Record<string, number> = {
  "1h": 0.2,
  "4h": 0.3,
  "1d": 0.5,
};

export function computeMTFTimeframeResult(
  summary: TechnicalSummary,
  currentPrice: number,
  timeframe: string
): MTFTimeframeResult {
  const techResult = calculateTechnicalScore(summary, currentPrice);
  // Map 0-100 score to -100..+100 bias
  const bias = (techResult.score.total - 50) * 2;

  return {
    timeframe,
    label: TF_LABELS[timeframe] || timeframe.toUpperCase(),
    technicalScore: techResult.score.total,
    trendDirection: summary.trend.direction,
    rsi: summary.rsi.value,
    macdCrossover: summary.macd.crossover,
    bias,
  };
}

export function calculateMTFConfluence(
  results: MTFTimeframeResult[]
): MTFConfluenceResult {
  // Weighted bias from all timeframes
  let totalWeight = 0;
  let weightedBias = 0;
  for (const r of results) {
    const w = TF_WEIGHTS[r.timeframe] || 0.33;
    weightedBias += r.bias * w;
    totalWeight += w;
  }
  const htfBias = totalWeight > 0 ? weightedBias / totalWeight : 0;

  // Determine alignment
  const bullish = results.filter((r) => r.bias > 10);
  const bearish = results.filter((r) => r.bias < -10);
  const total = results.length;

  let alignment: MTFConfluenceResult["alignment"] = "mixed";
  let alignmentScore = 33;

  if (bullish.length === total) {
    alignment = "aligned_bullish";
    alignmentScore = 100;
  } else if (bearish.length === total) {
    alignment = "aligned_bearish";
    alignmentScore = 100;
  } else if (bullish.length >= total - 1 && bearish.length === 0) {
    alignment = "aligned_bullish";
    alignmentScore = 66;
  } else if (bearish.length >= total - 1 && bullish.length === 0) {
    alignment = "aligned_bearish";
    alignmentScore = 66;
  }

  // Confidence modifier based on alignment
  let confidenceModifier = 1.0;
  if (alignmentScore >= 100) confidenceModifier = 1.15;
  else if (alignmentScore >= 66) confidenceModifier = 1.0;
  else confidenceModifier = 0.85;

  return {
    timeframes: results,
    alignment,
    alignmentScore,
    htfBias,
    confidenceModifier,
  };
}
