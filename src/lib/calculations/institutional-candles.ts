import type { OHLCV } from "@/lib/types/market";
import type { InstitutionalCandle, ConsolidationBreakout } from "@/lib/types/deep-analysis";

const MIN_INSTITUTIONAL_BODY_ATR = 2.0;
const MAX_INSTITUTIONAL = 5;
const CONSOLIDATION_ATR_THRESHOLD = 1.5;
const MIN_CONSOLIDATION_BARS = 5;
const SWING_LOOKBACK = 20;
const MAX_BREAKOUTS = 5;

/**
 * Detect institutional candles — large-body displacement candles that indicate
 * smart money activity. These candles often create FVGs and break market structure.
 */
export function detectInstitutionalCandles(
  candles: OHLCV[],
  atrValue: number
): InstitutionalCandle[] {
  if (candles.length < 5 || atrValue <= 0) return [];

  const results: InstitutionalCandle[] = [];

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const body = Math.abs(c.close - c.open);
    const bodyATR = body / atrValue;

    if (bodyATR < MIN_INSTITUTIONAL_BODY_ATR) continue;

    const type: "bullish" | "bearish" = c.close > c.open ? "bullish" : "bearish";

    // Check if this candle created an FVG (look at i-1, i, i+1 pattern)
    const createdFVG = checkCreatedFVG(candles, i);

    // Check if it broke a recent swing high/low
    const brokeStructure = checkBrokeStructure(candles, i, type);

    // Displacement score
    const range = c.high - c.low;
    const wickRatio = range > 0 ? body / range : 0; // higher = more impulsive (less wicks)

    const displacementScore = Math.min(100, Math.round(
      Math.min(100, (bodyATR / 4) * 100) * 0.40 +
      (createdFVG ? 100 : 0) * 0.25 +
      (brokeStructure ? 100 : 0) * 0.20 +
      Math.min(100, wickRatio * 100) * 0.15
    ));

    results.push({
      type,
      candleIndex: i,
      timestamp: c.timestamp,
      open: c.open,
      close: c.close,
      high: c.high,
      low: c.low,
      bodyATR,
      createdFVG,
      brokeStructure,
      displacementScore,
    });
  }

  // Return the most recent N, sorted by displacement score
  return results
    .sort((a, b) => b.displacementScore - a.displacementScore)
    .slice(0, MAX_INSTITUTIONAL);
}

/**
 * Check if an institutional candle created an FVG at its position.
 */
function checkCreatedFVG(candles: OHLCV[], index: number): boolean {
  if (index < 1 || index >= candles.length - 1) return false;

  const c0 = candles[index - 1];
  const c2 = candles[index + 1];

  // Bullish FVG: c0.high < c2.low
  if (c0.high < c2.low) return true;
  // Bearish FVG: c0.low > c2.high
  if (c0.low > c2.high) return true;

  return false;
}

/**
 * Check if a candle broke a recent swing high or low.
 */
function checkBrokeStructure(
  candles: OHLCV[],
  index: number,
  type: "bullish" | "bearish"
): boolean {
  const lookbackStart = Math.max(0, index - SWING_LOOKBACK);
  const c = candles[index];

  if (type === "bullish") {
    // Find highest high in lookback (excluding current candle)
    let swingHigh = -Infinity;
    for (let j = lookbackStart; j < index; j++) {
      if (candles[j].high > swingHigh) swingHigh = candles[j].high;
    }
    return c.close > swingHigh && swingHigh > -Infinity;
  } else {
    // Find lowest low in lookback
    let swingLow = Infinity;
    for (let j = lookbackStart; j < index; j++) {
      if (candles[j].low < swingLow) swingLow = candles[j].low;
    }
    return c.close < swingLow && swingLow < Infinity;
  }
}

/**
 * Detect consolidation zones that preceded institutional breakout candles.
 * A consolidation is a tight price range (< threshold × ATR) over multiple bars.
 */
export function detectConsolidationBreakouts(
  candles: OHLCV[],
  atrValue: number,
  institutionalCandles: InstitutionalCandle[]
): ConsolidationBreakout[] {
  if (candles.length < 10 || atrValue <= 0) return [];

  const results: ConsolidationBreakout[] = [];

  for (const ic of institutionalCandles) {
    const breakoutIndex = ic.candleIndex;
    if (breakoutIndex < MIN_CONSOLIDATION_BARS) continue;

    // Scan backward from the candle before the breakout to find consolidation
    const consolidation = findConsolidation(candles, breakoutIndex - 1, atrValue);
    if (!consolidation) continue;

    // Check if price has retested the consolidation zone after breakout
    const retested = checkRetest(
      candles,
      breakoutIndex,
      consolidation.rangeLow,
      consolidation.rangeHigh
    );

    // Score
    const tightnessScore = Math.min(100, (1 - consolidation.rangeATR / CONSOLIDATION_ATR_THRESHOLD) * 100);
    const barScore = Math.min(100, (consolidation.barCount / 20) * 100);
    const retestScore = retested ? 40 : 80; // Fresh (not retested) = stronger

    const strength = Math.min(100, Math.round(
      Math.max(0, tightnessScore) * 0.30 +
      ic.displacementScore * 0.30 +
      barScore * 0.20 +
      retestScore * 0.20
    ));

    results.push({
      rangeHigh: consolidation.rangeHigh,
      rangeLow: consolidation.rangeLow,
      startIndex: consolidation.startIndex,
      endIndex: breakoutIndex,
      barCount: consolidation.barCount,
      rangeATR: consolidation.rangeATR,
      breakoutDirection: ic.type,
      breakoutCandle: ic,
      retestZoneHigh: consolidation.rangeHigh,
      retestZoneLow: consolidation.rangeLow,
      retested,
      strength,
    });
  }

  return results
    .sort((a, b) => b.strength - a.strength)
    .slice(0, MAX_BREAKOUTS);
}

/**
 * Find a consolidation zone ending at the given index.
 * Scans backward expanding the window until the range exceeds the threshold.
 */
function findConsolidation(
  candles: OHLCV[],
  endIndex: number,
  atrValue: number
): { rangeHigh: number; rangeLow: number; startIndex: number; barCount: number; rangeATR: number } | null {
  let high = candles[endIndex].high;
  let low = candles[endIndex].low;
  let startIndex = endIndex;

  for (let i = endIndex - 1; i >= Math.max(0, endIndex - 50); i--) {
    const candidateHigh = Math.max(high, candles[i].high);
    const candidateLow = Math.min(low, candles[i].low);
    const range = candidateHigh - candidateLow;

    if (range > CONSOLIDATION_ATR_THRESHOLD * atrValue) break;

    high = candidateHigh;
    low = candidateLow;
    startIndex = i;
  }

  const barCount = endIndex - startIndex + 1;
  if (barCount < MIN_CONSOLIDATION_BARS) return null;

  return {
    rangeHigh: high,
    rangeLow: low,
    startIndex,
    barCount,
    rangeATR: (high - low) / atrValue,
  };
}

/**
 * Check if price has returned to the consolidation zone after the breakout.
 */
function checkRetest(
  candles: OHLCV[],
  breakoutIndex: number,
  zoneLow: number,
  zoneHigh: number
): boolean {
  for (let k = breakoutIndex + 1; k < candles.length; k++) {
    const c = candles[k];
    if (c.low <= zoneHigh && c.high >= zoneLow) return true;
  }
  return false;
}
