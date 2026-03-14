import type { BiasResult, FundamentalScore, TechnicalScore, BiasSignal } from "@/lib/types/bias";
import type { TechnicalSummary } from "@/lib/types/indicators";
import type { NewsItem, FearGreedData, BondYield, CentralBankRate } from "@/lib/types/market";
import { getBiasDirection } from "@/lib/utils/formatters";
import { clamp } from "@/lib/utils/formatters";

// ==================== FUNDAMENTAL SCORING ====================

function scoreNewsSentiment(news: NewsItem[], instrument: string): { score: number; signals: BiasSignal[] } {
  if (news.length === 0) return { score: 50, signals: [] };

  // Weight more recent news higher
  let totalWeight = 0;
  let weightedScore = 0;

  news.forEach((item, idx) => {
    const recencyWeight = 1 + (news.length - idx) / news.length;
    const sentimentValue = (item.sentimentScore + 1) * 50; // -1..+1 → 0..100
    weightedScore += sentimentValue * recencyWeight;
    totalWeight += recencyWeight;
  });

  const score = clamp(weightedScore / totalWeight, 0, 100);
  const label = score > 60 ? "bullish" : score < 40 ? "bearish" : "neutral";

  return {
    score,
    signals: [{
      source: "News Sentiment",
      signal: label as "bullish" | "bearish" | "neutral",
      strength: Math.abs(score - 50) * 2,
      description: `${news.length} articles analyzed, avg sentiment ${score > 50 ? "positive" : score < 50 ? "negative" : "neutral"} (${score.toFixed(0)}/100)`,
    }],
  };
}

function scoreEconomicData(
  _events: unknown[],
  indicators: { cpi: number; gdp: number; unemployment: number },
  instrument: string
): { score: number; signals: BiasSignal[] } {
  // Base score from economic indicators direction
  let score = 50;
  const signals: BiasSignal[] = [];

  // Higher GDP = stronger economy = bullish for currency
  if (indicators.gdp > 0) {
    const gdpFactor = instrument.startsWith("USD") ? 10 : instrument.endsWith("USD") ? -5 : 0;
    score += gdpFactor;
  }

  // Lower unemployment = stronger economy
  if (indicators.unemployment < 4) {
    score += instrument.includes("USD") ? 5 : -3;
  } else if (indicators.unemployment > 5) {
    score += instrument.includes("USD") ? -5 : 3;
  }

  // CPI direction - higher inflation can be mixed signal
  if (indicators.cpi > 3) {
    signals.push({
      source: "CPI",
      signal: "neutral",
      strength: 40,
      description: `Inflation elevated at ${indicators.cpi}%, creates uncertainty`,
    });
  }

  score = clamp(score, 0, 100);

  return { score, signals };
}

function scoreCentralBankPolicy(
  banks: CentralBankRate[],
  instrument: string
): { score: number; signals: BiasSignal[] } {
  let score = 50;
  const signals: BiasSignal[] = [];

  // Determine which banks are relevant
  const instrumentCurrencies = getInstrumentCurrencies(instrument);
  const baseBanks = banks.filter((b) => instrumentCurrencies.base.includes(b.currency));
  const quoteBanks = banks.filter((b) => instrumentCurrencies.quote.includes(b.currency));

  for (const bank of baseBanks) {
    if (bank.rateDirection === "hiking") score += 15;
    else if (bank.rateDirection === "cutting") score -= 15;
    if (bank.policyStance === "hawkish") score += 8;
    else if (bank.policyStance === "dovish") score -= 8;

    signals.push({
      source: `${bank.bank}`,
      signal: bank.rateDirection === "hiking" ? "bullish" : bank.rateDirection === "cutting" ? "bearish" : "neutral",
      strength: Math.abs(score - 50) * 2,
      description: `Rate: ${bank.currentRate}%, ${bank.policyStance} stance, ${bank.rateDirection}`,
    });
  }

  for (const bank of quoteBanks) {
    // Opposite effect for quote currency
    if (bank.rateDirection === "hiking") score -= 10;
    else if (bank.rateDirection === "cutting") score += 10;
  }

  // For crypto and indices, central bank policy is about monetary conditions
  if (instrument === "BTC_USD" || instrument === "US100" || instrument === "US30") {
    const fed = banks.find((b) => b.currency === "USD");
    if (fed) {
      // Dovish Fed = bullish for risk assets
      if (fed.policyStance === "dovish" || fed.rateDirection === "cutting") score = 65;
      else if (fed.policyStance === "hawkish" || fed.rateDirection === "hiking") score = 35;
    }
  }

  return { score: clamp(score, 0, 100), signals };
}

