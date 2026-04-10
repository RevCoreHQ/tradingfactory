import type { OHLCV } from "@/lib/types/market";
import type { SwingPoint, StructureEvent, MarketStructure } from "@/lib/types/signals";

// ==================== SWING POINT DETECTION ====================

/**
 * Detect swing highs and lows using 5-bar fractal pattern.
 * A swing high requires the center bar's high to be above its 2 neighbors on each side.
 * Returns raw (unclassified) swing points.
 */
export function detectSwingPoints(candles: OHLCV[], lookback: number = 100): SwingPoint[] {
  const data = candles.slice(-Math.max(lookback, 20));
  if (data.length < 5) return [];

  const offset = candles.length - data.length;
  const points: SwingPoint[] = [];

  for (let i = 2; i < data.length - 2; i++) {
    // Swing high: center bar high > both neighbors
    if (
      data[i].high > data[i - 1].high &&
      data[i].high > data[i - 2].high &&
      data[i].high > data[i + 1].high &&
      data[i].high > data[i + 2].high
    ) {
      points.push({
        price: data[i].high,
        timestamp: data[i].timestamp,
        type: "high",
        classification: "HH", // placeholder, classified below
        index: offset + i,
      });
    }

    // Swing low: center bar low < both neighbors
    if (
      data[i].low < data[i - 1].low &&
      data[i].low < data[i - 2].low &&
      data[i].low < data[i + 1].low &&
      data[i].low < data[i + 2].low
    ) {
      points.push({
        price: data[i].low,
        timestamp: data[i].timestamp,
        type: "low",
        classification: "HL", // placeholder
        index: offset + i,
      });
    }
  }

  return points;
}

// ==================== SWING CLASSIFICATION ====================

/**
 * Classify each swing point as HH/HL/LH/LL by comparing
 * to the previous swing of the same type (high vs high, low vs low).
 */
export function classifySwingPoints(swings: SwingPoint[]): SwingPoint[] {
  if (swings.length === 0) return [];

  const classified = swings.map((s) => ({ ...s }));
  let lastHigh: SwingPoint | null = null;
  let lastLow: SwingPoint | null = null;

  for (const swing of classified) {
    if (swing.type === "high") {
      if (lastHigh) {
        swing.classification = swing.price > lastHigh.price ? "HH" : "LH";
      } else {
        swing.classification = "HH"; // First high, assume HH
      }
      lastHigh = swing;
    } else {
      if (lastLow) {
        swing.classification = swing.price > lastLow.price ? "HL" : "LL";
      } else {
        swing.classification = "HL"; // First low, assume HL
      }
      lastLow = swing;
    }
  }

  return classified;
}

// ==================== STRUCTURE EVENT DETECTION ====================

/**
 * Detect Break of Structure (BOS) and Change of Character (CHoCH).
 *
 * BOS: price breaks the previous swing high (uptrend) or low (downtrend)
 * in the direction of the existing trend.
 *
 * CHoCH: first break in the opposite direction — e.g., in an uptrend (HH/HL),
 * the first close below the most recent Higher Low is a bearish CHoCH.
 */
