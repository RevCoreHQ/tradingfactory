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
  "15m": "15M",
  "1h": "1H",
  "4h": "4H",
  "1d": "Daily",
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
 * Detect pullback completion: higher TF sets the trend, lower TF flips back.
 *
 * Logic:
 *   1. Daily trend = bullish
 *   2. 15M (or 1H) was mixed/bearish (pullback happening)
 *   3. 15M just flipped back to bullish → pullback is over, entry signal
 *
 * We detect the "flip back" by checking if the lowest-TF EMA stack just
 * re-aligned with the daily direction. Since we don't have history of the
 * stack state, we approximate: if lower TF is aligned AND the mid TFs
 * (1H or 4H) have at least one that's mixed/opposed, it suggests we're
 * coming out of a pullback rather than riding a clean trend.
 */
export function detectPullbackCompletion(
  trends: TimeframeTrend[]
): { complete: boolean; triggerTf: MTFTimeframe | null } {
  const daily = trends.find((t) => t.timeframe === "1d");
  const tf15m = trends.find((t) => t.timeframe === "15m");
  const tf1h = trends.find((t) => t.timeframe === "1h");
  const tf4h = trends.find((t) => t.timeframe === "4h");

  if (!daily || !tf15m) return { complete: false, triggerTf: null };

  // Daily must have a clear direction
  if (daily.direction === "neutral") return { complete: false, triggerTf: null };

  const dailyDir = daily.direction;

  // 15M must be aligned with daily (it just flipped back)
  if (tf15m.direction !== dailyDir) return { complete: false, triggerTf: null };

  // Price must be above EMA9 on 15M (confirming the flip)
  const priceConfirms = dailyDir === "bullish" ? tf15m.priceAboveEma9 : !tf15m.priceAboveEma9;
  if (!priceConfirms) return { complete: false, triggerTf: null };

  // At least one mid-TF (1H or 4H) should be mixed or opposed — indicating
  // this is a recovery from a pullback, not just a full alignment
  const midTfs = [tf1h, tf4h].filter(Boolean) as TimeframeTrend[];
  const hasDiscrepancy = midTfs.some((t) => t.direction !== dailyDir);

  if (hasDiscrepancy) {
    return { complete: true, triggerTf: "15m" };
  }

  // If all TFs are aligned, check if 1H just recently aligned (price barely above EMA9)
  // This is still a valid entry — full alignment is the strongest signal
  if (tf1h && tf1h.direction === dailyDir && tf4h && tf4h.direction === dailyDir) {
    // Full alignment — still valid but mark as complete from 1H perspective
    return { complete: true, triggerTf: "1h" };
  }

  return { complete: false, triggerTf: null };
}

// ==================== MTF Summary ====================

interface MultiCandles {
  candles15m: OHLCV[];
  candles1h: OHLCV[];
  candles4h: OHLCV[];
  candles1d: OHLCV[];
}

/**
 * Calculate complete MTF trend summary for an instrument.
 */
export function calculateMTFTrendSummary(data: MultiCandles): MTFTrendSummary | null {
  const timeframes: { tf: MTFTimeframe; candles: OHLCV[] }[] = [
    { tf: "1d", candles: data.candles1d },
    { tf: "4h", candles: data.candles4h },
    { tf: "1h", candles: data.candles1h },
    { tf: "15m", candles: data.candles15m },
  ];

  const trends: TimeframeTrend[] = [];

  for (const { tf, candles } of timeframes) {
    if (!candles || candles.length < 50) continue;
    const trend = computeEmaStack(candles);
    if (trend) {
      trends.push({ ...trend, timeframe: tf, label: TF_LABELS[tf] });
    }
  }

  // Need at least daily + one lower TF
  if (trends.length < 2) return null;

  const daily = trends.find((t) => t.timeframe === "1d");
  if (!daily) return null;

  const dailyDirection = daily.direction;

  // Count how many TFs agree with daily direction
  const alignedCount = trends.filter((t) => t.direction === dailyDirection).length;

  // Pullback detection
  const pullback = detectPullbackCompletion(trends);

  // Conviction modifier
  let convictionModifier = 0;
  if (dailyDirection === "neutral") {
    convictionModifier = 0;
  } else if (alignedCount === trends.length) {
    convictionModifier = 10; // Full alignment — strongest
  } else if (alignedCount >= trends.length - 1) {
    convictionModifier = 5; // Strong — 3 of 4
  } else if (alignedCount <= 1) {
    convictionModifier = -10; // Against daily — weakest
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
    dailyDirection,
    pullbackComplete: pullback.complete,
    pullbackTimeframe: pullback.triggerTf,
    convictionModifier,
    alignment,
  };
}