function scoreMarketSentiment(
  fearGreed: FearGreedData,
  instrument: string
): { score: number; signals: BiasSignal[] } {
  const fgValue = fearGreed.value;
  let score = 50;

  // For crypto: direct mapping
  if (instrument === "BTC_USD") {
    score = fgValue;
  }
  // For risk assets (indices): greed = bullish, fear = bearish
  else if (instrument === "US100" || instrument === "US30") {
    score = fgValue;
  }
  // For USD pairs: fear = risk-off = USD bullish
  else if (instrument.startsWith("USD")) {
    score = 100 - fgValue; // Inverse: fear is bullish for USD
  }
  // For pairs like EUR/USD, GBP/USD: greed = risk-on = bullish
  else if (instrument.endsWith("USD")) {
    score = fgValue;
  }
  // JPY is safe haven: fear = bullish for JPY = bearish for USD/JPY
  if (instrument === "USD_JPY") {
    score = fgValue; // Greed = risk-on = bullish USD/JPY
  }

  const label = fearGreed.label;

  return {
    score: clamp(score, 0, 100),
    signals: [{
      source: "Fear & Greed Index",
      signal: score > 55 ? "bullish" : score < 45 ? "bearish" : "neutral",
      strength: Math.abs(fgValue - 50) * 2,
      description: `${label} (${fgValue}/100), ${fgValue > fearGreed.previousClose ? "improving" : "declining"} from yesterday`,
    }],
  };
}

function scoreIntermarketCorrelation(
  dxy: { value: number; change: number },
  bondYields: BondYield[],
  instrument: string
): { score: number; signals: BiasSignal[] } {
  let score = 50;
  const signals: BiasSignal[] = [];

  // DXY correlation
  if (dxy.value > 0) {
    // DXY rising = USD strengthening
    if (dxy.change > 0) {
      // Bearish for EUR/USD, GBP/USD (sell base against USD)
      if (instrument === "EUR_USD" || instrument === "GBP_USD") score -= 15;
      // Bullish for USD/JPY (buy USD)
      else if (instrument === "USD_JPY") score += 15;
      // Bearish for gold/BTC (denominated in USD)
      else if (instrument === "BTC_USD") score -= 10;
      // Mixed for indices
      else if (instrument === "US100" || instrument === "US30") score -= 5;
    } else if (dxy.change < 0) {
      if (instrument === "EUR_USD" || instrument === "GBP_USD") score += 15;
      else if (instrument === "USD_JPY") score -= 15;
      else if (instrument === "BTC_USD") score += 10;
      else if (instrument === "US100" || instrument === "US30") score += 5;
    }

    signals.push({
      source: "DXY",
      signal: dxy.change > 0 ? (instrument.endsWith("USD") && !instrument.startsWith("USD") ? "bearish" : "bullish") : (instrument.endsWith("USD") && !instrument.startsWith("USD") ? "bullish" : "bearish"),
      strength: Math.min(80, Math.abs(dxy.change) * 50),
      description: `Dollar Index at ${dxy.value.toFixed(2)}, ${dxy.change > 0 ? "strengthening" : "weakening"} (${dxy.change > 0 ? "+" : ""}${dxy.change.toFixed(2)})`,
    });
  }

  // Bond yield analysis
  const y10 = bondYields.find((b) => b.maturity === "10Y");
  const y2 = bondYields.find((b) => b.maturity === "2Y");

  if (y10 && y2) {
    const spread = y10.yield - y2.yield;
    const isInverted = spread < 0;

    if (isInverted) {
      // Inverted yield curve = recession signal
      if (instrument === "US100" || instrument === "US30") score -= 10;
      if (instrument === "BTC_USD") score -= 5;

      signals.push({
        source: "Yield Curve",
        signal: "bearish",
        strength: 60,
        description: `Yield curve inverted (${spread.toFixed(2)}%), recession risk elevated`,
      });
    }

    // Rising yields generally USD bullish
    if (y10.change > 0) {
      if (instrument === "EUR_USD" || instrument === "GBP_USD") score -= 5;
      else if (instrument === "USD_JPY") score += 5;
    }
  }

  return { score: clamp(score, 0, 100), signals };
}

