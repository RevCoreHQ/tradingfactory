import type { OHLCV } from "@/lib/types/market";
import type { TechnicalSummary } from "@/lib/types/indicators";
import type {
  MarketRegime,
  ImpulseColor,
  ConvictionTier,
  MechanicalSignal,
  TradeDeskSetup,
  ConfluencePattern,
} from "@/lib/types/signals";
import type { Instrument } from "@/lib/types/market";
import { calcSMA, calcEMA } from "./technical-indicators";
import { applyLearning, adjustedTier } from "./confluence-learning";
import { buildConfluenceKey } from "./setup-tracker";

// ==================== REGIME DETECTION ====================

export function detectRegime(summary: TechnicalSummary): {
  regime: MarketRegime;
  label: string;
} {
  const adx = summary.adx.adx;
  const plusDI = summary.adx.plusDI;
  const minusDI = summary.adx.minusDI;

  if (adx > 50) {
    return { regime: "volatile", label: `Volatile (ADX ${adx.toFixed(0)})` };
  }
  if (adx > 20) {
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
  // Weissman: EMA(13)-EMA(26) crossover with signal line
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
  // Weissman: RSI(9)<35 AND Close>SMA(200) = buy; RSI(9)>65 AND Close<SMA(200) = sell
  const closes = candles.map((c) => c.close);
  const price = summary.currentPrice;

  // Compute RSI(9) from candles
  let rsi9 = summary.rsi.value; // Fallback to RSI(14)
  if (closes.length > 10) {
    // Quick RSI(9) calculation
    const period = 9;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff; else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi9 = 100 - 100 / (1 + rs);
  }

  // SMA(200) filter
  const sma200 = calcSMA(closes, 200);
  const hasSma200 = sma200.length > 0;
  const aboveSma200 = hasSma200 && price > sma200[sma200.length - 1];
  const belowSma200 = hasSma200 && price < sma200[sma200.length - 1];

  let direction: "bullish" | "bearish" | "neutral" = "neutral";
  let description = `RSI(9) at ${rsi9.toFixed(0)}`;
  let strength = 20;

  if (rsi9 < 35 && aboveSma200) {
    direction = "bullish";
    description = `RSI(9) oversold (${rsi9.toFixed(0)}) + price above SMA(200) — mean reversion buy`;
    strength = 80;
  } else if (rsi9 > 65 && belowSma200) {
    direction = "bearish";
    description = `RSI(9) overbought (${rsi9.toFixed(0)}) + price below SMA(200) — mean reversion sell`;
    strength = 80;
  } else if (rsi9 < 35) {
    direction = "bullish";
    description = `RSI(9) oversold (${rsi9.toFixed(0)}) — needs SMA(200) filter confirmation`;
    strength = 50;
  } else if (rsi9 > 65) {
    direction = "bearish";
    description = `RSI(9) overbought (${rsi9.toFixed(0)}) — needs SMA(200) filter confirmation`;
    strength = 50;
  }

  const isRanging = regime === "ranging";
  return {
    system: "RSI Extremes",
    type: "mean_reversion",
    direction,
    strength,
    description,
    regimeMatch: isRanging || regime === "volatile",
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
  return {
    system: "BB MR",
    type: "mean_reversion",
    direction,
    strength,
    description,
    regimeMatch: isRanging || regime === "volatile",
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
  impulseColor: ImpulseColor
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

  // Agreement factor (0-40 pts)
  if (activeSignals > 0) {
    score += (agreeing / activeSignals) * 40;
  }

  // Regime match factor (0-25 pts)
  if (matched >= 3) score += 25;
  else if (matched >= 2) score += 15;
  else if (matched >= 1) score += 8;

  // Impulse alignment (0-20 pts)
  if (direction === "bullish" && impulseColor === "green") score += 20;
  else if (direction === "bearish" && impulseColor === "red") score += 20;
  else if (impulseColor === "blue") score += 5;

  // Strong signal bonus (0-15 pts)
  const strongSignals = signals.filter(
    (s) => s.direction === direction && s.strength >= 70
  ).length;
  score += Math.min(15, strongSignals * 5);

  // Map to tier
  let tier: ConvictionTier;
  if (score >= 75 && agreeing >= 5) tier = "A+";
  else if (score >= 60 && agreeing >= 4) tier = "A";
  else if (score >= 40 && agreeing >= 3) tier = "B";
  else if (score >= 25 && agreeing >= 2) tier = "C";
  else tier = "D";

  return { tier, score: Math.min(100, score), direction };
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
  const lots = pipsAtRisk > 0 ? riskAmount / (pipsAtRisk * pipValue * pipSize) : 0;

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
  confluencePatterns?: Record<string, ConfluencePattern>
): TradeDeskSetup {
  // 1. Detect regime
  const { regime, label: regimeLabel } = detectRegime(summary);
  const impulseColor = summary.impulse.color;

  // 2. Run all mechanical systems
  const signals: MechanicalSignal[] = [
    maSignal(candles, regime),
    macdSignal(summary, regime),
    bbBreakoutSignal(summary, regime),
    rsiExtremesSignal(summary, candles, regime),
    bbMeanReversionSignal(summary, candles, regime),
    impulseSignal(summary),
    elderRaySignal(summary),
    trendAlignmentSignal(summary, regime),
  ];

  // 3. Calculate conviction
  const { tier, score: convictionScore, direction } = calculateConviction(signals, regime, impulseColor);

  // 4. Consensus
  const bullish = signals.filter((s) => s.direction === "bullish").length;
  const bearish = signals.filter((s) => s.direction === "bearish").length;
  const neutral = signals.filter((s) => s.direction === "neutral").length;

  // 5. Entry/SL/TP (using ATR-based levels)
  const atr = summary.atr.value;
  const price = summary.currentPrice;
  const isBullish = direction === "bullish";
  const dir = isBullish ? 1 : -1;

  const entrySpread = atr * 0.25;
  const entry: [number, number] = isBullish
    ? [price - entrySpread, price]
    : [price, price + entrySpread];

  const slDistance = atr * 1.0; // 1 ATR stop (Elder: 2-bar low/high)
  const stopLoss = price - dir * slDistance;

  const tp1 = price + dir * atr * 1.5;
  const tp2 = price + dir * atr * 2.5;
  const tp3 = price + dir * atr * 3.5;
  const takeProfit: [number, number, number] = [tp1, tp2, tp3];

  const rr1 = 1.5;
  const rr2 = 2.5;
  const rr3 = 3.5;
  const riskReward: [number, number, number] = [rr1, rr2, rr3];

  // 6. Position sizing (2% rule)
  const { lots, riskAmount } = calculatePositionSize(
    accountEquity,
    riskPercent,
    price,
    stopLoss,
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
    adx: summary.adx.adx,
    impulse: impulseColor,
    signals,
    conviction: tier,
    convictionScore,
    direction,
    consensus: { bullish, bearish, neutral },
    currentPrice: price,
    atr,
    entry,
    stopLoss,
    takeProfit,
    riskReward,
    positionSizeLots: lots,
    riskAmount,
    reasonsToExit,
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
    .filter((s) => s.conviction !== "D" && s.direction !== "neutral")
    .sort((a, b) => {
      const tierDiff = tierOrder[b.conviction] - tierOrder[a.conviction];
      if (tierDiff !== 0) return tierDiff;
      return b.convictionScore - a.convictionScore;
    });
}
