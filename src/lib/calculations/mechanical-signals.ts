import type { OHLCV } from "@/lib/types/market";
import type { TechnicalSummary } from "@/lib/types/indicators";
import type {
  MarketRegime,
  FullRegime,
  ImpulseColor,
  ConvictionTier,
  MechanicalSignal,
  TradeDeskSetup,
  ConfluencePattern,
  TradingStyle,
  MarketPhase,
} from "@/lib/types/signals";
import type { MTFTimeframe } from "@/lib/types/mtf";
import type { Instrument } from "@/lib/types/market";
import { calcSMA } from "./technical-indicators";
import { applyLearning, adjustedTier } from "./confluence-learning";
import { buildConfluenceKey, buildRegimeConfluenceKey } from "./setup-tracker";
import { detectFullRegime } from "./regime-engine";
import { analyzeMarketStructure } from "./market-structure";
import { computeDeCorrelatedAgreement, detectClusterConflict } from "./signal-clustering";
import { applySystemWeights, evaluateSignalHealth, applySignalHealth, getRegimeAdaptiveWeights, type SystemPerformance } from "./system-performance";
import { analyzeEntryOptimization } from "./entry-optimization";
import { detectFairValueGaps } from "./fair-value-gaps";
import { detectInstitutionalCandles, detectConsolidationBreakouts } from "./institutional-candles";
import { detectSupplyDemandZones } from "./supply-demand-zones";
import { calculateExecutionCost, adjustStopLossForSpread, adjustRiskReward } from "./execution-costs";
import { calculateVolTargetMultiplier } from "./volatility-targeting";
import { evaluateNoTrade } from "./no-trade-engine";
import { detectSFP, detectIDF } from "./sfp-idf-detection";
import { detectOBRetest, type OBRetestResult } from "./ob-retest-detection";
import type { FairValueGap, SupplyDemandZone } from "@/lib/types/deep-analysis";
import type { MarketStructure } from "@/lib/types/signals";

// ==================== TRADING STYLE ====================

interface StyleParams {
  slMultiplier: number;
  tpMultipliers: [number, number, number];
  entrySpreadMultiplier: number;
  expiryMs: number;
  label: string;
}

export const STYLE_PARAMS: Record<TradingStyle, StyleParams> = {
  intraday: {
    slMultiplier: 1.5,
    tpMultipliers: [2.25, 3.75, 5.25], // 1.5/2.5/3.5 R:R with 1.5 ATR SL
    entrySpreadMultiplier: 0.4,
    expiryMs: 8 * 60 * 60 * 1000, // 8 hours
    label: "1H Intraday",
  },
  swing: {
    slMultiplier: 2.0,
    tpMultipliers: [3.0, 5.0, 7.0], // 1.5/2.5/3.5 R:R with 2.0 ATR SL
    entrySpreadMultiplier: 0.5,
    expiryMs: 24 * 60 * 60 * 1000, // 24 hours
    label: "4H Swing",
  },
};

export interface StyleTimeframeConfig {
  timeframes: MTFTimeframe[];   // ordered highest → lowest
  anchor: MTFTimeframe;         // directional anchor (highest TF)
  trigger: MTFTimeframe;        // pullback trigger (lowest TF)
  confluenceWeights: Partial<Record<MTFTimeframe, number>>;
}

export const STYLE_TIMEFRAMES: Record<TradingStyle, StyleTimeframeConfig> = {
  swing: {
    timeframes: ["1w", "1d", "4h", "1h"],
    anchor: "1w",
    trigger: "1h",
    confluenceWeights: { "1w": 0.40, "1d": 0.30, "4h": 0.20, "1h": 0.10 },
  },
  intraday: {
    timeframes: ["4h", "1h", "15m", "5m"],
    anchor: "4h",
    trigger: "5m",
    confluenceWeights: { "4h": 0.40, "1h": 0.30, "15m": 0.20, "5m": 0.10 },
  },
};

export function selectTradingStyle(adx: number, sessionScore: number, fullRegime?: FullRegime): TradingStyle {
  // Off-hours: prefer swing (wider stops = less noise-sensitive)
  if (sessionScore < 30) return "swing";

  // Use full regime classification when available
  if (fullRegime) {
    // Distribution: shorter exposure — reversal risk
    if (fullRegime.phase === "distribution") return "intraday";
    // Accumulation: swing to position for breakout
    if (fullRegime.phase === "accumulation") return "swing";
    // Expansion with trend: ride the move
    if (fullRegime.phase === "expansion" && fullRegime.structure === "trend") return "swing";
    // Reversal with high vol: short intraday exposure — direction uncertainty
    if (fullRegime.phase === "reversal" && fullRegime.volatility === "high") return "intraday";
    // Breakout: intraday to capture initial move
    if (fullRegime.structure === "breakout") return "intraday";
    // Range: intraday mean reversion
    if (fullRegime.structure === "range") return "intraday";
    // Trend: swing
    if (fullRegime.structure === "trend") return "swing";
  }

  // Fallback to legacy ADX logic
  if (adx > 50) return "intraday";
  if (adx > 20) return "swing";
  return "intraday";
}

// ==================== STRUCTURAL LEVELS ====================

interface StructuralLevel {
  price: number;
  type: "support" | "resistance";
  strength: number;
}

function collectStructuralLevels(
  summary: TechnicalSummary,
  currentPrice: number
): StructuralLevel[] {
  const levels: StructuralLevel[] = [];

  // S/R levels (fractal-based)
  for (const sr of summary.supportResistance) {
    levels.push({ price: sr.price, type: sr.type, strength: Math.min(10, sr.strength * 2) });
  }

  // Pivot points (daily + weekly)
  for (const pp of summary.pivotPoints) {
    const bonus = pp.type === "weekly" ? 2 : 0;
    levels.push({ price: pp.pivot, type: pp.pivot < currentPrice ? "support" : "resistance", strength: 5 + bonus });
    levels.push({ price: pp.r1, type: "resistance", strength: 4 + bonus });
    levels.push({ price: pp.r2, type: "resistance", strength: 3 + bonus });
    levels.push({ price: pp.r3, type: "resistance", strength: 2 + bonus });
    levels.push({ price: pp.s1, type: "support", strength: 4 + bonus });
    levels.push({ price: pp.s2, type: "support", strength: 3 + bonus });
    levels.push({ price: pp.s3, type: "support", strength: 2 + bonus });
  }

  // Fibonacci levels
  for (const fib of summary.fibonacci) {
    const fibStrength = (fib.level === 0.618 || fib.level === 0.382) ? 4 : 2;
    levels.push({
      price: fib.price,
      type: fib.price < currentPrice ? "support" : "resistance",
      strength: fibStrength,
    });
  }

  // Filter out levels at 0 or too far (>10% from price)
  return levels
    .filter((l) => l.price > 0 && Math.abs(l.price - currentPrice) / currentPrice < 0.10)
    .sort((a, b) => a.price - b.price);
}

