import type { OHLCV } from "@/lib/types/market";
import type { FairValueGap, InstitutionalCandle } from "@/lib/types/deep-analysis";
import type { MarketStructure, StructureEvent } from "@/lib/types/signals";

// ==================== CONSTANTS ====================

const SFP_SWING_LOOKBACK_BARS = 50;
const SFP_SWEEP_LOOKBACK_CANDLES = 5;
const SFP_MIN_WICK_ATR = 0.3;
const IDF_MAX_DISPLACEMENT_AGE = 30;
const IDF_MIN_FVG_FILL_PERCENT = 25;
const IDF_STRUCTURE_LOOKBACK = 10;

// ==================== RESULT TYPES ====================

export interface SFPResult {
  direction: "bullish" | "bearish";
  sweptSwingPrice: number;
  sweptSwingIndex: number;
  sweepDepth: number;
  wickLengthATR: number;
  candleIndex: number;
  strength: number;
  detected: boolean;
}

export interface IDFResult {
  direction: "bullish" | "bearish";
  fvgFillPercent: number;
  displacementScore: number;
  structureBreakConfirmed: boolean;
  structureBreakType: "BOS" | "CHoCH" | null;
  strength: number;
  detected: boolean;
}

// ==================== SFP DETECTION ====================

function scoreSFP(
  sweepDepth: number,
  wickLengthATR: number,
  lastCandle: OHLCV,
  candles: OHLCV[],
  direction: "bullish" | "bearish"
): number {
  // Component 1: Sweep depth (0-30 pts)
  const depthScore = Math.min(30, sweepDepth * 40);

  // Component 2: Rejection wick quality (0-35 pts)
  const wickScore = Math.min(35, wickLengthATR * 25);

  // Component 3: Volume surge (0-20 pts)
  const recentVolumes = candles.slice(-20).map((c) => c.volume);
  const avgVol = recentVolumes.reduce((s, v) => s + v, 0) / recentVolumes.length;
  const volRatio = avgVol > 0 ? lastCandle.volume / avgVol : 1.0;
  const volScore = Math.min(20, Math.max(0, (volRatio - 1.0) * 15));

  // Component 4: Close strength (0-15 pts)
  const range = lastCandle.high - lastCandle.low;
  let closeScore = 0;
  if (range > 0) {
    const closePosition = (lastCandle.close - lastCandle.low) / range;
    closeScore = direction === "bullish"
      ? Math.round(closePosition * 15)
      : Math.round((1 - closePosition) * 15);
  }

  return Math.min(100, Math.round(depthScore + wickScore + volScore + closeScore));
}

export function detectSFP(
  candles: OHLCV[],
  marketStructure: MarketStructure,
  atrValue: number
): SFPResult {
  const noSignal: SFPResult = {
    detected: false,
    direction: "bullish",
    sweptSwingPrice: 0,
    sweptSwingIndex: 0,
    sweepDepth: 0,
    wickLengthATR: 0,
    candleIndex: 0,
    strength: 0,
  };

  if (candles.length < 10 || atrValue <= 0) return noSignal;

  const lastCandle = candles[candles.length - 1];
  const lastCandleIndex = candles.length - 1;
  const minIndex = lastCandleIndex - SFP_SWING_LOOKBACK_BARS;

  const recentSwings = marketStructure.swingPoints.filter(
    (sp) => sp.index >= minIndex
  );

  // Check bearish SFP: sweep of a swing HIGH
  const swingHighs = recentSwings
    .filter((sp) => sp.type === "high" && sp.index < lastCandleIndex - 1)
    .sort((a, b) => b.index - a.index);

  for (const swingHigh of swingHighs) {
    if (lastCandleIndex - swingHigh.index > SFP_SWEEP_LOOKBACK_CANDLES) continue;

    if (lastCandle.high > swingHigh.price && lastCandle.close < swingHigh.price) {
      const sweepDepth = (lastCandle.high - swingHigh.price) / atrValue;
      const rejectionWick =
        (lastCandle.high - Math.max(lastCandle.open, lastCandle.close)) / atrValue;

      if (rejectionWick < SFP_MIN_WICK_ATR) continue;

      return {
        detected: true,
        direction: "bearish",
        sweptSwingPrice: swingHigh.price,
        sweptSwingIndex: swingHigh.index,
        sweepDepth,
        wickLengthATR: rejectionWick,
        candleIndex: lastCandleIndex,
        strength: scoreSFP(sweepDepth, rejectionWick, lastCandle, candles, "bearish"),
      };
    }
  }

  // Check bullish SFP: sweep of a swing LOW
  const swingLows = recentSwings
    .filter((sp) => sp.type === "low" && sp.index < lastCandleIndex - 1)
    .sort((a, b) => b.index - a.index);

  for (const swingLow of swingLows) {
    if (lastCandleIndex - swingLow.index > SFP_SWEEP_LOOKBACK_CANDLES) continue;

    if (lastCandle.low < swingLow.price && lastCandle.close > swingLow.price) {
      const sweepDepth = (swingLow.price - lastCandle.low) / atrValue;
      const rejectionWick =
        (Math.min(lastCandle.open, lastCandle.close) - lastCandle.low) / atrValue;

      if (rejectionWick < SFP_MIN_WICK_ATR) continue;

      return {
        detected: true,
        direction: "bullish",
        sweptSwingPrice: swingLow.price,
        sweptSwingIndex: swingLow.index,
        sweepDepth,
        wickLengthATR: rejectionWick,
        candleIndex: lastCandleIndex,
        strength: scoreSFP(sweepDepth, rejectionWick, lastCandle, candles, "bullish"),
      };
    }
  }

  return noSignal;
}