export function calculateFundamentalScore(
  news: NewsItem[],
  events: unknown[],
  indicators: { cpi: number; gdp: number; unemployment: number },
  banks: CentralBankRate[],
  fearGreed: FearGreedData,
  dxy: { value: number; change: number },
  bondYields: BondYield[],
  _quotes: Record<string, unknown>,
  instrument: string
): FundamentalScore {
  const ns = scoreNewsSentiment(news, instrument);
  const ed = scoreEconomicData(events, indicators, instrument);
  const cb = scoreCentralBankPolicy(banks, instrument);
  const ms = scoreMarketSentiment(fearGreed, instrument);
  const ic = scoreIntermarketCorrelation(dxy, bondYields, instrument);

  const total =
    ns.score * 0.25 +
    ed.score * 0.25 +
    cb.score * 0.20 +
    ms.score * 0.15 +
    ic.score * 0.15;

  return {
    total: clamp(total, 0, 100),
    newsSentiment: ns.score,
    economicData: ed.score,
    centralBankPolicy: cb.score,
    marketSentiment: ms.score,
    intermarketCorrelation: ic.score,
  };
}

// ==================== TECHNICAL SCORING ====================

function scoreTrendDirection(summary: TechnicalSummary): { score: number; signals: BiasSignal[] } {
  const mas = summary.movingAverages;
  const currentPrice = summary.currentPrice;
  let score = 50;
  const signals: BiasSignal[] = [];

  // Count MAs below price (bullish) vs above price (bearish)
  const bullishMAs = mas.filter((m) => m.trend === "below_price").length;
  const totalMAs = mas.length || 1;
  const maAlignment = (bullishMAs / totalMAs) * 100;
  score = maAlignment;

  // Trend pattern bonus
  if (summary.trend.direction === "uptrend") {
    score = Math.min(100, score + 15);
  } else if (summary.trend.direction === "downtrend") {
    score = Math.max(0, score - 15);
  }

  const ema9 = mas.find((m) => m.type === "EMA" && m.period === 9);
  const ema21 = mas.find((m) => m.type === "EMA" && m.period === 21);
  const ema50 = mas.find((m) => m.type === "EMA" && m.period === 50);

  if (ema9 && ema21 && ema50) {
    if (ema9.value > ema21.value && ema21.value > ema50.value) {
      signals.push({
        source: "MA Alignment",
        signal: "bullish",
        strength: 80,
        description: "EMAs bullish aligned (9 > 21 > 50)",
      });
    } else if (ema9.value < ema21.value && ema21.value < ema50.value) {
      signals.push({
        source: "MA Alignment",
        signal: "bearish",
        strength: 80,
        description: "EMAs bearish aligned (9 < 21 < 50)",
      });
    }
  }

  signals.push({
    source: "Trend",
    signal: summary.trend.direction === "uptrend" ? "bullish" : summary.trend.direction === "downtrend" ? "bearish" : "neutral",
    strength: summary.trend.strength,
    description: `${summary.trend.direction} (${summary.trend.pattern}), strength ${summary.trend.strength}/100`,
  });

  return { score: clamp(score, 0, 100), signals };
}