function snapLevelsToStructure(
  summary: TechnicalSummary,
  direction: "bullish" | "bearish" | "neutral",
  price: number,
  atr: number,
  atrEntry: [number, number],
  atrSL: number,
  atrTP: [number, number, number],
  fairValueGaps?: FairValueGap[]
): {
  entry: [number, number];
  stopLoss: number;
  takeProfit: [number, number, number];
  riskReward: [number, number, number];
} {
  if (direction === "neutral" || atr === 0) {
    return { entry: atrEntry, stopLoss: atrSL, takeProfit: atrTP, riskReward: [1.5, 2.5, 3.5] };
  }

  const levels = collectStructuralLevels(summary, price);

  // Add FVG midpoints (Consequent Encroachment) as structural levels
  if (fairValueGaps && fairValueGaps.length > 0) {
    for (const fvg of fairValueGaps) {
      if (fvg.freshness === "filled") continue;
      const fvgStrength = Math.round(fvg.strength / 20); // Normalize 0-100 → 0-5
      levels.push({
        price: fvg.midpoint,
        type: fvg.type === "bullish" ? "support" : "resistance",
        strength: Math.max(3, fvgStrength),
      });
    }
  }

  if (levels.length === 0) {
    return { entry: atrEntry, stopLoss: atrSL, takeProfit: atrTP, riskReward: [1.5, 2.5, 3.5] };
  }

  const isBull = direction === "bullish";
  let snappedSL = atrSL;
  let snappedEntry: [number, number] = [...atrEntry];
  const snappedTP: [number, number, number] = [...atrTP];

  // --- Snap Stop Loss ---
  // For longs: find strongest support between (atrSL - 0.5*ATR) and entry
  // For shorts: find strongest resistance between entry and (atrSL + 0.5*ATR)
  const slCandidates = levels.filter((l) => {
    if (isBull) {
      return l.type === "support" && l.price > atrSL - atr * 0.5 && l.price < atrEntry[0];
    } else {
      return l.type === "resistance" && l.price < atrSL + atr * 0.5 && l.price > atrEntry[1];
    }
  });

  if (slCandidates.length > 0) {
    // Pick strongest candidate
    const best = slCandidates.sort((a, b) => b.strength - a.strength)[0];
    // Place SL 0.3*ATR past the level (below support for longs, above resistance for shorts)
    snappedSL = isBull ? best.price - atr * 0.3 : best.price + atr * 0.3;
  }

  // --- Snap Entry Zone ---
  // For longs: if there's a support within 0.5*ATR of price, use it as entry lower bound
  const entryCandidates = levels.filter((l) => {
    if (isBull) {
      return l.type === "support" && l.price > price - atr * 0.5 && l.price < price;
    } else {
      return l.type === "resistance" && l.price < price + atr * 0.5 && l.price > price;
    }
  });

  if (entryCandidates.length > 0) {
    const best = entryCandidates.sort((a, b) => b.strength - a.strength)[0];
    if (isBull) {
      snappedEntry = [best.price, price];
    } else {
      snappedEntry = [price, best.price];
    }
  }

  // --- Snap Take Profits ---
  const entryMid = (snappedEntry[0] + snappedEntry[1]) / 2;
  const slDist = Math.abs(entryMid - snappedSL);

  // For longs: find resistance levels above entry, sorted ascending
  // For shorts: find support levels below entry, sorted descending
  const tpCandidates = levels
    .filter((l) => {
      if (isBull) return l.price > entryMid + atr * 0.5;
      return l.price < entryMid - atr * 0.5;
    })
    .sort((a, b) => isBull ? a.price - b.price : b.price - a.price);

  const minRR = [1.5, 2.0, 2.5]; // Minimum R:R for each TP
  let tpIdx = 0;

  for (const candidate of tpCandidates) {
    if (tpIdx >= 3) break;
    const dist = Math.abs(candidate.price - entryMid);
    const rr = slDist > 0 ? dist / slDist : 0;
    if (rr >= minRR[tpIdx]) {
      snappedTP[tpIdx] = candidate.price;
      tpIdx++;
    }
  }

  // Recalculate R:R from actual levels
  const rr: [number, number, number] = [
    slDist > 0 ? Number((Math.abs(snappedTP[0] - entryMid) / slDist).toFixed(1)) : 1.5,
    slDist > 0 ? Number((Math.abs(snappedTP[1] - entryMid) / slDist).toFixed(1)) : 2.5,
    slDist > 0 ? Number((Math.abs(snappedTP[2] - entryMid) / slDist).toFixed(1)) : 3.5,
  ];

  return { entry: snappedEntry, stopLoss: snappedSL, takeProfit: snappedTP, riskReward: rr };
}

// ==================== REGIME DETECTION ====================

export function detectRegime(summary: TechnicalSummary, candles?: OHLCV[], previousPhase?: MarketPhase): {
  regime: MarketRegime;
  label: string;
  fullRegime?: FullRegime;
} {
  // If candles provided, use the full multi-dimensional regime engine
  if (candles && candles.length >= 50) {
    const fullRegime = detectFullRegime(candles, summary, previousPhase);
    return {
      regime: fullRegime.legacy,
      label: fullRegime.label,
      fullRegime,
    };
  }

  // Fallback: legacy ADX-only detection
  const adx = summary.adx.adx;
  const plusDI = summary.adx.plusDI;
  const minusDI = summary.adx.minusDI;

  if (adx > 50) {
    return { regime: "volatile", label: `Volatile (ADX ${adx.toFixed(0)})` };
  }
  if (adx > 30) {
    if (plusDI > minusDI) {
      return { regime: "trending_up", label: `Trending Up (ADX ${adx.toFixed(0)})` };
    }
    return { regime: "trending_down", label: `Trending Down (ADX ${adx.toFixed(0)})` };
  }
  return { regime: "ranging", label: `Ranging (ADX ${adx.toFixed(0)})` };
}

