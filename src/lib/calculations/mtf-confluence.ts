import type { TechnicalSummary } from "@/lib/types/indicators";
import type { MTFTimeframeResult, MTFConfluenceResult } from "@/lib/types/mtf";
import { calculateTechnicalScore } from "./bias-engine";

const TF_LABELS: Record<string, string> = {
  "5m": "5M",
  "15m": "15M",
  "1h": "1H",
  "4h": "4H",
  "1d": "1D",
  "1w": "1W",
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

// ==================== ENHANCED MTF CONFLUENCE ====================

/**
 * Compute EMA slope strength for a timeframe.
 * Uses EMA(21) rate of change normalized by ATR to be cross-instrument comparable.
 * Returns -3 to +3 (negative = falling, positive = rising).
 */
function computeEmaSlopeStrength(summary: TechnicalSummary): number {
  const ema21 = summary.movingAverages.find((m) => m.type === "EMA" && m.period === 21);
  if (!ema21 || summary.atr.value === 0) return 0;
  // Trend field from summary gives us direction + magnitude proxy
  // Use the bias score as a normalized strength indicator
  const dirSign = summary.trend.direction === "uptrend" ? 1 : summary.trend.direction === "downtrend" ? -1 : 0;
  // Strength from 0-1 based on how far price is from EMA21, normalized by ATR
  const distFromEma = Math.abs(summary.currentPrice - ema21.value) / summary.atr.value;
  return dirSign * Math.min(3, distFromEma);
}

/**
 * Detect overextension: price too far from EMA50 relative to ATR.
 * Returns 0-1 where > 0.7 = overextended (likely to mean-revert).
 */
function computeOverextension(summary: TechnicalSummary): number {
  const ema50 = summary.movingAverages.find((m) => m.type === "EMA" && m.period === 50);
  if (!ema50 || summary.atr.value === 0) return 0;
  const dist = Math.abs(summary.currentPrice - ema50.value) / summary.atr.value;
  // Overextension threshold: > 2.5 ATR from EMA50 is stretched
  return Math.min(1, dist / 3.5);
}

export function calculateMTFConfluence(
  results: MTFTimeframeResult[],
  summaries?: Record<string, TechnicalSummary>,
  tfWeights?: Record<string, number>
): MTFConfluenceResult {
  // Enhanced weighted bias: incorporate EMA slope strength when summaries available.
  // Higher TFs weighted more heavily (daily = 50%), and bias is quality-adjusted
  // by EMA slope strength (strong slope = higher quality alignment).
  let totalWeight = 0;
  let weightedBias = 0;
  let overextensionPenalty = 0;

  for (const r of results) {
    const weights = tfWeights || TF_WEIGHTS;
    const baseWeight = weights[r.timeframe] || (1 / results.length);

    // Quality multiplier: strong EMA slope = more reliable alignment
    let qualityMult = 1.0;
    if (summaries && summaries[r.timeframe]) {
      const slope = computeEmaSlopeStrength(summaries[r.timeframe]);
      // Strong slope (>1.0) = 1.2x quality boost; weak slope (<0.3) = 0.8x penalty
      qualityMult = Math.max(0.8, Math.min(1.2, 0.9 + Math.abs(slope) * 0.3));

      // Check overextension on higher-weight TFs (top 2 by weight)
      if (baseWeight >= 0.25) {
        const overext = computeOverextension(summaries[r.timeframe]);
        if (overext > 0.7) {
          // Overextended: reduce the contribution of this aligned TF
          // because a pullback is likely before continuation
          overextensionPenalty += overext * baseWeight;
        }
      }
    }

    const effectiveWeight = baseWeight * qualityMult;
    weightedBias += r.bias * effectiveWeight;
    totalWeight += effectiveWeight;
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

  // Confidence modifier based on alignment + overextension
  let confidenceModifier = 1.0;
  if (alignmentScore >= 100) confidenceModifier = 1.15;
  else if (alignmentScore >= 66) confidenceModifier = 1.0;
  else confidenceModifier = 0.85;

  // Apply overextension penalty: if higher TFs are overextended,
  // reduce confidence even if alignment is strong. A fully aligned but
  // overextended market is likely to pull back before continuing.
  if (overextensionPenalty > 0.3) {
    confidenceModifier *= Math.max(0.75, 1.0 - overextensionPenalty * 0.3);
  }

  return {
    timeframes: results,
    alignment,
    alignmentScore,
    htfBias,
    confidenceModifier,
  };
}