// ==================== IDF DETECTION ====================

function findRecentStructureBreak(
  marketStructure: MarketStructure,
  direction: "bullish" | "bearish",
  currentIndex: number,
  lookback: number
): StructureEvent | null {
  return (
    [...marketStructure.events].reverse().find((e) => {
      if (e.direction !== direction) return false;
      const barsSince = currentIndex - e.swingBroken.index;
      return barsSince >= 0 && barsSince <= lookback;
    }) ?? null
  );
}

function isRejectionCandle(
  candle: OHLCV,
  displacementDirection: "bullish" | "bearish",
  atrValue: number
): boolean {
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  const bodyRatio = range > 0 ? body / range : 0;

  if (bodyRatio > 0.4) return false;

  if (displacementDirection === "bullish") {
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    return upperWick / atrValue >= 0.5;
  } else {
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    return lowerWick / atrValue >= 0.5;
  }
}

function scoreIDF(
  ic: InstitutionalCandle,
  fvg: FairValueGap,
  structureBreakConfirmed: boolean,
  structureBreak: StructureEvent | null
): number {
  // Component 1: Displacement magnitude (0-30 pts)
  const displacementScore = Math.min(30, (ic.bodyATR / 4) * 30);

  // Component 2: FVG fill depth (0-25 pts)
  const fillScore = Math.min(25, (fvg.fillPercent / 100) * 25);

  // Component 3: Structure break quality (0-35 pts)
  if (structureBreakConfirmed && structureBreak) {
    const breakScore = structureBreak.type === "BOS" ? 35 : 25;
    return Math.min(100, Math.round(displacementScore + fillScore + breakScore + 5));
  }

  // Without structure break — rejection candle only (capped at 65)
  return Math.min(65, Math.round(displacementScore + fillScore + 10));
}

export function detectIDF(
  candles: OHLCV[],
  fairValueGaps: FairValueGap[],
  institutionalCandles: InstitutionalCandle[],
  marketStructure: MarketStructure,
  atrValue: number
): IDFResult {
  const noSignal: IDFResult = {
    detected: false,
    direction: "bullish",
    fvgFillPercent: 0,
    displacementScore: 0,
    structureBreakConfirmed: false,
    structureBreakType: null,
    strength: 0,
  };

  if (candles.length < 10 || atrValue <= 0) return noSignal;

  const lastCandleIndex = candles.length - 1;
  const lastCandle = candles[lastCandleIndex];

  for (const ic of institutionalCandles) {
    if (!ic.createdFVG) continue;
    if (lastCandleIndex - ic.candleIndex > IDF_MAX_DISPLACEMENT_AGE) continue;

    // Find the FVG created by this IC
    const matchingFVG = fairValueGaps.find(
      (fvg) =>
        Math.abs(fvg.candleIndex - ic.candleIndex) <= 2 && fvg.type === ic.type
    );

    if (!matchingFVG) continue;
    if (matchingFVG.fillPercent < IDF_MIN_FVG_FILL_PERCENT) continue;
    if (matchingFVG.freshness === "fresh") continue;

    // Check if price is at or near the FVG zone
    const currentPrice = lastCandle.close;
    const priceNearFVG =
      currentPrice >= matchingFVG.low - atrValue * 0.5 &&
      currentPrice <= matchingFVG.high + atrValue * 0.5;

    if (!priceNearFVG && matchingFVG.freshness !== "tested") continue;

    // IDF direction is OPPOSITE to the displacement
    const failureDirection: "bullish" | "bearish" =
      ic.type === "bearish" ? "bullish" : "bearish";

    const recentStructureBreak = findRecentStructureBreak(
      marketStructure,
      failureDirection,
      lastCandleIndex,
      IDF_STRUCTURE_LOOKBACK
    );

    const structureBreakConfirmed = recentStructureBreak !== null;
    const hasRejectionCandle = isRejectionCandle(lastCandle, ic.type, atrValue);

    if (!structureBreakConfirmed && !hasRejectionCandle) continue;

    return {
      detected: true,
      direction: failureDirection,
      fvgFillPercent: matchingFVG.fillPercent,
      displacementScore: ic.displacementScore,
      structureBreakConfirmed,
      structureBreakType: recentStructureBreak?.type ?? null,
      strength: scoreIDF(ic, matchingFVG, structureBreakConfirmed, recentStructureBreak),
    };
  }

  return noSignal;
}