// ==================== MECHANICAL SYSTEMS ====================

function rsiExtremesSignal(
  summary: TechnicalSummary,
  candles: OHLCV[],
  regime: MarketRegime,
  fullRegime?: FullRegime
): MechanicalSignal {
  // Weissman: RSI extremes with SMA(200) filter — using RSI(14) for less noise
  const closes = candles.map((c) => c.close);
  const price = summary.currentPrice;
  const rsi = summary.rsi.value; // RSI(14) — standard, less noisy than RSI(9)

  // SMA(200) filter
  const sma200 = calcSMA(closes, 200);
  const hasSma200 = sma200.length > 0;
  const aboveSma200 = hasSma200 && price > sma200[sma200.length - 1];
  const belowSma200 = hasSma200 && price < sma200[sma200.length - 1];

  let direction: "bullish" | "bearish" | "neutral" = "neutral";
  let description = `RSI(14) at ${rsi.toFixed(0)}`;
  let strength = 20;

  if (rsi < 30 && aboveSma200) {
    direction = "bullish";
    description = `RSI(14) oversold (${rsi.toFixed(0)}) + price above SMA(200) — mean reversion buy`;
    strength = 80;
  } else if (rsi > 70 && belowSma200) {
    direction = "bearish";
    description = `RSI(14) overbought (${rsi.toFixed(0)}) + price below SMA(200) — mean reversion sell`;
    strength = 80;
  } else if (rsi < 30) {
    direction = "bullish";
    description = `RSI(14) oversold (${rsi.toFixed(0)}) — needs SMA(200) filter confirmation`;
    strength = 50;
  } else if (rsi > 70) {
    direction = "bearish";
    description = `RSI(14) overbought (${rsi.toFixed(0)}) — needs SMA(200) filter confirmation`;
    strength = 50;
  }

  // Use fullRegime.structure when available for more accurate gating.
  const regimeMatch = fullRegime
    ? fullRegime.structure === "range"
    : regime === "ranging" || regime === "volatile";
  // Hard regime gate: MR signals in trending markets are excluded entirely.
  if (!regimeMatch && direction !== "neutral") {
    return {
      system: "RSI Extremes",
      type: "mean_reversion",
      direction: "neutral",
      strength: 0,
      description: description + " [regime-excluded: trending market]",
      regimeMatch: false,
    };
  }
  return {
    system: "RSI Extremes",
    type: "mean_reversion",
    direction,
    strength,
    description,
    regimeMatch,
  };
}

function impulseSignal(summary: TechnicalSummary): MechanicalSignal {
  // Elder: EMA(13) slope + MACD-H slope = GREEN/RED/BLUE
  const { color } = summary.impulse;

  let direction: "bullish" | "bearish" | "neutral";
  let description: string;
  let strength: number;

  if (color === "green") {
    direction = "bullish";
    description = "Impulse GREEN — EMA rising + MACD-H rising (shorts prohibited)";
    strength = 75;
  } else if (color === "red") {
    direction = "bearish";
    description = "Impulse RED — EMA falling + MACD-H falling (longs prohibited)";
    strength = 75;
  } else {
    direction = "neutral";
    description = "Impulse BLUE — mixed signals (no prohibition)";
    strength = 30;
  }

  return {
    system: "Elder Impulse",
    type: "momentum",
    direction,
    strength,
    description,
    regimeMatch: true, // Impulse works in all regimes
  };
}

function volumeConfirmationSignal(
  summary: TechnicalSummary,
  candles: OHLCV[]
): MechanicalSignal {
  // Volume Confirmation: VWAP position + volume surge + Force Index alignment.
  // This is a genuinely independent 4th cluster — uses volume data, not just price.
  // Works across all regimes (volume confirms moves in trends, ranges, and breakouts).
  const vwap = summary.vwap;
  const forceIndex = summary.forceIndex;

  if (!vwap || candles.length < 20) {
    return {
      system: "Volume Confirmation",
      type: "volume",
      direction: "neutral",
      strength: 0,
      description: "Insufficient volume data",
      regimeMatch: true,
    };
  }

  // Factor 1: VWAP position — price above VWAP = institutional buying, below = selling
  const vwapDeviation = vwap.deviation; // positive = price above VWAP
  const atr = summary.atr.value;
  const normalizedDev = atr > 0 ? vwapDeviation / atr : 0;
  // Significant deviation: |normalizedDev| > 0.3 ATR from VWAP
  let vwapScore = 0;
  if (normalizedDev > 0.3) vwapScore = 1;       // bullish: price well above VWAP
  else if (normalizedDev < -0.3) vwapScore = -1; // bearish: price well below VWAP

  // Factor 2: Volume surge — current bar volume vs 20-period average
  const recentVolumes = candles.slice(-20).map((c) => c.volume);
  const avgVolume = recentVolumes.reduce((s, v) => s + v, 0) / recentVolumes.length;
  const currentVolume = candles[candles.length - 1].volume;
  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
  const hasSurge = volumeRatio > 1.5; // 50%+ above average

  // Factor 3: Force Index alignment — institutional participation direction
  // Short-term (EMA2) shows immediate pressure, intermediate (EMA13) shows trend
  let forceScore = 0;
  if (forceIndex.shortTerm > 0 && forceIndex.intermediate > 0) forceScore = 1;  // bullish
  else if (forceIndex.shortTerm < 0 && forceIndex.intermediate < 0) forceScore = -1; // bearish

  // Combine: all three factors must agree for a strong signal
  const bullishFactors = (vwapScore > 0 ? 1 : 0) + (forceScore > 0 ? 1 : 0);
  const bearishFactors = (vwapScore < 0 ? 1 : 0) + (forceScore < 0 ? 1 : 0);

  let direction: "bullish" | "bearish" | "neutral" = "neutral";
  let strength = 20;
  let description = `VWAP dev ${normalizedDev.toFixed(2)} ATR, vol ratio ${volumeRatio.toFixed(1)}x`;

  if (bullishFactors >= 2 && hasSurge) {
    direction = "bullish";
    strength = 85;
    description = `Volume confirms bullish — price above VWAP + Force Index positive + ${volumeRatio.toFixed(1)}x vol surge`;
  } else if (bearishFactors >= 2 && hasSurge) {
    direction = "bearish";
    strength = 85;
    description = `Volume confirms bearish — price below VWAP + Force Index negative + ${volumeRatio.toFixed(1)}x vol surge`;
  } else if (bullishFactors >= 2) {
    direction = "bullish";
    strength = 55;
    description = `Volume leans bullish — price above VWAP + Force Index positive (no surge)`;
  } else if (bearishFactors >= 2) {
    direction = "bearish";
    strength = 55;
    description = `Volume leans bearish — price below VWAP + Force Index negative (no surge)`;
  }

  return {
    system: "Volume Confirmation",
    type: "volume",
    direction,
    strength,
    description,
    regimeMatch: true, // Volume works across all regimes
  };
}

