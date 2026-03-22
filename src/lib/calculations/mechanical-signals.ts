import type { OHLCV } from "@/lib/types/market";
import type { TechnicalSummary, SupportResistanceLevel, PivotPointResult, FibonacciLevel } from "@/lib/types/indicators";
import type {
  MarketRegime,
  FullRegime,
  ImpulseColor,
  ConvictionTier,
  MechanicalSignal,
  TradeDeskSetup,
  ConfluencePattern,
  TradingStyle,
} from "@/lib/types/signals";
import type { Instrument } from "@/lib/types/market";
import { calcSMA, calcEMA } from "./technical-indicators";
import { applyLearning, adjustedTier } from "./confluence-learning";
import { buildConfluenceKey } from "./setup-tracker";
import { detectFullRegime } from "./regime-engine";
import { analyzeMarketStructure } from "./market-structure";
import { computeDeCorrelatedAgreement } from "./signal-clustering";
import { applySystemWeights, type SystemPerformance } from "./system-performance";
import { analyzeEntryOptimization } from "./entry-optimization";
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
    // Markdown with high vol: short intraday exposure
    if (fullRegime.phase === "markdown" && fullRegime.volatility === "high") return "intraday";
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
  atrTP: [number, number, number]
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
  if (levels.length === 0) {
    return { entry: atrEntry, stopLoss: atrSL, takeProfit: atrTP, riskReward: [1.5, 2.5, 3.5] };
  }

  const isBull = direction === "bullish";
  let snappedSL = atrSL;
  let snappedEntry: [number, number] = [...atrEntry];
  let snappedTP: [number, number, number] = [...atrTP];

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

