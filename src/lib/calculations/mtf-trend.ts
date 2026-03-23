import type { OHLCV } from "@/lib/types/market";
import type {
  EmaStackState,
  MTFTimeframe,
  TimeframeTrend,
  MTFTrendSummary,
} from "@/lib/types/mtf";
import { calcEMA, calcSMA } from "./technical-indicators";

// ==================== EMA Stack ====================

const TF_LABELS: Record<MTFTimeframe, string> = {
  "5m": "5M",
  "15m": "15M",
  "1h": "1H",
  "4h": "4H",
  "1d": "Daily",
  "1w": "Weekly",
};

/**
 * Compute EMA stack state for a single timeframe.
 * Bullish: EMA9 > EMA21 > EMA50 > SMA200  (price stacked above all MAs)
 * Bearish: EMA9 < EMA21 < EMA50 < SMA200  (price stacked below all MAs)
 * Mixed:   anything else (transition, consolidation)
 */
export function computeEmaStack(candles: OHLCV[]): TimeframeTrend | null {
  if (candles.length < 200) {
    // Fall back to shorter stack if not enough bars for SMA 200
    return computeShortStack(candles);
  }

  const closes = candles.map((c) => c.close);
  const currentPrice = closes[closes.length - 1];

  const ema9Arr = calcEMA(closes, 9);
  const ema21Arr = calcEMA(closes, 21);
  const ema50Arr = calcEMA(closes, 50);
  const sma200Arr = calcSMA(closes, 200);

  if (!ema9Arr.length || !ema21Arr.length || !ema50Arr.length || !sma200Arr.length) {
    return null;
  }

  const ema9 = ema9Arr[ema9Arr.length - 1];
  const ema21 = ema21Arr[ema21Arr.length - 1];
  const ema50 = ema50Arr[ema50Arr.length - 1];
  const sma200 = sma200Arr[sma200Arr.length - 1];

  const stack = classifyStack(ema9, ema21, ema50, sma200);

  return {
    timeframe: "1d", // placeholder — caller sets the actual timeframe
    label: "Daily",
    emaStack: stack,
    ema9,
    ema21,
    ema50,
    sma200,
    priceAboveEma9: currentPrice > ema9,
    direction: stack === "bullish" ? "bullish" : stack === "bearish" ? "bearish" : "neutral",
  };
}

/**
 * For timeframes with < 200 candles, use EMA 9/21/50 only (no SMA 200).
 */
function computeShortStack(candles: OHLCV[]): TimeframeTrend | null {
  if (candles.length < 50) return null;

  const closes = candles.map((c) => c.close);
  const currentPrice = closes[closes.length - 1];

  const ema9Arr = calcEMA(closes, 9);
  const ema21Arr = calcEMA(closes, 21);
  const ema50Arr = calcEMA(closes, 50);

  if (!ema9Arr.length || !ema21Arr.length || !ema50Arr.length) return null;

  const ema9 = ema9Arr[ema9Arr.length - 1];
  const ema21 = ema21Arr[ema21Arr.length - 1];
  const ema50 = ema50Arr[ema50Arr.length - 1];

  // Without SMA 200, use just the 3-EMA ordering
  let stack: EmaStackState = "mixed";
  if (ema9 > ema21 && ema21 > ema50) stack = "bullish";
  else if (ema9 < ema21 && ema21 < ema50) stack = "bearish";

  return {
    timeframe: "1d",
    label: "Daily",
    emaStack: stack,
    ema9,
    ema21,
    ema50,
    sma200: 0, // not available
    priceAboveEma9: currentPrice > ema9,
    direction: stack === "bullish" ? "bullish" : stack === "bearish" ? "bearish" : "neutral",
  };
}

function classifyStack(ema9: number, ema21: number, ema50: number, sma200: number): EmaStackState {
  if (ema9 > ema21 && ema21 > ema50 && ema50 > sma200) return "bullish";
  if (ema9 < ema21 && ema21 < ema50 && ema50 < sma200) return "bearish";
  return "mixed";
}

// ==================== Pullback Detection ====================

/**
 * Detect pullback completion: anchor TF sets the trend, trigger TF flips back.
 *
 * Logic:
 *   1. Anchor TF trend = bullish (e.g. Weekly for swing, 4H for intraday)
 *   2. Trigger TF was mixed/bearish (pullback happening)
 *   3. Trigger TF just flipped back to bullish → pullback is over, entry signal
 *
 * We detect the "flip back" by checking if the trigger-TF EMA stack just
 * re-aligned with the anchor direction. If trigger is aligned AND at least
 * one mid-TF is mixed/opposed, it suggests a pullback recovery.
 */