function scoreMomentum(summary: TechnicalSummary): { score: number; signals: BiasSignal[] } {
  let score = 50;
  const signals: BiasSignal[] = [];

  // RSI contribution (40% of momentum)
  const rsiScore = summary.rsi.value;
  // RSI 50 = neutral. Above 50 = bullish momentum. Below 50 = bearish.
  // But overbought (>70) is bearish signal, oversold (<30) is bullish signal.
  let rsiBias = rsiScore;
  if (rsiScore > 70) rsiBias = 100 - (rsiScore - 70) * 2; // Overbought reduces bias
  else if (rsiScore < 30) rsiBias = 30 + (30 - rsiScore) * 2; // Oversold increases bias

  signals.push({
    source: "RSI (14)",
    signal: summary.rsi.signal === "overbought" ? "bearish" : summary.rsi.signal === "oversold" ? "bullish" : rsiScore > 50 ? "bullish" : "bearish",
    strength: Math.abs(rsiScore - 50) * 2,
    description: `RSI at ${rsiScore.toFixed(1)} - ${summary.rsi.signal}`,
  });

  // MACD contribution (40% of momentum)
  let macdBias = 50;
  if (summary.macd.histogram > 0) {
    macdBias = 50 + Math.min(50, summary.macd.histogram * 1000);
  } else {
    macdBias = 50 + Math.max(-50, summary.macd.histogram * 1000);
  }

  if (summary.macd.crossover) {
    signals.push({
      source: "MACD",
      signal: summary.macd.crossover,
      strength: 70,
      description: `MACD ${summary.macd.crossover} crossover detected`,
    });
  }

  // Stochastic RSI (20% of momentum)
  const stochBias = summary.stochasticRsi.k;

  score = rsiBias * 0.4 + macdBias * 0.4 + stochBias * 0.2;

  return { score: clamp(score, 0, 100), signals };
}

function scoreVolatility(summary: TechnicalSummary): { score: number; signals: BiasSignal[] } {
  let score = 50;
  const signals: BiasSignal[] = [];

  // Bollinger Band position
  const bb = summary.bollingerBands;
  if (bb.percentB > 0.8) {
    score = 60; // Near upper band = bullish momentum but potential reversal
    signals.push({
      source: "Bollinger Bands",
      signal: "bullish",
      strength: 60,
      description: `Price near upper band (${(bb.percentB * 100).toFixed(0)}% B)`,
    });
  } else if (bb.percentB < 0.2) {
    score = 40; // Near lower band
    signals.push({
      source: "Bollinger Bands",
      signal: "bearish",
      strength: 60,
      description: `Price near lower band (${(bb.percentB * 100).toFixed(0)}% B)`,
    });
  }

  // Band width squeeze detection
  if (bb.width < 0.02) {
    signals.push({
      source: "BB Squeeze",
      signal: "neutral",
      strength: 50,
      description: "Bollinger Band squeeze - breakout imminent",
    });
  }

  return { score: clamp(score, 0, 100), signals };
}

function scoreVolume(summary: TechnicalSummary): { score: number; signals: BiasSignal[] } {
  let score = 50;
  const signals: BiasSignal[] = [];

  if (summary.vwap) {
    const aboveVwap = summary.currentPrice > summary.vwap.value;
    score = aboveVwap ? 65 : 35;
    signals.push({
      source: "VWAP",
      signal: aboveVwap ? "bullish" : "bearish",
      strength: 50,
      description: `Price ${aboveVwap ? "above" : "below"} VWAP (${summary.vwap.value.toFixed(4)})`,
    });
  }

  return { score: clamp(score, 0, 100), signals };
}