// ==================== REVERSAL CLUSTER: SFP + IDF ====================

function sfpSignal(
  sfpResult: import("./sfp-idf-detection").SFPResult | null,
  fullRegime?: FullRegime
): MechanicalSignal {
  if (!sfpResult || !sfpResult.detected) {
    return {
      system: "SFP",
      type: "reversal",
      direction: "neutral",
      strength: 0,
      description: "No swing failure pattern detected",
      regimeMatch: true,
    };
  }

  // SFP regime match: range or breakout (stop hunts are range/fake-breakout behavior)
  const structure = fullRegime?.structure;
  const regimeMatch = !structure || structure === "range" || structure === "breakout";

  const sweepSide = sfpResult.direction === "bullish" ? "low" : "high";
  return {
    system: "SFP",
    type: "reversal",
    direction: sfpResult.direction,
    strength: sfpResult.strength,
    description: `Swing Failure Pattern — swept ${sweepSide} at ${sfpResult.sweptSwingPrice.toFixed(5)}, wick ${sfpResult.wickLengthATR.toFixed(1)}×ATR rejection`,
    regimeMatch,
  };
}

function idfSignal(idfResult: import("./sfp-idf-detection").IDFResult | null): MechanicalSignal {
  if (!idfResult || !idfResult.detected) {
    return {
      system: "IDF",
      type: "reversal",
      direction: "neutral",
      strength: 0,
      description: "No imbalance/displacement failure detected",
      regimeMatch: true,
    };
  }

  // IDF regime match: all regimes (displacement failures happen everywhere)
  const confirmLabel = idfResult.structureBreakConfirmed
    ? `confirmed by ${idfResult.structureBreakType}`
    : "rejection only (no structure break)";

  return {
    system: "IDF",
    type: "reversal",
    direction: idfResult.direction,
    strength: idfResult.strength,
    description: `Imbalance/Displacement Failure — FVG ${idfResult.fvgFillPercent.toFixed(0)}% filled, ${confirmLabel}`,
    regimeMatch: true,
  };
}

function obRetestSignal(
  obRetestResult: OBRetestResult | null,
  fullRegime?: FullRegime
): MechanicalSignal {
  if (!obRetestResult || !obRetestResult.detected) {
    return { system: "OB Retest", type: "reversal", direction: "neutral", strength: 0, description: "", regimeMatch: true };
  }

  // OB Retest fits range + reversal phases best
  const structure = fullRegime?.structure;
  const regimeMatch = !structure || structure === "range" || structure === "breakout";

  const zoneSide = obRetestResult.direction === "bullish" ? "demand" : "supply";
  return {
    system: "OB Retest",
    type: "reversal",
    direction: obRetestResult.direction,
    strength: obRetestResult.strength,
    description: `Order Block Retest — price returning to ${zoneSide} OB (${obRetestResult.proximityPercent.toFixed(0)}% into zone), displacement ${obRetestResult.displacementMagnitude.toFixed(1)}×ATR`,
    regimeMatch,
  };
}

function trendAlignmentSignal(summary: TechnicalSummary, regime: MarketRegime, fullRegime?: FullRegime): MechanicalSignal {
  // Multi-MA alignment check: EMA(9) > EMA(21) > EMA(50) > SMA(200) = bullish stack
  const mas = summary.movingAverages;
  const ema9 = mas.find((m) => m.type === "EMA" && m.period === 9)?.value;
  const ema21 = mas.find((m) => m.type === "EMA" && m.period === 21)?.value;
  const ema50 = mas.find((m) => m.type === "EMA" && m.period === 50)?.value;
  const sma200 = mas.find((m) => m.type === "SMA" && m.period === 200)?.value;

  if (!ema9 || !ema21 || !ema50 || !sma200) {
    return {
      system: "Trend Stack",
      type: "trend",
      direction: "neutral",
      strength: 0,
      description: "Insufficient MA data",
      regimeMatch: false,
    };
  }

  let direction: "bullish" | "bearish" | "neutral" = "neutral";
  let description: string;
  let strength: number;

  if (ema9 > ema21 && ema21 > ema50 && ema50 > sma200) {
    direction = "bullish";
    description = "Full bullish stack: EMA(9) > EMA(21) > EMA(50) > SMA(200)";
    strength = 90;
  } else if (ema9 < ema21 && ema21 < ema50 && ema50 < sma200) {
    direction = "bearish";
    description = "Full bearish stack: EMA(9) < EMA(21) < EMA(50) < SMA(200)";
    strength = 90;
  } else if (ema9 > ema21 && ema21 > ema50) {
    direction = "bullish";
    description = "Partial bullish: EMA(9) > EMA(21) > EMA(50)";
    strength = 60;
  } else if (ema9 < ema21 && ema21 < ema50) {
    direction = "bearish";
    description = "Partial bearish: EMA(9) < EMA(21) < EMA(50)";
    strength = 60;
  } else {
    description = "MAs tangled — no clear trend";
    strength = 20;
  }

  // Use fullRegime.structure when available (more accurate than legacy ADX-only check).
  // Legacy regime misclassifies moderate trends (ADX 25-30) as "ranging", but
  // fullRegime correctly identifies them as "trend" via EMA slope + ADX combined.
  const isTrending = fullRegime
    ? fullRegime.structure === "trend" || fullRegime.structure === "breakout"
    : regime === "trending_up" || regime === "trending_down";
  if (!isTrending && direction !== "neutral") {
    return {
      system: "Trend Stack",
      type: "trend",
      direction: "neutral",
      strength: 0,
      description: description + " [regime-excluded: non-trending]",
      regimeMatch: false,
    };
  }
  return {
    system: "Trend Stack",
    type: "trend",
    direction,
    strength,
    description,
    regimeMatch: isTrending,
  };
}