export function detectPullbackCompletion(
  trends: TimeframeTrend[],
  anchorTf: MTFTimeframe = "1d",
  triggerTf: MTFTimeframe = "15m"
): { complete: boolean; triggerTf: MTFTimeframe | null } {
  const anchor = trends.find((t) => t.timeframe === anchorTf);
  const trigger = trends.find((t) => t.timeframe === triggerTf);

  if (!anchor || !trigger) return { complete: false, triggerTf: null };

  // Anchor must have a clear direction
  if (anchor.direction === "neutral") return { complete: false, triggerTf: null };

  const anchorDir = anchor.direction;

  // Trigger must be aligned with anchor (it just flipped back)
  if (trigger.direction !== anchorDir) return { complete: false, triggerTf: null };

  // Price must confirm on the trigger TF
  const priceConfirms = anchorDir === "bullish" ? trigger.priceAboveEma9 : !trigger.priceAboveEma9;
  if (!priceConfirms) return { complete: false, triggerTf: null };

  // Mid TFs = everything between anchor and trigger
  const midTfs = trends.filter(
    (t) => t.timeframe !== anchorTf && t.timeframe !== triggerTf
  );
  const hasDiscrepancy = midTfs.some((t) => t.direction !== anchorDir);

  if (hasDiscrepancy) {
    return { complete: true, triggerTf };
  }

  // If all TFs are aligned, still valid — mark as complete from first mid-TF
  if (midTfs.length > 0 && midTfs.every((t) => t.direction === anchorDir)) {
    return { complete: true, triggerTf: midTfs[0].timeframe };
  }

  return { complete: false, triggerTf: null };
}

// ==================== MTF Summary ====================

/** Flexible candle map keyed by timeframe — works for any style-specific TF set */
export type CandlesByTimeframe = Partial<Record<MTFTimeframe, OHLCV[]>>;

export interface MTFTrendConfig {
  timeframes: MTFTimeframe[];  // ordered highest → lowest
  anchor: MTFTimeframe;
  trigger: MTFTimeframe;
}

/**
 * Calculate complete MTF trend summary for an instrument.
 * Accepts a flexible candle map and style-specific config.
 */
export function calculateMTFTrendSummary(
  data: CandlesByTimeframe,
  config: MTFTrendConfig
): MTFTrendSummary | null {
  const trends: TimeframeTrend[] = [];

  for (const tf of config.timeframes) {
    const candles = data[tf];
    if (!candles || candles.length < 50) continue;
    const trend = computeEmaStack(candles);
    if (trend) {
      trends.push({ ...trend, timeframe: tf, label: TF_LABELS[tf] });
    }
  }

  // Need at least anchor + one other TF
  if (trends.length < 2) return null;

  const anchor = trends.find((t) => t.timeframe === config.anchor);
  if (!anchor) return null;

  const anchorDirection = anchor.direction;

  // Count how many TFs agree with anchor direction
  const alignedCount = trends.filter((t) => t.direction === anchorDirection).length;

  // Pullback detection
  const pullback = detectPullbackCompletion(trends, config.anchor, config.trigger);

  // Conviction modifier
  let convictionModifier = 0;
  if (anchorDirection === "neutral") {
    convictionModifier = 0;
  } else if (alignedCount === trends.length) {
    convictionModifier = 10; // Full alignment — strongest
  } else if (alignedCount >= trends.length - 1) {
    convictionModifier = 5; // Strong — 3 of 4
  } else if (alignedCount <= 1) {
    convictionModifier = -10; // Against anchor — weakest
  } else {
    convictionModifier = 0; // Partial — no modifier
  }

  // Alignment label
  let alignment: MTFTrendSummary["alignment"];
  if (alignedCount === trends.length) alignment = "full";
  else if (alignedCount >= trends.length - 1) alignment = "strong";
  else if (alignedCount >= 2) alignment = "partial";
  else alignment = "conflicting";

  return {
    trends,
    alignedCount,
    anchorDirection,
    pullbackComplete: pullback.complete,
    pullbackTimeframe: pullback.triggerTf,
    convictionModifier,
    alignment,
  };
}
