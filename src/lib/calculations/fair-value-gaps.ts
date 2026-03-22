import type { OHLCV } from "@/lib/types/market";
import type { FairValueGap } from "@/lib/types/deep-analysis";

const MAX_FVGS = 10;
const MIN_FVG_ATR = 0.3; // minimum gap size as ATR multiple
const FILL_THRESHOLD = 0.75; // 75% fill = considered fully filled

/**
 * Detect Fair Value Gaps (3-candle imbalance patterns).
 *
 * Bullish FVG: candle[i-2].high < candle[i].low  (gap where price skipped)
 * Bearish FVG: candle[i-2].low > candle[i].high
 *
 * Price tends to return to fill these gaps — the midpoint (Consequent Encroachment)
 * acts as a magnet for institutional order flow.
 */
export function detectFairValueGaps(
  candles: OHLCV[],
  atrValue: number
): FairValueGap[] {
  if (candles.length < 5 || atrValue <= 0) return [];

  const raw: FairValueGap[] = [];

  for (let i = 2; i < candles.length; i++) {
    const c0 = candles[i - 2];
    const c1 = candles[i - 1]; // impulse candle
    const c2 = candles[i];

    // Bullish FVG: gap between candle 0's high and candle 2's low
    if (c0.high < c2.low) {
      const gapSize = c2.low - c0.high;
      const sizeATR = gapSize / atrValue;

      if (sizeATR >= MIN_FVG_ATR) {
        const gapHigh = c2.low;
        const gapLow = c0.high;
        const { fillPercent, freshness } = checkFVGFill(candles, i, gapLow, gapHigh, "bullish");

        raw.push({
          type: "bullish",
          high: gapHigh,
          low: gapLow,
          midpoint: (gapHigh + gapLow) / 2,
          candleIndex: i - 1,
          timestamp: c1.timestamp,
          size: gapSize,
          sizeATR,
          fillPercent,
          freshness,
          strength: 0,
        });
      }
    }

    // Bearish FVG: gap between candle 2's high and candle 0's low
    if (c0.low > c2.high) {
      const gapSize = c0.low - c2.high;
      const sizeATR = gapSize / atrValue;

      if (sizeATR >= MIN_FVG_ATR) {
        const gapHigh = c0.low;
        const gapLow = c2.high;
        const { fillPercent, freshness } = checkFVGFill(candles, i, gapLow, gapHigh, "bearish");

        raw.push({
          type: "bearish",
          high: gapHigh,
          low: gapLow,
          midpoint: (gapHigh + gapLow) / 2,
          candleIndex: i - 1,
          timestamp: c1.timestamp,
          size: gapSize,
          sizeATR,
          fillPercent,
          freshness,
          strength: 0,
        });
      }
    }
  }

  return scoreAndFilterFVGs(raw, candles.length);
}

/**
 * Check how much of an FVG has been filled by subsequent price action.
 */
function checkFVGFill(
  candles: OHLCV[],
  formationIndex: number,
  gapLow: number,
  gapHigh: number,
  type: "bullish" | "bearish"
): { fillPercent: number; freshness: "fresh" | "tested" | "filled" } {
  const gapSize = gapHigh - gapLow;
  if (gapSize <= 0) return { fillPercent: 0, freshness: "fresh" };

  let maxPenetration = 0;

  for (let k = formationIndex + 1; k < candles.length; k++) {
    const c = candles[k];

    if (type === "bullish") {
      // For bullish FVG, price filling means coming down into the gap
      if (c.low < gapHigh) {
        const penetration = gapHigh - Math.max(c.low, gapLow);
        maxPenetration = Math.max(maxPenetration, penetration);
      }
    } else {
      // For bearish FVG, price filling means rising up into the gap
      if (c.high > gapLow) {
        const penetration = Math.min(c.high, gapHigh) - gapLow;
        maxPenetration = Math.max(maxPenetration, penetration);
      }
    }
  }

  const fillPercent = Math.min(100, (maxPenetration / gapSize) * 100);
  const freshness =
    fillPercent === 0 ? "fresh" :
    fillPercent >= FILL_THRESHOLD * 100 ? "filled" :
    "tested";

  return { fillPercent, freshness };
}

/**
 * Score FVGs, filter out fully filled ones, deduplicate overlapping, return top N.
 */
function scoreAndFilterFVGs(
  fvgs: FairValueGap[],
  totalCandles: number
): FairValueGap[] {
  // Remove fully filled FVGs
  const valid = fvgs.filter((f) => f.freshness !== "filled");

  // Deduplicate overlapping FVGs (keep stronger)
  const deduped: FairValueGap[] = [];
  for (const fvg of valid) {
    const overlap = deduped.findIndex(
      (d) => d.low < fvg.high && d.high > fvg.low && d.type === fvg.type
    );
    if (overlap >= 0) {
      if (fvg.sizeATR > deduped[overlap].sizeATR) {
        deduped[overlap] = fvg;
      }
    } else {
      deduped.push(fvg);
    }
  }

  // Score each FVG
  for (const fvg of deduped) {
    // Size score: larger gaps = stronger (capped at 4x ATR)
    const sizeScore = Math.min(100, (fvg.sizeATR / 2) * 100);

    // Freshness score: unfilled = strong, partially filled = weaker
    const freshnessScore = fvg.freshness === "fresh"
      ? 100
      : Math.max(30, 80 - fvg.fillPercent);

    // Recency score: more recent = stronger
    const recencyScore = totalCandles > 0
      ? 100 * (fvg.candleIndex / totalCandles)
      : 50;

    // Impulse context: middle candle body size relative to ATR (bigger body = stronger impulse)
    const impulseScore = Math.min(100, fvg.sizeATR * 60);

    fvg.strength = Math.round(
      sizeScore * 0.35 +
      freshnessScore * 0.30 +
      recencyScore * 0.20 +
      impulseScore * 0.15
    );
  }

  return deduped
    .sort((a, b) => b.strength - a.strength)
    .slice(0, MAX_FVGS);
}