// ==================== CONVICTION TIER ====================

function calculateConviction(
  signals: MechanicalSignal[],
  regime: MarketRegime,
  impulseColor: ImpulseColor,
  adx: number,
  fullRegime?: FullRegime,
  marketStructure?: MarketStructure | null,
  ictContext?: TradeDeskSetup["ictContext"]
): { tier: ConvictionTier; score: number; direction: "bullish" | "bearish" | "neutral"; activeClusters: number } {
  // Count signal directions
  const bullish = signals.filter((s) => s.direction === "bullish");
  const bearish = signals.filter((s) => s.direction === "bearish");

  // Determine primary direction
  const bullScore = bullish.reduce((sum, s) => sum + s.strength, 0);
  const bearScore = bearish.reduce((sum, s) => sum + s.strength, 0);
  const direction: "bullish" | "bearish" | "neutral" =
    bullScore > bearScore + 50 ? "bullish" :
    bearScore > bullScore + 50 ? "bearish" : "neutral";

  // Count regime-matched signals
  const matched = signals.filter((s) => s.regimeMatch && s.direction === direction).length;
  const activeSignals = signals.filter((s) => s.direction !== "neutral").length;

  // Conviction scoring — 4 merged factors (v4, audit response)
  // Simplified from 6 factors: merged regime+impulse, merged structure+ICT
  let score = 0;

  // Pre-compute de-correlated agreement ONCE (used by Factor 1 + Factor 4)
  let activeClusters = 0;
  let clusterResult: ReturnType<typeof computeDeCorrelatedAgreement> | null = null;
  if (direction !== "neutral" && activeSignals > 0) {
    clusterResult = computeDeCorrelatedAgreement(signals, direction, fullRegime);
    activeClusters = clusterResult.activeClusters;
  }

  // Factor 1: De-correlated Agreement (0-40 pts)
  // Only best signal per cluster counts, regime-weighted.
  if (clusterResult) {
    score += clusterResult.agreement;
  }

  // Factor 2: Regime + Impulse (0-30 pts) — MERGED old factors 3+4
  // Regime match: how many signals match the current regime
  if (matched >= 3) score += 15;
  else if (matched >= 2) score += 10;
  else if (matched >= 1) score += 5;
  // Impulse alignment
  if (direction === "bullish" && impulseColor === "green") score += 15;
  else if (direction === "bearish" && impulseColor === "red") score += 15;
  else if (impulseColor === "blue") score += 3;
  else if (direction === "bullish" && impulseColor === "red") score -= 10;
  else if (direction === "bearish" && impulseColor === "green") score -= 10;

  // Factor 3: Phase Score (0-20 pts) — SIMPLIFIED old factor 5
  // Phase alignment + transitions only, removed ADX exhaustion penalty
  if (fullRegime) {
    if ((fullRegime.phase === "distribution" || fullRegime.phase === "reversal") && direction === "bullish") {
      score -= 10;
    }
    if (fullRegime.phase === "accumulation" && direction === "bearish") {
      score -= 8;
    }
    if (fullRegime.phase === "expansion") {
      const expansionAligned =
        (direction === "bullish" && fullRegime.emaSlope > 0) ||
        (direction === "bearish" && fullRegime.emaSlope < 0);
      if (expansionAligned) score += 8;
    }

    // Phase transition bonuses
    if (fullRegime.phaseTransition?.isActionable) {
      const t = fullRegime.phaseTransition;
      const key = `${t.from}->${t.to}`;
      if (key === "expansion->distribution" && direction === "bearish") score += 10;
      else if (key === "accumulation->expansion" && direction === "bullish") score += 10;
      else if (key === "distribution->reversal" && direction === "bearish") score += 8;
      else if (key === "reversal->accumulation" && direction === "bullish") score += 8;
      else if (key === "distribution->accumulation" && direction === "bullish") score += 5;
      else if (key === "expansion->distribution" && direction === "bullish") score -= 8;
      else if (key === "accumulation->expansion" && direction === "bearish") score -= 8;
    }
  } else {
    if (adx > 50) score -= 5;
  }

  // Factor 4: Structure + ICT (0-10 pts) — MERGED old factors 2+6
  // Cluster conflict scaled by 0.67 (was -15 max, now -10 max)
  // Reuses clusterResult from Factor 1 — no redundant computation.
  if (clusterResult) {
    const conflict = detectClusterConflict(clusterResult.clusters);
    score += Math.round(conflict.penalty * 0.67); // scaled down
  }
  // ICT bonus (0-7 pts)
  if (ictContext) {
    let ictBonus = 0;
    if (ictContext.nearestFVG && ictContext.nearestFVG.freshness === "fresh") {
      const aligned = (direction === "bullish" && ictContext.nearestFVG.type === "bullish") ||
                      (direction === "bearish" && ictContext.nearestFVG.type === "bearish");
      if (aligned) ictBonus += 5;
    }
    if (ictContext.nearestOB && ictContext.nearestOB.strength >= 60) {
      const aligned = (direction === "bullish" && ictContext.nearestOB.type === "demand") ||
                      (direction === "bearish" && ictContext.nearestOB.type === "supply");
      if (aligned) ictBonus += 2;
    }
    score += Math.min(7, ictBonus);
  }

  // Map to tier using INDEPENDENT CLUSTER COUNT instead of raw signal count.
  // Old thresholds (agreeing >= 5 for A+) allowed 4 correlated trend signals
  // to inflate conviction. New thresholds require truly independent signal
  // families (trend, momentum, mean_reversion) to agree.
  // Max activeClusters = 3 (one per signal family).
  // Audit v2: lowered thresholds for 3-signal system (1 signal per cluster)
  let tier: ConvictionTier;
  if (score >= 70 && activeClusters >= 3) tier = "A+";
  else if (score >= 55 && activeClusters >= 2) tier = "A";
  else if (score >= 35 && activeClusters >= 2) tier = "B";
  else if (score >= 20 && activeClusters >= 1) tier = "C";
  else tier = "D";

  return { tier, score: Math.max(0, Math.min(100, score)), direction, activeClusters };
}

// ==================== REASONS TO EXIT ====================

