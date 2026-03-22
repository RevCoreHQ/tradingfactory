import type { OHLCV } from "@/lib/types/market";
import type { FairValueGap, SupplyDemandZone } from "@/lib/types/deep-analysis";

// ==================== TYPES ====================

export interface EntrySignal {
  type: EntryPatternType;
  direction: "bullish" | "bearish";
  quality: number; // 0-100
  description: string;
  candleIndex: number;
}

export type EntryPatternType =
  | "hammer"
  | "inverted_hammer"
  | "engulfing"
  | "pin_bar"
  | "inside_bar"
  | "pullback_to_ema"
  | "fvg_reentry"
  | "order_block_retest";

export interface EntryOptimization {
  signals: EntrySignal[];
  bestSignal: EntrySignal | null;
  entryScore: number; // 0-100 composite
  refinedEntry: [number, number] | null;
  isPullback: boolean;
  pullbackDepth: number; // 0-1 (0 = no pullback, 0.5 = 50% retracement)
}

// ==================== CANDLE PATTERN DETECTION ====================

function bodySize(candle: OHLCV): number {
  return Math.abs(candle.close - candle.open);
}

function candleRange(candle: OHLCV): number {
  return candle.high - candle.low;
}

function upperWick(candle: OHLCV): number {
  return candle.high - Math.max(candle.open, candle.close);
}

function lowerWick(candle: OHLCV): number {
  return Math.min(candle.open, candle.close) - candle.low;
}

function isBullish(candle: OHLCV): boolean {
  return candle.close > candle.open;
}

function detectHammer(candles: OHLCV[]): EntrySignal | null {
  if (candles.length < 3) return null;
  const c = candles[candles.length - 1];
  const range = candleRange(c);
  if (range === 0) return null;

  const body = bodySize(c);
  const lw = lowerWick(c);
  const uw = upperWick(c);

  // Hammer: small body at top, long lower wick (>= 2x body), small upper wick
  if (lw >= body * 2 && uw < body * 0.5 && body / range < 0.35) {
    // Context: should appear after a decline
    const prev2 = candles.slice(-4, -1);
    const declining = prev2.every((p, i) => i === 0 || p.close <= prev2[i - 1].close);

    if (declining || candles[candles.length - 2].close < candles[candles.length - 3].close) {
      return {
        type: "hammer",
        direction: "bullish",
        quality: Math.min(90, Math.round(50 + (lw / range) * 40)),
        description: `Hammer candle — lower wick ${((lw / range) * 100).toFixed(0)}% of range`,
        candleIndex: candles.length - 1,
      };
    }
  }

  // Inverted hammer (shooting star context = bearish)
  if (uw >= body * 2 && lw < body * 0.5 && body / range < 0.35) {
    const prev2 = candles.slice(-4, -1);
    const rising = prev2.every((p, i) => i === 0 || p.close >= prev2[i - 1].close);

    if (rising || candles[candles.length - 2].close > candles[candles.length - 3].close) {
      return {
        type: "inverted_hammer",
        direction: "bearish",
        quality: Math.min(90, Math.round(50 + (uw / range) * 40)),
        description: `Shooting star — upper wick ${((uw / range) * 100).toFixed(0)}% of range`,
        candleIndex: candles.length - 1,
      };
    }
  }

  return null;
}

function detectEngulfing(candles: OHLCV[]): EntrySignal | null {
  if (candles.length < 2) return null;
  const curr = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  const currBody = bodySize(curr);
  const prevBody = bodySize(prev);
  if (prevBody === 0 || currBody === 0) return null;

  // Bullish engulfing: prev bearish, curr bullish, curr body engulfs prev body
  if (
    !isBullish(prev) &&
    isBullish(curr) &&
    curr.open <= prev.close &&
    curr.close >= prev.open &&
    currBody > prevBody * 1.2
  ) {
    return {
      type: "engulfing",
      direction: "bullish",
      quality: Math.min(95, Math.round(60 + (currBody / prevBody) * 15)),
      description: `Bullish engulfing — body ${(currBody / prevBody).toFixed(1)}x previous`,
      candleIndex: candles.length - 1,
    };
  }

  // Bearish engulfing
  if (
    isBullish(prev) &&
    !isBullish(curr) &&
    curr.open >= prev.close &&
    curr.close <= prev.open &&
    currBody > prevBody * 1.2
  ) {
    return {
      type: "engulfing",
      direction: "bearish",
      quality: Math.min(95, Math.round(60 + (currBody / prevBody) * 15)),
      description: `Bearish engulfing — body ${(currBody / prevBody).toFixed(1)}x previous`,
      candleIndex: candles.length - 1,
    };
  }

  return null;
}