function scoreSupportResistance(summary: TechnicalSummary, currentPrice: number): { score: number; signals: BiasSignal[] } {
  let score = 50;
  const signals: BiasSignal[] = [];

  const levels = summary.supportResistance;
  if (levels.length === 0) return { score, signals };

  const supports = levels.filter((l) => l.type === "support");
  const resistances = levels.filter((l) => l.type === "resistance");

  // Nearest support and resistance
  const nearestSupport = supports.sort((a, b) => b.price - a.price)[0];
  const nearestResistance = resistances.sort((a, b) => a.price - b.price)[0];

  if (nearestSupport && nearestResistance) {
    const distToSupport = Math.abs(currentPrice - nearestSupport.price);
    const distToResistance = Math.abs(nearestResistance.price - currentPrice);

    // Closer to support = potential bounce = slightly bullish
    // Closer to resistance = potential rejection = slightly bearish
    const ratio = distToSupport / (distToSupport + distToResistance);
    score = (1 - ratio) * 100; // Near support = high score (bullish)

    signals.push({
      source: "S/R Levels",
      signal: ratio < 0.4 ? "bullish" : ratio > 0.6 ? "bearish" : "neutral",
      strength: Math.abs(ratio - 0.5) * 100,
      description: `Support at ${nearestSupport.price.toFixed(4)}, Resistance at ${nearestResistance.price.toFixed(4)}`,
    });
  }

  // Pivot points
  if (summary.pivotPoints.length > 0) {
    const dailyPivot = summary.pivotPoints.find((p) => p.type === "daily");
    if (dailyPivot) {
      const abovePivot = currentPrice > dailyPivot.pivot;
      if (abovePivot) score = Math.min(score + 5, 100);
      else score = Math.max(score - 5, 0);
    }
  }

  return { score: clamp(score, 0, 100), signals };
}

export function calculateTechnicalScore(
  summary: TechnicalSummary,
  currentPrice: number
): TechnicalScore {
  const td = scoreTrendDirection(summary);
  const mo = scoreMomentum(summary);
  const vo = scoreVolatility(summary);
  const va = scoreVolume(summary);
  const sr = scoreSupportResistance(summary, currentPrice);

  const total =
    td.score * 0.30 +
    mo.score * 0.30 +
    vo.score * 0.15 +
    va.score * 0.10 +
    sr.score * 0.15;

  return {
    total: clamp(total, 0, 100),
    trendDirection: td.score,
    momentum: mo.score,
    volatility: vo.score,
    volumeAnalysis: va.score,
    supportResistance: sr.score,
  };
}

// ==================== OVERALL BIAS ====================

export function calculateOverallBias(
  fundamentalScore: FundamentalScore,
  technicalScore: TechnicalScore,
  timeframe: "intraday" | "intraweek",
  instrument: string
): BiasResult {
  // Intraday: weight technical higher (60/40)
  // Intraweek: weight fundamental higher (55/45)
  const techWeight = timeframe === "intraday" ? 0.60 : 0.45;
  const fundWeight = timeframe === "intraday" ? 0.40 : 0.55;

  // Map 0-100 scores to -100 to +100
  const fundamentalBias = (fundamentalScore.total - 50) * 2;
  const technicalBias = (technicalScore.total - 50) * 2;

  const overallBias = clamp(
    fundamentalBias * fundWeight + technicalBias * techWeight,
    -100,
    100
  );

  const direction = getBiasDirection(overallBias);

  // Confidence: higher when fundamental and technical agree
  const agreement = 100 - Math.abs(fundamentalBias - technicalBias);
  const confidence = clamp(agreement, 10, 100);

  const signals: BiasSignal[] = [];

  return {
    instrument,
    overallBias,
    direction,
    confidence,
    fundamentalScore,
    technicalScore,
    timeframe,
    timestamp: Date.now(),
    signals,
  };
}

// ==================== HELPERS ====================

function getInstrumentCurrencies(instrument: string): { base: string[]; quote: string[] } {
  const map: Record<string, { base: string[]; quote: string[] }> = {
    EUR_USD: { base: ["EUR"], quote: ["USD"] },
    GBP_USD: { base: ["GBP"], quote: ["USD"] },
    USD_JPY: { base: ["USD"], quote: ["JPY"] },
    BTC_USD: { base: [], quote: ["USD"] },
    US100: { base: [], quote: ["USD"] },
    US30: { base: [], quote: ["USD"] },
  };
  return map[instrument] || { base: [], quote: [] };
}