function generateReasonsToExit(
  direction: "bullish" | "bearish" | "neutral",
  signals: MechanicalSignal[],
  summary: TechnicalSummary
): string[] {
  const reasons: string[] = [];

  // SMB Capital Reasons2Sell adapted
  if (direction === "bullish") {
    const nearestResistance = summary.supportResistance.find((l) => l.type === "resistance");
    if (nearestResistance) {
      reasons.push(`Price reaches resistance at ${nearestResistance.price.toFixed(4)}`);
    }
    reasons.push("Momentum shift (MACD-H slope reversal on Elder Impulse)");
    reasons.push("Elder Impulse turns RED (selling pressure)");
    if (summary.rsi.value > 65) {
      reasons.push(`RSI approaching overbought (${summary.rsi.value.toFixed(0)})`);
    }
    reasons.push("Trend Stack breaks down (EMA alignment lost)");
    reasons.push("Price closes below entry zone");
    reasons.push("Time stop: no progress after 5 bars");
  } else if (direction === "bearish") {
    const nearestSupport = summary.supportResistance.find((l) => l.type === "support");
    if (nearestSupport) {
      reasons.push(`Price reaches support at ${nearestSupport.price.toFixed(4)}`);
    }
    reasons.push("Momentum shift (MACD-H slope reversal on Elder Impulse)");
    reasons.push("Elder Impulse turns GREEN (buying pressure)");
    if (summary.rsi.value < 35) {
      reasons.push(`RSI approaching oversold (${summary.rsi.value.toFixed(0)})`);
    }
    reasons.push("Trend Stack breaks down (EMA alignment lost)");
    reasons.push("Price closes above entry zone");
    reasons.push("Time stop: no progress after 5 bars");
  }

  return reasons.slice(0, 5);
}

// ==================== POSITION SIZING ====================

function calculatePositionSize(
  riskPercent: number,
  _entryPrice: number,
  _stopLoss: number,
  _pipSize: number
): { lots: number; riskAmount: number } {
  // Without account equity, we can't calculate actual lot sizes or dollar risk.
  // The system still tracks riskPercent for conviction-based scaling.
  void _entryPrice; void _stopLoss; void _pipSize;
  return { lots: 0, riskAmount: 0 };
}

// ==================== MASTER FUNCTION ====================