function detectPinBar(candles: OHLCV[]): EntrySignal | null {
  if (candles.length < 1) return null;
  const c = candles[candles.length - 1];
  const range = candleRange(c);
  if (range === 0) return null;

  const body = bodySize(c);
  const lw = lowerWick(c);
  const uw = upperWick(c);

  // Pin bar: very small body (< 20% of range), one wick >= 60% of range
  if (body / range > 0.2) return null;

  if (lw / range >= 0.6) {
    return {
      type: "pin_bar",
      direction: "bullish",
      quality: Math.min(90, Math.round(55 + (lw / range) * 35)),
      description: `Bullish pin bar — tail ${((lw / range) * 100).toFixed(0)}% of range`,
      candleIndex: candles.length - 1,
    };
  }

  if (uw / range >= 0.6) {
    return {
      type: "pin_bar",
      direction: "bearish",
      quality: Math.min(90, Math.round(55 + (uw / range) * 35)),
      description: `Bearish pin bar — tail ${((uw / range) * 100).toFixed(0)}% of range`,
      candleIndex: candles.length - 1,
    };
  }

  return null;
}

function detectInsideBar(candles: OHLCV[]): EntrySignal | null {
  if (candles.length < 2) return null;
  const curr = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  // Inside bar: current bar's range is entirely within previous bar's range
  if (curr.high <= prev.high && curr.low >= prev.low) {
    // Direction: if inside bar closes bullish, lean bullish (breakout anticipation)
    const dir = isBullish(curr) ? "bullish" : "bearish";
    const compression = 1 - candleRange(curr) / candleRange(prev);

    return {
      type: "inside_bar",
      direction: dir,
      quality: Math.min(80, Math.round(40 + compression * 40)),
      description: `Inside bar — ${(compression * 100).toFixed(0)}% compression`,
      candleIndex: candles.length - 1,
    };
  }

  return null;
}

// ==================== PULLBACK DETECTION ====================

/**
 * Detect pullback to EMA(21) within a trending move.
 * Returns depth 0-1 (0 = at EMA, 1 = fully retraced the move).
 */
function detectPullback(
  candles: OHLCV[],
  direction: "bullish" | "bearish",
  atr: number
): { isPullback: boolean; depth: number; signal: EntrySignal | null } {
  if (candles.length < 22) return { isPullback: false, depth: 0, signal: null };

  // Calculate EMA(21)
  const closes = candles.map((c) => c.close);
  let ema = closes.slice(0, 21).reduce((a, b) => a + b, 0) / 21;
  const k = 2 / (21 + 1);
  for (let i = 21; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }

  const price = candles[candles.length - 1].close;
  const distToEma = Math.abs(price - ema);
  const nearEma = distToEma < atr * 0.5;

  if (!nearEma) return { isPullback: false, depth: 0, signal: null };

  // Find the recent swing extreme (last 10 bars)
  const recent = candles.slice(-10);
  const recentHigh = Math.max(...recent.map((c) => c.high));
  const recentLow = Math.min(...recent.map((c) => c.low));
  const moveRange = recentHigh - recentLow;

  if (moveRange === 0) return { isPullback: false, depth: 0, signal: null };

  let depth: number;
  let isPullback: boolean;

  if (direction === "bullish") {
    // Bullish pullback: price came down from recentHigh toward EMA
    depth = (recentHigh - price) / moveRange;
    isPullback = price > ema && depth >= 0.3 && depth <= 0.7;
  } else {
    // Bearish pullback: price came up from recentLow toward EMA
    depth = (price - recentLow) / moveRange;
    isPullback = price < ema && depth >= 0.3 && depth <= 0.7;
  }

  if (!isPullback) return { isPullback: false, depth: 0, signal: null };

  return {
    isPullback: true,
    depth,
    signal: {
      type: "pullback_to_ema",
      direction,
      quality: Math.min(85, Math.round(50 + (1 - Math.abs(depth - 0.5) * 2) * 35)),
      description: `${((depth * 100)).toFixed(0)}% pullback to EMA(21) — optimal entry zone`,
      candleIndex: candles.length - 1,
    },
  };
}

// ==================== ICT ENTRY PATTERNS ====================

/**
 * Detect price entering a fresh/tested Fair Value Gap aligned with direction.
 */
function detectFVGReentry(
  candles: OHLCV[],
  direction: "bullish" | "bearish",
  fairValueGaps: FairValueGap[]
): EntrySignal | null {
  if (candles.length < 2 || fairValueGaps.length === 0) return null;

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  for (const fvg of fairValueGaps) {
    if (fvg.freshness === "filled") continue;
    // Must align: bullish FVG for bullish direction, bearish for bearish
    if (fvg.type !== direction) continue;

    // Check if the last candle entered the FVG zone
    const entered = last.low <= fvg.high && last.high >= fvg.low;
    // Previous candle should have been outside (confirming this is a new entry)
    const wasOutside = direction === "bullish"
      ? prev.low > fvg.high
      : prev.high < fvg.low;

    if (entered && wasOutside) {
      const quality = Math.min(85, Math.round(45 + fvg.strength * 0.4));
      return {
        type: "fvg_reentry",
        direction,
        quality,
        description: `Price entered ${fvg.freshness} ${direction} FVG (CE: ${fvg.midpoint.toFixed(4)})`,
        candleIndex: candles.length - 1,
      };
    }
  }

  return null;
}