export function detectStructureEvents(
  candles: OHLCV[],
  classifiedSwings: SwingPoint[]
): StructureEvent[] {
  if (classifiedSwings.length < 3 || candles.length === 0) return [];

  const events: StructureEvent[] = [];

  // Determine existing trend from the last few swings
  const recentHighs = classifiedSwings.filter((s) => s.type === "high").slice(-4);
  const recentLows = classifiedSwings.filter((s) => s.type === "low").slice(-4);

  const hhCount = recentHighs.filter((s) => s.classification === "HH").length;
  const lhCount = recentHighs.filter((s) => s.classification === "LH").length;
  const hlCount = recentLows.filter((s) => s.classification === "HL").length;
  const llCount = recentLows.filter((s) => s.classification === "LL").length;

  const isUptrend = hhCount > lhCount && hlCount >= llCount;
  const isDowntrend = lhCount > hhCount && llCount >= hlCount;

  // Check each candle against swing levels for breaks
  const allHighs = classifiedSwings.filter((s) => s.type === "high");
  const allLows = classifiedSwings.filter((s) => s.type === "low");

  // Check the most recent price action against last swing levels
  const lastCandle = candles[candles.length - 1];

  if (isUptrend) {
    // BOS bullish: price closes above the most recent swing high
    const lastSwingHigh = allHighs[allHighs.length - 1];
    if (lastSwingHigh && lastCandle.close > lastSwingHigh.price) {
      events.push({
        type: "BOS",
        direction: "bullish",
        price: lastSwingHigh.price,
        timestamp: lastCandle.timestamp,
        swingBroken: lastSwingHigh,
      });
    }

    // CHoCH bearish: price closes below the most recent HL (first sign of reversal)
    const lastHL = [...allLows].reverse().find((s) => s.classification === "HL");
    if (lastHL && lastCandle.close < lastHL.price) {
      events.push({
        type: "CHoCH",
        direction: "bearish",
        price: lastHL.price,
        timestamp: lastCandle.timestamp,
        swingBroken: lastHL,
      });
    }
  }

  if (isDowntrend) {
    // BOS bearish: price closes below the most recent swing low
    const lastSwingLow = allLows[allLows.length - 1];
    if (lastSwingLow && lastCandle.close < lastSwingLow.price) {
      events.push({
        type: "BOS",
        direction: "bearish",
        price: lastSwingLow.price,
        timestamp: lastCandle.timestamp,
        swingBroken: lastSwingLow,
      });
    }

    // CHoCH bullish: price closes above the most recent LH (first sign of reversal)
    const lastLH = [...allHighs].reverse().find((s) => s.classification === "LH");
    if (lastLH && lastCandle.close > lastLH.price) {
      events.push({
        type: "CHoCH",
        direction: "bullish",
        price: lastLH.price,
        timestamp: lastCandle.timestamp,
        swingBroken: lastLH,
      });
    }
  }

  // If no clear trend, check for any structure breaks
  if (!isUptrend && !isDowntrend && allHighs.length > 0 && allLows.length > 0) {
    const lastHigh = allHighs[allHighs.length - 1];
    const lastLow = allLows[allLows.length - 1];

    if (lastCandle.close > lastHigh.price) {
      events.push({
        type: "BOS",
        direction: "bullish",
        price: lastHigh.price,
        timestamp: lastCandle.timestamp,
        swingBroken: lastHigh,
      });
    }
    if (lastCandle.close < lastLow.price) {
      events.push({
        type: "BOS",
        direction: "bearish",
        price: lastLow.price,
        timestamp: lastCandle.timestamp,
        swingBroken: lastLow,
      });
    }
  }

  return events;
}

// ==================== STRUCTURE SCORE ====================

/**
 * Compute a structure score from swing sequence and events.
 * +100 = strong bullish (consecutive HH/HL)
 * -100 = strong bearish (consecutive LH/LL)
 * 0 = mixed/transitional
 */
export function computeStructureScore(
  swings: SwingPoint[],
  events: StructureEvent[]
): number {
  if (swings.length < 3) return 0;

  // Weight recent swings more heavily
  const recent = swings.slice(-8);
  let score = 0;

  for (let i = 0; i < recent.length; i++) {
    const recencyWeight = 1 + (i / recent.length); // 1.0 to ~2.0
    const s = recent[i];
    if (s.classification === "HH") score += 15 * recencyWeight;
    else if (s.classification === "HL") score += 10 * recencyWeight;
    else if (s.classification === "LH") score -= 15 * recencyWeight;
    else if (s.classification === "LL") score -= 10 * recencyWeight;
  }

  // Boost/penalize for structure events
  for (const event of events) {
    if (event.type === "BOS" && event.direction === "bullish") score += 20;
    else if (event.type === "BOS" && event.direction === "bearish") score -= 20;
    else if (event.type === "CHoCH" && event.direction === "bullish") score += 15;
    else if (event.type === "CHoCH" && event.direction === "bearish") score -= 15;
  }

  return Math.max(-100, Math.min(100, Math.round(score)));
}

// ==================== MASTER FUNCTION ====================

/**
 * Full market structure analysis: detect swings, classify them,
 * find BOS/CHoCH events, and compute a directional structure score.
 */
export function analyzeMarketStructure(candles: OHLCV[]): MarketStructure | null {
  if (candles.length < 20) return null;

  // Detect and classify swing points
  const rawSwings = detectSwingPoints(candles);
  const swingPoints = classifySwingPoints(rawSwings);

  if (swingPoints.length < 3) return null;

  // Detect structure events
  const events = detectStructureEvents(candles, swingPoints);

  // Compute score
  const structureScore = computeStructureScore(swingPoints, events);

  // Determine latest structure direction
  let latestStructure: "bullish" | "bearish" | "neutral";
  if (structureScore > 20) latestStructure = "bullish";
  else if (structureScore < -20) latestStructure = "bearish";
  else latestStructure = "neutral";

  // Find last BOS and CHoCH
  const lastBOS = [...events].reverse().find((e) => e.type === "BOS") ?? null;
  const lastCHoCH = [...events].reverse().find((e) => e.type === "CHoCH") ?? null;

  return {
    swingPoints,
    latestStructure,
    events,
    lastBOS,
    lastCHoCH,
    structureScore,
  };
}