export function generateTradeDeskSetup(
  candles: OHLCV[],
  summary: TechnicalSummary,
  instrument: Instrument,
  riskPercent: number = 2,
  confluencePatterns?: Record<string, ConfluencePattern>,
  tradingStyle?: TradingStyle,
  systemPerformance?: Record<string, SystemPerformance>,
  overrideParams?: { slMultiplier?: number; tpMultipliers?: [number, number, number]; entrySpreadMultiplier?: number },
  previousPhase?: MarketPhase,
  sessionScore?: number,
): TradeDeskSetup {
  // 1. Detect regime (pass candles for full multi-dimensional regime)
  const { regime, label: regimeLabel, fullRegime } = detectRegime(summary, candles, previousPhase);
  const impulseColor = summary.impulse.color;

  // 2. Analyze market structure BEFORE signal generation (HH/HL/BOS/CHoCH)
  // Structure gates which directions are allowed — this prevents generating
  // signals that contradict the swing structure, then trying to filter them later.
  const marketStructure = analyzeMarketStructure(candles);

  // 2b. No-trade engine — evaluate mechanical blackout conditions
  const noTradeResult = evaluateNoTrade(
    sessionScore ?? 75,
    fullRegime,
    marketStructure?.structureScore,
    false, // dataStale is checked at hook level
  );

  // 2c. ICT context — detect FVG, institutional candles, S/D zones early (SFP/IDF need them)
  const atrVal = summary.atr.value;
  const fairValueGaps = detectFairValueGaps(candles, atrVal);
  const institutionalCandles = detectInstitutionalCandles(candles, atrVal);
  const consolidationBreakouts = detectConsolidationBreakouts(candles, atrVal, institutionalCandles);
  // 5-day zone freshness cutoff: compute max age in bars based on timeframe
  const BARS_PER_DAY: Record<string, number> = { "5m": 288, "15m": 96, "1h": 24, "4h": 6, "1d": 1 };
  const barsPerDay = BARS_PER_DAY[summary.timeframe] ?? 24;
  const maxZoneAgeBars = barsPerDay * 5; // 5 trading days

  const { supplyZones, demandZones } = detectSupplyDemandZones(candles, atrVal, maxZoneAgeBars);
  const allSDZones: SupplyDemandZone[] = [...supplyZones, ...demandZones];

  // 2d. SFP + IDF detection (depends on market structure + FVG/IC)
  const sfpResult = marketStructure ? detectSFP(candles, marketStructure, atrVal) : null;
  const idfResult = marketStructure
    ? detectIDF(candles, fairValueGaps, institutionalCandles, marketStructure, atrVal)
    : null;

  // 2e. OB Retest detection (depends on supply/demand zones)
  const obRetestResult = detectOBRetest(candles, supplyZones, demandZones, atrVal, maxZoneAgeBars);

  // 3. Run all mechanical systems (regime-gated: non-matching signals already excluded)
  // Audit v4: 7 signals across 5 independent clusters (trend, mean_reversion, momentum, volume, reversal)
  let signals: MechanicalSignal[] = [
    trendAlignmentSignal(summary, regime, fullRegime),
    rsiExtremesSignal(summary, candles, regime, fullRegime),
    impulseSignal(summary),
    volumeConfirmationSignal(summary, candles),
    sfpSignal(sfpResult, fullRegime),
    idfSignal(idfResult),
    obRetestSignal(obRetestResult, fullRegime),
  ];

  // 3b. Apply system performance weights (auto-kill weak systems)
  // Use regime-adaptive weights: prefer regime-specific weight (e.g., "Trend Stack::trending_up")
  // over global weight when enough data exists. This lets the system learn which
  // signals work best in which market conditions.
  if (systemPerformance && Object.keys(systemPerformance).length > 0) {
    const weights = getRegimeAdaptiveWeights(systemPerformance, regime);
    signals = applySystemWeights(signals, weights);

    // 3b2. Hard kill/probation layer (requires 30+ trades for actionable decisions)
    const health = evaluateSignalHealth(systemPerformance);
    signals = applySignalHealth(signals, health);
  }

  // 3c. Structure direction gate — filter signals against structure.
  // Only longs allowed in bullish structure, only shorts in bearish.
  // Neutral structure allows both directions (structure is ambiguous).
  // CHoCH relaxation: if a recent Change of Character was detected,
  // allow opposing signals through at 50% strength to capture early reversals.
  if (marketStructure && marketStructure.latestStructure !== "neutral") {
    const structDir = marketStructure.latestStructure;
    const hasRecentCHoCH = marketStructure.lastCHoCH !== null && (() => {
      const chochIndex = marketStructure.lastCHoCH!.swingBroken.index;
      return (candles.length - 1 - chochIndex) <= 10;
    })();

    signals = signals.map((s) => {
      if (s.direction === "neutral" || s.strength === 0) return s;
      const opposing =
        (structDir === "bullish" && s.direction === "bearish") ||
        (structDir === "bearish" && s.direction === "bullish");
      if (opposing) {
        if (hasRecentCHoCH) {
          // Controlled contradiction: allow through at 50% strength
          return {
            ...s,
            strength: Math.round(s.strength * 0.5),
            description: s.description + ` [structure-softened: CHoCH detected, 50% strength]`,
          };
        }
        // Hard filter: no CHoCH, full block
        return {
          ...s,
          direction: "neutral" as const,
          strength: 0,
          description: s.description + ` [structure-filtered: ${structDir} structure]`,
        };
      }
      return s;
    });
  }

  // 3b. Build ICT context for conviction + setup (FVG/IC already computed at step 2c)
  const currentPrice = summary.currentPrice;
  const prelimDirection = (() => {
    const b = signals.filter((s) => s.direction === "bullish").length;
    const be = signals.filter((s) => s.direction === "bearish").length;
    return b > be ? "bullish" : be > b ? "bearish" : "neutral";
  })();

  const nearestFVG = fairValueGaps.length > 0
    ? (() => {
        const sorted = [...fairValueGaps]
          .filter((f) => f.freshness !== "filled")
          .sort((a, b) => Math.abs(a.midpoint - currentPrice) - Math.abs(b.midpoint - currentPrice));
        const nearest = sorted[0];
        return nearest ? { type: nearest.type, midpoint: nearest.midpoint, freshness: nearest.freshness } : null;
      })()
    : null;

  const nearestOB = allSDZones.length > 0
    ? (() => {
        const obs = allSDZones.filter((z) => z.isOrderBlock && z.freshness !== "broken");
        const sorted = obs.sort((a, b) => {
          const aMid = (a.priceHigh + a.priceLow) / 2;
          const bMid = (b.priceHigh + b.priceLow) / 2;
          return Math.abs(aMid - currentPrice) - Math.abs(bMid - currentPrice);
        });
        const nearest = sorted[0];
        return nearest ? { type: nearest.type, high: nearest.priceHigh, low: nearest.priceLow, strength: nearest.strength } : null;
      })()
    : null;

  const displacementDetected = institutionalCandles.length > 0 &&
    institutionalCandles.some((ic) => {
      if (prelimDirection === "neutral") return false;
      return ic.type === prelimDirection && ic.displacementScore >= 60;
    });

  const consolidationBreakout = consolidationBreakouts.length > 0 &&
    consolidationBreakouts.some((cb) => cb.breakoutDirection === prelimDirection);

  const ictScore = Math.min(100, Math.round(
    (nearestFVG && nearestFVG.freshness === "fresh" ? 30 : nearestFVG ? 15 : 0) +
    (nearestOB ? Math.min(30, nearestOB.strength * 0.3) : 0) +
    (displacementDetected ? 25 : 0) +
    (consolidationBreakout ? 15 : 0)
  ));

  const ictContext: TradeDeskSetup["ictContext"] = {
    nearestFVG,
    nearestOB,
    displacementDetected,
    consolidationBreakout,
    ictScore,
    sfpDetected: sfpResult && sfpResult.detected
      ? { direction: sfpResult.direction, strength: sfpResult.strength, description: `SFP swept ${sfpResult.direction === "bullish" ? "low" : "high"} at ${sfpResult.sweptSwingPrice.toFixed(5)}, wick ${sfpResult.wickLengthATR.toFixed(1)}×ATR` }
      : null,
    idfDetected: idfResult && idfResult.detected
      ? { direction: idfResult.direction, strength: idfResult.strength, structureBreakConfirmed: idfResult.structureBreakConfirmed }
      : null,
    obRetestDetected: obRetestResult && obRetestResult.detected
      ? { direction: obRetestResult.direction, strength: obRetestResult.strength, zone: obRetestResult.zone! }
      : null,
  };

  // 4. Calculate conviction (pass fullRegime + structure + ICT for phase-aware scoring)
  const adx = summary.adx.adx;
  const { tier, score: convictionScore, direction, activeClusters: convictionClusters } = calculateConviction(signals, regime, impulseColor, adx, fullRegime, marketStructure, ictContext);

  // 4. Consensus
  const bullish = signals.filter((s) => s.direction === "bullish").length;
  const bearish = signals.filter((s) => s.direction === "bearish").length;
  const neutral = signals.filter((s) => s.direction === "neutral").length;

  // 5. Resolve trading style and apply style-specific parameters
  const style: TradingStyle = tradingStyle ?? "swing";
  const params = overrideParams
    ? { ...STYLE_PARAMS[style], ...overrideParams }
    : STYLE_PARAMS[style];
  const tf: "1h" | "4h" = style === "intraday" ? "1h" : "4h";

  const atr = summary.atr.value;
  const price = summary.currentPrice;
  const isBullish = direction === "bullish";
  const dir = isBullish ? 1 : -1;

  const entrySpread = atr * params.entrySpreadMultiplier;
  const entry: [number, number] = isBullish
    ? [price - entrySpread, price]
    : [price, price + entrySpread];

  const slDistance = atr * params.slMultiplier;
  const stopLoss = price - dir * slDistance;

  const tp1 = price + dir * atr * params.tpMultipliers[0];
  const tp2 = price + dir * atr * params.tpMultipliers[1];
  const tp3 = price + dir * atr * params.tpMultipliers[2];
  const takeProfit: [number, number, number] = [tp1, tp2, tp3];

  // 5b. Snap levels to structural S/R, pivots, fibs, FVG midpoints
  const snapped = snapLevelsToStructure(
    summary, direction, price, atr, entry, stopLoss, takeProfit, fairValueGaps
  );

  // 5c. Entry optimization — candle patterns + pullback + ICT patterns
  const entryOpt = analyzeEntryOptimization(candles, direction, atr, snapped.entry, fairValueGaps, allSDZones);
  if (entryOpt.refinedEntry) {
    snapped.entry = entryOpt.refinedEntry;
  }

  // 5d. Execution cost modeling — widen SL by spread + slippage, recalculate R:R
  const execCost = calculateExecutionCost(
    instrument.id,
    instrument.pipSize,
    fullRegime?.atrPercentile ?? 50,
    sessionScore ?? 75,
  );
  snapped.stopLoss = adjustStopLossForSpread(snapped.stopLoss, direction, execCost.totalCostPrice);
  snapped.riskReward = adjustRiskReward(
    (snapped.entry[0] + snapped.entry[1]) / 2,
    snapped.stopLoss,
    snapped.takeProfit,
    execCost.totalCostPrice,
    direction
  );

  // 5e. Volatility targeting — scale risk inversely to vol (blended ATR + return-based)
  // Use category-specific vol targets so crypto (50-80% annual vol) doesn't always
  // floor at 0.5x, and forex (8-12%) doesn't always get boosted.
  const CATEGORY_VOL_TARGETS: Record<string, number> = {
    forex: 0.08,
    commodity: 0.15,
    index: 0.15,
    crypto: 0.40,
  };
  const categoryVolTarget = CATEGORY_VOL_TARGETS[instrument.category] ?? 0.10;
  const volTarget = calculateVolTargetMultiplier(atr, price, categoryVolTarget, candles);

  // 6. Position sizing — conviction-scaled risk × vol multiplier (Hougaard: size up on best setups)
  const tierRiskMultiplier: Record<ConvictionTier, number> = {
    "A+": 1.25, // 2.5% risk at base 2%
    "A":  1.0,  // 2.0% risk (base)
    "B":  0.75, // 1.5% risk
    "C":  0.5,  // 1.0% risk
    "D":  0.25, // 0.5% risk
  };
  const adjustedRisk = riskPercent * tierRiskMultiplier[tier] * volTarget.multiplier * noTradeResult.positionMultiplier;
  const { lots, riskAmount } = calculatePositionSize(
    adjustedRisk,
    price,
    snapped.stopLoss,
    instrument.pipSize
  );

  // 7. Reasons to exit
  const reasonsToExit = generateReasonsToExit(direction, signals, summary);

  // 8. Apply confluence learning (if patterns available)
  const baseSetup: TradeDeskSetup = {
    instrumentId: instrument.id,
    displayName: instrument.displayName,
    symbol: instrument.symbol,
    category: instrument.category,
    regime,
    regimeLabel,
    adx,
    tradingStyle: style,
    timeframe: tf,
    impulse: impulseColor,
    signals,
    conviction: tier,
    convictionScore,
    direction,
    consensus: { bullish, bearish, neutral },
    currentPrice: price,
    atr,
    entry: snapped.entry,
    stopLoss: snapped.stopLoss,
    takeProfit: snapped.takeProfit,
    riskReward: snapped.riskReward,
    positionSizeLots: lots,
    riskAmount,
    reasonsToExit,
    fullRegime,
    marketStructure: marketStructure ?? undefined,
    entryOptimization: entryOpt.signals.length > 0 ? entryOpt : undefined,
    ictContext: ictScore > 0 ? ictContext : undefined,
    executionCost: {
      spreadPips: execCost.spreadPips,
      slippagePips: execCost.slippagePips,
      totalCostPips: execCost.totalCostPips,
    },
    volatilityTarget: {
      currentVol: volTarget.currentAnnualVol,
      multiplier: volTarget.multiplier,
    },
    noTradeResult: noTradeResult.severity !== "none" ? noTradeResult : undefined,
  };

  if (confluencePatterns) {
    // Regime-specific learning: prefer pattern scoped to current structure+phase.
    // Falls back to legacy key (instrument+regime+impulse+style) if regime-specific
    // key doesn't have enough data. This ensures learning tracks performance
    // separately for each market regime, which is more statistically meaningful.
    const regimeKey = buildRegimeConfluenceKey(baseSetup);
    const legacyKey = buildConfluenceKey(baseSetup);
    const regimePattern = confluencePatterns[regimeKey] ?? null;
    const legacyPattern = confluencePatterns[legacyKey] ?? null;

    // Use regime-specific pattern if it has enough trades, otherwise fall back.
    // Regime-lock: when falling back to legacy key (which pools all regimes),
    // dampen adjustments by 50% to prevent learning from overriding real-time conditions.
    const useRegimeKey = regimePattern && regimePattern.trades >= 20;
    const pattern = useRegimeKey ? regimePattern : legacyPattern;
    const regimeDampen = useRegimeKey ? 1.0 : 0.5;
    const learning = applyLearning(convictionScore, riskAmount, lots, pattern, regimeDampen);

    if (learning.applied) {
      baseSetup.convictionScore = learning.adjustedScore;
      baseSetup.conviction = adjustedTier(learning.adjustedScore, convictionClusters);
      baseSetup.riskAmount = learning.adjustedRisk;
      baseSetup.positionSizeLots = learning.adjustedLots;
      baseSetup.learningApplied = {
        riskMultiplier: learning.riskMultiplier,
        convictionAdjust: learning.convictionAdjust,
        winRate: learning.winRate,
        trades: learning.trades,
      };
    }
  }

  return baseSetup;
}

// ==================== RANKING ====================

export function rankSetupsByConviction(setups: TradeDeskSetup[]): TradeDeskSetup[] {
  const tierOrder: Record<ConvictionTier, number> = {
    "A+": 5, "A": 4, "B": 3, "C": 2, "D": 1,
  };

  return [...setups]
    .filter((s) =>
      s.conviction !== "D" &&
      s.conviction !== "C" &&       // B and above: legitimate 2+ cluster setups
      s.direction !== "neutral" &&
      s.riskReward[0] >= 1.5 &&     // Minimum R:R gate — no edge below 1.5
      // Elder hard gate: NEVER trade against impulse color
      !(s.direction === "bullish" && s.impulse === "red") &&
      !(s.direction === "bearish" && s.impulse === "green") &&
      // No-trade engine hard block: reject setups in dead/stale/volatile-reversal conditions
      !(s.noTradeResult && !s.noTradeResult.canTrade)
    )
    .sort((a, b) => {
      const tierDiff = tierOrder[b.conviction] - tierOrder[a.conviction];
      if (tierDiff !== 0) return tierDiff;
      return b.convictionScore - a.convictionScore;
    });
}