/**
 * Detect price testing a fresh Order Block with rejection wick.
 */
function detectOrderBlockRetest(
  candles: OHLCV[],
  direction: "bullish" | "bearish",
  zones: SupplyDemandZone[]
): EntrySignal | null {
  if (candles.length < 2 || zones.length === 0) return null;

  const last = candles[candles.length - 1];

  for (const zone of zones) {
    if (!zone.isOrderBlock || zone.freshness === "broken") continue;
    // Demand OB for bullish, Supply OB for bearish
    if (direction === "bullish" && zone.type !== "demand") continue;
    if (direction === "bearish" && zone.type !== "supply") continue;

    // Check if the candle wicked into the OB zone but closed outside
    const wickedIn = last.low <= zone.priceHigh && last.high >= zone.priceLow;
    const rejection = direction === "bullish"
      ? last.close > zone.priceHigh // Wick into demand OB, closed above
      : last.close < zone.priceLow; // Wick into supply OB, closed below

    if (wickedIn && rejection) {
      const quality = Math.min(85, Math.round(50 + zone.strength * 0.35));
      return {
        type: "order_block_retest",
        direction,
        quality,
        description: `${zone.freshness} ${zone.type} Order Block retest with rejection`,
        candleIndex: candles.length - 1,
      };
    }
  }

  return null;
}

// ==================== MASTER FUNCTION ====================

/**
 * Analyze candles for entry optimization signals.
 * Returns candle patterns + pullback detection + ICT patterns + refined entry zone.
 */
export function analyzeEntryOptimization(
  candles: OHLCV[],
  direction: "bullish" | "bearish" | "neutral",
  atr: number,
  currentEntry: [number, number],
  fairValueGaps?: FairValueGap[],
  supplyDemandZones?: SupplyDemandZone[]
): EntryOptimization {
  if (direction === "neutral" || candles.length < 5) {
    return {
      signals: [],
      bestSignal: null,
      entryScore: 0,
      refinedEntry: null,
      isPullback: false,
      pullbackDepth: 0,
    };
  }

  const signals: EntrySignal[] = [];

  // Detect candle patterns
  const hammer = detectHammer(candles);
  if (hammer && hammer.direction === direction) signals.push(hammer);

  const engulfing = detectEngulfing(candles);
  if (engulfing && engulfing.direction === direction) signals.push(engulfing);

  const pinBar = detectPinBar(candles);
  if (pinBar && pinBar.direction === direction) signals.push(pinBar);

  const insideBar = detectInsideBar(candles);
  if (insideBar) signals.push(insideBar); // Inside bar is directionally ambiguous, include it

  // Detect pullback
  const pullback = detectPullback(candles, direction, atr);
  if (pullback.signal) signals.push(pullback.signal);

  // ICT entry patterns
  if (fairValueGaps && fairValueGaps.length > 0) {
    const fvgSignal = detectFVGReentry(candles, direction, fairValueGaps);
    if (fvgSignal) signals.push(fvgSignal);
  }

  if (supplyDemandZones && supplyDemandZones.length > 0) {
    const obSignal = detectOrderBlockRetest(candles, direction, supplyDemandZones);
    if (obSignal) signals.push(obSignal);
  }

  // Find best signal
  const bestSignal = signals.length > 0
    ? signals.reduce((best, s) => (s.quality > best.quality ? s : best))
    : null;

  // Composite entry score
  const patternScore = bestSignal ? bestSignal.quality : 0;
  const pullbackScore = pullback.isPullback ? 30 : 0;
  const multiPatternBonus = signals.length >= 2 ? 15 : 0;
  const entryScore = Math.min(100, patternScore + pullbackScore + multiPatternBonus);

  // Refined entry: tighten entry zone if we have a strong candle pattern
  let refinedEntry: [number, number] | null = null;
  if (bestSignal && bestSignal.quality >= 60) {
    const lastCandle = candles[candles.length - 1];
    if (direction === "bullish") {
      // Tighten entry to last candle's low → close
      refinedEntry = [
        Math.max(currentEntry[0], lastCandle.low),
        Math.min(currentEntry[1], lastCandle.close),
      ];
    } else {
      // Tighten entry to close → high
      refinedEntry = [
        Math.max(currentEntry[0], lastCandle.close),
        Math.min(currentEntry[1], lastCandle.high),
      ];
    }
    // Validate the refined zone is sensible
    if (refinedEntry[0] >= refinedEntry[1]) refinedEntry = null;
  }

  return {
    signals,
    bestSignal,
    entryScore,
    refinedEntry,
    isPullback: pullback.isPullback,
    pullbackDepth: pullback.depth,
  };
}