export function detectRegime(summary: TechnicalSummary, candles?: OHLCV[]): {
  regime: MarketRegime;
  label: string;
  fullRegime?: FullRegime;
} {
  // If candles provided, use the full multi-dimensional regime engine
  if (candles && candles.length >= 50) {
    const fullRegime = detectFullRegime(candles, summary);
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

function maSignal(candles: OHLCV[], regime: MarketRegime): MechanicalSignal {
  // Weissman: SMA(9) crosses SMA(26) — best overall trend system
  const closes = candles.map((c) => c.close);
  const sma9 = calcSMA(closes, 9);
  const sma26 = calcSMA(closes, 26);

  if (sma9.length < 2 || sma26.length < 2) {
    return {
      system: "MA Crossover",
      type: "trend",
      direction: "neutral",
      strength: 0,
      description: "Insufficient data",
      regimeMatch: false,
    };
  }

  const offset = sma9.length - sma26.length;
  const curr9 = sma9[sma9.length - 1];
  const prev9 = sma9[sma9.length - 2];
  const curr26 = sma26[sma26.length - 1];
  const prev26 = sma26[sma26.length - 2];

  let direction: "bullish" | "bearish" | "neutral" = "neutral";
  let description = "No crossover";
  let strength = 30;

  // Fresh crossover
  if (prev9 <= prev26 && curr9 > curr26) {
    direction = "bullish";
    description = "SMA(9) crossed above SMA(26) — bullish crossover";
    strength = 85;
  } else if (prev9 >= prev26 && curr9 < curr26) {
    direction = "bearish";
    description = "SMA(9) crossed below SMA(26) — bearish crossover";
    strength = 85;
  } else if (curr9 > curr26) {
    direction = "bullish";
    const spread = ((curr9 - curr26) / curr26) * 100;
    description = `SMA(9) above SMA(26), spread ${spread.toFixed(3)}%`;
    strength = Math.min(70, 40 + spread * 200);
  } else if (curr9 < curr26) {
    direction = "bearish";
    const spread = ((curr26 - curr9) / curr9) * 100;
    description = `SMA(9) below SMA(26), spread ${spread.toFixed(3)}%`;
    strength = Math.min(70, 40 + spread * 200);
  }

  const isTrending = regime === "trending_up" || regime === "trending_down";
  // Weissman: trend signals are noise in ranging markets — reduce strength
  if (!isTrending && direction !== "neutral") strength = Math.round(strength * 0.6);
  return {
    system: "MA Crossover",
    type: "trend",
    direction,
    strength,
    description,
    regimeMatch: isTrending,
  };
}

function macdSignal(summary: TechnicalSummary, regime: MarketRegime): MechanicalSignal {
  // Weissman: EMA(12)-EMA(26) crossover with signal line
  const { macd, signal, histogram, crossover } = summary.macd;

  let direction: "bullish" | "bearish" | "neutral" = "neutral";
  let description = "MACD neutral";
  let strength = 30;

  if (crossover === "bullish") {
    direction = "bullish";
    description = "MACD bullish crossover — signal line break";
    strength = 85;
  } else if (crossover === "bearish") {
    direction = "bearish";
    description = "MACD bearish crossover — signal line break";
    strength = 85;
  } else if (histogram > 0) {
    direction = "bullish";
    description = `MACD histogram positive (${histogram.toFixed(5)})`;
    strength = Math.min(65, 35 + Math.abs(histogram) * 5000);
  } else if (histogram < 0) {
    direction = "bearish";
    description = `MACD histogram negative (${histogram.toFixed(5)})`;
    strength = Math.min(65, 35 + Math.abs(histogram) * 5000);
  }

  const isTrending = regime === "trending_up" || regime === "trending_down";
  if (!isTrending && direction !== "neutral") strength = Math.round(strength * 0.6);
  return {
    system: "MACD",
    type: "trend",
    direction,
    strength,
    description,
    regimeMatch: isTrending,
  };
}

function bbBreakoutSignal(summary: TechnicalSummary, regime: MarketRegime): MechanicalSignal {
  // Weissman: Close > Upper BB = bullish breakout, Close < Lower BB = bearish breakout
  const { upper, lower, middle, percentB } = summary.bollingerBands;
  const price = summary.currentPrice;

  let direction: "bullish" | "bearish" | "neutral" = "neutral";
  let description = "Price within Bollinger Bands";
  let strength = 20;

  if (price > upper) {
    direction = "bullish";
    description = `Price broke above upper BB (${upper.toFixed(4)}) — breakout`;
    strength = 80;
  } else if (price < lower) {
    direction = "bearish";
    description = `Price broke below lower BB (${lower.toFixed(4)}) — breakdown`;
    strength = 80;
  } else if (percentB > 0.9) {
    direction = "bullish";
    description = `Price testing upper BB (%B: ${(percentB * 100).toFixed(0)}%)`;
    strength = 55;
  } else if (percentB < 0.1) {
    direction = "bearish";
    description = `Price testing lower BB (%B: ${(percentB * 100).toFixed(0)}%)`;
    strength = 55;
  }

  const isTrending = regime === "trending_up" || regime === "trending_down";
  if (!isTrending && direction !== "neutral") strength = Math.round(strength * 0.6);
  return {
    system: "BB Breakout",
    type: "trend",
    direction,
    strength,
    description,
    regimeMatch: isTrending,
  };
}

function rsiExtremesSignal(
  summary: TechnicalSummary,
  candles: OHLCV[],
  regime: MarketRegime
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

  const isRanging = regime === "ranging";
  const regimeMatch = isRanging || regime === "volatile";
  // Weissman: MR signals in trending markets are dangerous — reduce strength
  if (!regimeMatch && direction !== "neutral") strength = Math.round(strength * 0.6);
  return {
    system: "RSI Extremes",
    type: "mean_reversion",
    direction,
    strength,
    description,
    regimeMatch,
  };
}

function bbMeanReversionSignal(
  summary: TechnicalSummary,
  candles: OHLCV[],
  regime: MarketRegime
): MechanicalSignal {
  // Weissman: Close < Lower BB AND Close > SMA(200) = buy
  const closes = candles.map((c) => c.close);
  const price = summary.currentPrice;
  const { lower, upper } = summary.bollingerBands;

  const sma200 = calcSMA(closes, 200);
  const hasSma200 = sma200.length > 0;
  const aboveSma200 = hasSma200 && price > sma200[sma200.length - 1];
  const belowSma200 = hasSma200 && price < sma200[sma200.length - 1];

  let direction: "bullish" | "bearish" | "neutral" = "neutral";
  let description = "Price within bands";
  let strength = 20;

  if (price < lower && aboveSma200) {
    direction = "bullish";
    description = "Price below lower BB + above SMA(200) — mean reversion buy";
    strength = 80;
  } else if (price > upper && belowSma200) {
    direction = "bearish";
    description = "Price above upper BB + below SMA(200) — mean reversion sell";
    strength = 80;
  } else if (price < lower) {
    direction = "bullish";
    description = "Price below lower BB — partial MR signal (no SMA filter)";
    strength = 45;
  } else if (price > upper) {
    direction = "bearish";
    description = "Price above upper BB — partial MR signal (no SMA filter)";
    strength = 45;
  }

  const isRanging = regime === "ranging";
  const regimeMatch = isRanging || regime === "volatile";
  if (!regimeMatch && direction !== "neutral") strength = Math.round(strength * 0.6);
  return {
    system: "BB MR",
    type: "mean_reversion",
    direction,
    strength,
    description,
    regimeMatch,
  };
}

function impulseSignal(summary: TechnicalSummary): MechanicalSignal {
  // Elder: EMA(13) slope + MACD-H slope = GREEN/RED/BLUE
  const { color, emaSlope, macdHistogramSlope } = summary.impulse;

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

function elderRaySignal(summary: TechnicalSummary): MechanicalSignal {
  // Elder: Bull Power = High - EMA(13), Bear Power = Low - EMA(13)
  const { bullPower, bearPower } = summary.elderRay;

  let direction: "bullish" | "bearish" | "neutral" = "neutral";
  let description = "Elder-Ray neutral";
  let strength = 30;

  // EMA(13) direction from impulse data
  const emaRising = summary.impulse.emaSlope === "up";
  const emaFalling = summary.impulse.emaSlope === "down";

  // Best buy: EMA rising + Bear Power negative but rising toward zero
  if (emaRising && bearPower < 0) {
    direction = "bullish";
    description = `EMA(13) rising + Bear Power negative (${bearPower.toFixed(4)}) — buy signal`;
    strength = 70;
  } else if (emaFalling && bullPower > 0) {
    direction = "bearish";
    description = `EMA(13) falling + Bull Power positive (${bullPower.toFixed(4)}) — sell signal`;
    strength = 70;
  } else if (bearPower < 0 && bullPower > 0) {
    direction = "neutral";
    description = `Normal conditions — Bull ${bullPower.toFixed(4)}, Bear ${bearPower.toFixed(4)}`;
    strength = 30;
  }

  return {
    system: "Elder-Ray",
    type: "momentum",
    direction,
    strength,
    description,
    regimeMatch: true,
  };
}

function trendAlignmentSignal(summary: TechnicalSummary, regime: MarketRegime): MechanicalSignal {
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

  const isTrending = regime === "trending_up" || regime === "trending_down";
  if (!isTrending && direction !== "neutral") strength = Math.round(strength * 0.6);
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
  marketStructure?: MarketStructure | null
): { tier: ConvictionTier; score: number; direction: "bullish" | "bearish" | "neutral" } {
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
  const agreeing = direction === "bullish" ? bullish.length : bearish.length;

  // Conviction scoring
  let score = 0;

  // De-correlated agreement factor (0-40 pts)
  // Uses cluster-based scoring: only the best signal per cluster counts,
  // weighted by regime. This prevents correlated signals from inflating conviction.
  if (direction !== "neutral" && activeSignals > 0) {
    const { agreement } = computeDeCorrelatedAgreement(signals, direction, fullRegime);
    score += agreement;
  }

  // Regime match factor (0-25 pts)
  if (matched >= 3) score += 25;
  else if (matched >= 2) score += 15;
  else if (matched >= 1) score += 8;

  // Impulse alignment (-15 to +20 pts) — Elder: no longs on RED, no shorts on GREEN
  if (direction === "bullish" && impulseColor === "green") score += 20;
  else if (direction === "bearish" && impulseColor === "red") score += 20;
  else if (impulseColor === "blue") score += 5;
  else if (direction === "bullish" && impulseColor === "red") score -= 15;
  else if (direction === "bearish" && impulseColor === "green") score -= 15;

  // Strong signal bonus (0-15 pts)
  const strongSignals = signals.filter(
    (s) => s.direction === direction && s.strength >= 70
  ).length;
  score += Math.min(15, strongSignals * 5);

  // Phase-aware scoring (replaces simple ADX > 50 penalty)
  if (fullRegime) {
    // Distribution/markdown against bullish signals = strong penalty
    if ((fullRegime.phase === "distribution" || fullRegime.phase === "markdown") && direction === "bullish") {
      score -= 15;
    }
    // Accumulation against bearish signals = penalty
    if (fullRegime.phase === "accumulation" && direction === "bearish") {
      score -= 10;
    }
    // Expansion aligned with signal direction = bonus
    if (fullRegime.phase === "expansion") {
      const expansionAligned =
        (direction === "bullish" && fullRegime.emaSlope > 0) ||
        (direction === "bearish" && fullRegime.emaSlope < 0);
      if (expansionAligned) score += 10;
    }
    // High volatility exhaustion (replaces raw ADX > 50 check)
    if (fullRegime.volatility === "high" && fullRegime.adxTrend === "falling") {
      score -= 10; // Exhaustion: high vol + ADX decelerating
    }
  } else {
    // Legacy fallback: ADX exhaustion penalty
    if (adx > 50) score -= 10;
  }

  // Market structure alignment (-15 to +10 pts)
  if (marketStructure) {
    const structDir = marketStructure.latestStructure;
    if (direction === "bullish" && structDir === "bullish") score += 10;
    else if (direction === "bearish" && structDir === "bearish") score += 10;
    else if (direction === "bullish" && structDir === "bearish") score -= 10;
    else if (direction === "bearish" && structDir === "bullish") score -= 10;

    // Recent CHoCH against direction = strong warning
    if (marketStructure.lastCHoCH) {
      if (direction === "bullish" && marketStructure.lastCHoCH.direction === "bearish") score -= 15;
      else if (direction === "bearish" && marketStructure.lastCHoCH.direction === "bullish") score -= 15;
    }

    // Recent BOS aligned = minor bonus
    if (marketStructure.lastBOS) {
      if (marketStructure.lastBOS.direction === direction) score += 5;
    }
  }

  // Map to tier
  let tier: ConvictionTier;
  if (score >= 75 && agreeing >= 5) tier = "A+";
  else if (score >= 60 && agreeing >= 4) tier = "A";
  else if (score >= 40 && agreeing >= 3) tier = "B";
  else if (score >= 25 && agreeing >= 2) tier = "C";
  else tier = "D";

  return { tier, score: Math.max(0, Math.min(100, score)), direction };
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
    reasons.push("MACD bearish crossover develops");
    reasons.push("Elder Impulse turns RED (selling pressure)");
    if (summary.rsi.value > 65) {
      reasons.push(`RSI approaching overbought (${summary.rsi.value.toFixed(0)})`);
    }
    reasons.push("SMA(9) crosses below SMA(26)");
    reasons.push("Price closes below entry zone");
    reasons.push("Time stop: no progress after 5 bars");
  } else if (direction === "bearish") {
    const nearestSupport = summary.supportResistance.find((l) => l.type === "support");
    if (nearestSupport) {
      reasons.push(`Price reaches support at ${nearestSupport.price.toFixed(4)}`);
    }
    reasons.push("MACD bullish crossover develops");
    reasons.push("Elder Impulse turns GREEN (buying pressure)");
    if (summary.rsi.value < 35) {
      reasons.push(`RSI approaching oversold (${summary.rsi.value.toFixed(0)})`);
    }
    reasons.push("SMA(9) crosses above SMA(26)");
    reasons.push("Price closes above entry zone");
    reasons.push("Time stop: no progress after 5 bars");
  }

  return reasons.slice(0, 5);
}

// ==================== POSITION SIZING ====================

function calculatePositionSize(
  accountEquity: number,
  riskPercent: number,
  entryPrice: number,
  stopLoss: number,
  pipSize: number
): { lots: number; riskAmount: number } {
  const riskAmount = accountEquity * (riskPercent / 100);
  const stopDistance = Math.abs(entryPrice - stopLoss);

  if (stopDistance === 0) return { lots: 0, riskAmount };

  // Position size in units (for forex, 1 lot = 100,000 units)
  const pipsAtRisk = stopDistance / pipSize;
  const pipValue = pipSize * 100000; // Standard lot pip value
  const lots = pipsAtRisk > 0 ? riskAmount / (pipsAtRisk * pipValue) : 0;

  return {
    lots: Number(Math.max(0.01, lots).toFixed(2)),
    riskAmount: Number(riskAmount.toFixed(0)),
  };
}

// ==================== MASTER FUNCTION ====================

export function generateTradeDeskSetup(
  candles: OHLCV[],
  summary: TechnicalSummary,
  instrument: Instrument,
  accountEquity: number = 10000,
  riskPercent: number = 2,
  confluencePatterns?: Record<string, ConfluencePattern>,
  tradingStyle?: TradingStyle,
  systemPerformance?: Record<string, SystemPerformance>
): TradeDeskSetup {
  // 1. Detect regime (pass candles for full multi-dimensional regime)
  const { regime, label: regimeLabel, fullRegime } = detectRegime(summary, candles);
  const impulseColor = summary.impulse.color;

  // 2. Run all mechanical systems
  let signals: MechanicalSignal[] = [
    maSignal(candles, regime),
    macdSignal(summary, regime),
    bbBreakoutSignal(summary, regime),
    rsiExtremesSignal(summary, candles, regime),
    bbMeanReversionSignal(summary, candles, regime),
    impulseSignal(summary),
    elderRaySignal(summary),
    trendAlignmentSignal(summary, regime),
  ];

  // 2b. Apply system performance weights (auto-kill weak systems)
  if (systemPerformance && Object.keys(systemPerformance).length > 0) {
    const weights: Record<string, number> = {};
    for (const [key, perf] of Object.entries(systemPerformance)) {
      weights[key] = perf.weight;
    }
    signals = applySystemWeights(signals, weights);
  }

  // 3. Analyze market structure (HH/HL/BOS/CHoCH)
  const marketStructure = analyzeMarketStructure(candles);

  // 4. Calculate conviction (pass fullRegime + structure for phase-aware scoring)
  const adx = summary.adx.adx;
  const { tier, score: convictionScore, direction } = calculateConviction(signals, regime, impulseColor, adx, fullRegime, marketStructure);

  // 4. Consensus
  const bullish = signals.filter((s) => s.direction === "bullish").length;
  const bearish = signals.filter((s) => s.direction === "bearish").length;
  const neutral = signals.filter((s) => s.direction === "neutral").length;

  // 5. Resolve trading style and apply style-specific parameters
  const style: TradingStyle = tradingStyle ?? "swing";
  const params = STYLE_PARAMS[style];
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

  // 5b. Snap levels to structural S/R, pivots, fibs
  const snapped = snapLevelsToStructure(
    summary, direction, price, atr, entry, stopLoss, takeProfit
  );

  // 5c. Entry optimization — candle patterns + pullback detection
  const entryOpt = analyzeEntryOptimization(candles, direction, atr, snapped.entry);
  if (entryOpt.refinedEntry) {
    snapped.entry = entryOpt.refinedEntry;
  }

  // 6. Position sizing — conviction-scaled risk (Hougaard: size up on best setups)
  const tierRiskMultiplier: Record<ConvictionTier, number> = {
    "A+": 1.25, // 2.5% risk at base 2%
    "A":  1.0,  // 2.0% risk (base)
    "B":  0.75, // 1.5% risk
    "C":  0.5,  // 1.0% risk
    "D":  0.25, // 0.5% risk
  };
  const adjustedRisk = riskPercent * tierRiskMultiplier[tier];
  const { lots, riskAmount } = calculatePositionSize(
    accountEquity,
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
  };

  if (confluencePatterns) {
    const confKey = buildConfluenceKey(baseSetup);
    const pattern = confluencePatterns[confKey] ?? null;
    const learning = applyLearning(convictionScore, riskAmount, lots, pattern);

    if (learning.applied) {
      baseSetup.convictionScore = learning.adjustedScore;
      baseSetup.conviction = adjustedTier(learning.adjustedScore);
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
      s.conviction !== "C" &&
      s.conviction !== "B" &&       // Bellafiore: only trade A+/A quality
      s.direction !== "neutral" &&
      s.riskReward[0] >= 1.5 &&     // Minimum R:R gate — no edge below 1.5
      // Elder hard gate: NEVER trade against impulse color
      !(s.direction === "bullish" && s.impulse === "red") &&
      !(s.direction === "bearish" && s.impulse === "green")
    )
    .sort((a, b) => {
      const tierDiff = tierOrder[b.conviction] - tierOrder[a.conviction];
      if (tierDiff !== 0) return tierDiff;
      return b.convictionScore - a.convictionScore;
    });
}
