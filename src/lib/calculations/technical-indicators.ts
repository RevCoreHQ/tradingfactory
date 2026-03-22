import type { OHLCV } from "@/lib/types/market";
import type {
  TechnicalSummary,
  MovingAverageResult,
  RSIResult,
  MACDResult,
  BollingerBandsResult,
  ATRResult,
  StochasticRSIResult,
  VWAPResult,
  PivotPointResult,
  SupportResistanceLevel,
  FibonacciLevel,
  TrendAnalysis,
  ADXResult,
  ForceIndexResult,
  ElderRayResult,
  ImpulseResult,
} from "@/lib/types/indicators";

// ============== EMA / SMA ==============

export function calcEMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  ema.push(sum / period);
  for (let i = period; i < values.length; i++) {
    ema.push(values[i] * k + ema[ema.length - 1] * (1 - k));
  }
  return ema;
}

export function calcSMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const sma: number[] = [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  sma.push(sum / period);
  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period];
    sma.push(sum / period);
  }
  return sma;
}

export function calculateMovingAverages(candles: OHLCV[]): MovingAverageResult[] {
  const closes = candles.map((c) => c.close);
  const currentPrice = closes[closes.length - 1];
  const results: MovingAverageResult[] = [];

  for (const period of [9, 13, 21, 50, 200]) {
    const emaValues = calcEMA(closes, period);
    if (emaValues.length > 0) {
      const value = emaValues[emaValues.length - 1];
      results.push({
        type: "EMA",
        period,
        value,
        trend: value < currentPrice ? "below_price" : "above_price",
      });
    }
  }

  for (const period of [9, 20, 26, 50, 200]) {
    const smaValues = calcSMA(closes, period);
    if (smaValues.length > 0) {
      const value = smaValues[smaValues.length - 1];
      results.push({
        type: "SMA",
        period,
        value,
        trend: value < currentPrice ? "below_price" : "above_price",
      });
    }
  }

  return results;
}

// ============== RSI ==============

export function calculateRSI(candles: OHLCV[], period: number = 14): RSIResult {
  const closes = candles.map((c) => c.close);
  if (closes.length < period + 1) {
    return { value: 50, signal: "neutral" };
  }

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(0, diff)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -diff)) / period;
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  return {
    value: rsi,
    signal: rsi < 30 ? "oversold" : rsi > 70 ? "overbought" : "neutral",
  };
}

// ============== MACD ==============

export function calculateMACD(candles: OHLCV[]): MACDResult {
  const closes = candles.map((c) => c.close);
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);

  if (ema12.length === 0 || ema26.length === 0) {
    return { macd: 0, signal: 0, histogram: 0, crossover: null };
  }

  const offset = ema12.length - ema26.length;
  const macdLine: number[] = [];
  for (let i = 0; i < ema26.length; i++) {
    macdLine.push(ema12[i + offset] - ema26[i]);
  }

  const signalLine = calcEMA(macdLine, 9);
  if (signalLine.length < 2) {
    return { macd: macdLine[macdLine.length - 1] || 0, signal: 0, histogram: 0, crossover: null };
  }

  const sOffset = macdLine.length - signalLine.length;
  const macd = macdLine[macdLine.length - 1];
  const sig = signalLine[signalLine.length - 1];
  const histogram = macd - sig;

  const prevMacd = macdLine[macdLine.length - 2];
  const prevSig = signalLine[signalLine.length - 2];
  let crossover: "bullish" | "bearish" | null = null;
  if (prevMacd <= prevSig && macd > sig) crossover = "bullish";
  else if (prevMacd >= prevSig && macd < sig) crossover = "bearish";

  return { macd, signal: sig, histogram, crossover };
}

// ============== Bollinger Bands ==============

export function calculateBollingerBands(candles: OHLCV[], period: number = 20, stdDev: number = 2): BollingerBandsResult {
  const closes = candles.map((c) => c.close);
  const sma = calcSMA(closes, period);
  if (sma.length === 0) {
    const mid = closes[closes.length - 1];
    return { upper: mid, middle: mid, lower: mid, width: 0, percentB: 0.5 };
  }

  const middle = sma[sma.length - 1];
  const recentCloses = closes.slice(-period);
  const variance = recentCloses.reduce((sum, c) => sum + (c - middle) ** 2, 0) / period;
  const sd = Math.sqrt(variance);

  const upper = middle + stdDev * sd;
  const lower = middle - stdDev * sd;
  const width = (upper - lower) / middle;
  const currentPrice = closes[closes.length - 1];
  const percentB = upper !== lower ? (currentPrice - lower) / (upper - lower) : 0.5;

  return { upper, middle, lower, width, percentB };
}

// ============== ATR ==============

export function calculateATR(candles: OHLCV[], period: number = 14): ATRResult {
  if (candles.length < period + 1) {
    return { value: 0, normalized: 0 };
  }

  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    trueRanges.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }

  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }

  const currentPrice = candles[candles.length - 1].close;
  return { value: atr, normalized: currentPrice > 0 ? (atr / currentPrice) * 100 : 0 };
}

/** Returns full ATR series (one value per bar after warmup) for percentile computation. */
export function calculateATRSeries(candles: OHLCV[], period: number = 14): number[] {
  if (candles.length < period + 1) return [];

  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    trueRanges.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }

  const series: number[] = [];
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  series.push(atr);
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    series.push(atr);
  }
  return series;
}

// ============== Stochastic RSI ==============

export function calculateStochasticRSI(candles: OHLCV[], period: number = 14): StochasticRSIResult {
  const closes = candles.map((c) => c.close);
  if (closes.length < period * 2) {
    return { k: 50, d: 50, signal: "neutral" };
  }

  // Calculate RSI values series
  const rsiValues: number[] = [];
  for (let i = period + 1; i <= closes.length; i++) {
    const slice = candles.slice(0, i);
    const { value } = calculateRSI(slice, period);
    rsiValues.push(value);
  }

  if (rsiValues.length < period) {
    return { k: 50, d: 50, signal: "neutral" };
  }

  const recentRsi = rsiValues.slice(-period);
  const minRsi = Math.min(...recentRsi);
  const maxRsi = Math.max(...recentRsi);
  const currentRsi = recentRsi[recentRsi.length - 1];

  const k = maxRsi !== minRsi ? ((currentRsi - minRsi) / (maxRsi - minRsi)) * 100 : 50;

  // D is SMA of K over 3 periods (simplified to just k for now)
  const d = k; // Simplified

  return {
    k,
    d,
    signal: k < 20 ? "oversold" : k > 80 ? "overbought" : "neutral",
  };
}

// ============== VWAP ==============

export function calculateVWAP(candles: OHLCV[]): VWAPResult | null {
  if (candles.length === 0) return null;

  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    const vol = c.volume || 1; // Default to 1 if no volume
    cumulativeTPV += tp * vol;
    cumulativeVolume += vol;
  }

  const vwap = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : candles[candles.length - 1].close;
  const currentPrice = candles[candles.length - 1].close;

  return {
    value: vwap,
    deviation: currentPrice - vwap,
  };
}

// ============== Pivot Points ==============

export function calculatePivotPoints(candles: OHLCV[], type: "daily" | "weekly"): PivotPointResult {
  // Use last complete period
  const periodCandles = type === "weekly" ? candles.slice(-5) : candles.slice(-1);
  if (periodCandles.length === 0) {
    return { type, pivot: 0, r1: 0, r2: 0, r3: 0, s1: 0, s2: 0, s3: 0 };
  }

  const high = Math.max(...periodCandles.map((c) => c.high));
  const low = Math.min(...periodCandles.map((c) => c.low));
  const close = periodCandles[periodCandles.length - 1].close;

  const pivot = (high + low + close) / 3;
  const r1 = 2 * pivot - low;
  const s1 = 2 * pivot - high;
  const r2 = pivot + (high - low);
  const s2 = pivot - (high - low);
  const r3 = high + 2 * (pivot - low);
  const s3 = low - 2 * (high - pivot);

  return { type, pivot, r1, r2, r3, s1, s2, s3 };
}

// ============== Support/Resistance ==============

export function detectSupportResistance(candles: OHLCV[], lookback: number = 100): SupportResistanceLevel[] {
  const data = candles.slice(-lookback);
  if (data.length < 10) return [];

  const levels: SupportResistanceLevel[] = [];
  const tolerance = 0.001; // 0.1%
  const currentPrice = data[data.length - 1].close;

  // Find swing highs and lows (fractal detection with 3 bars)
  const swingPoints: { price: number; type: "high" | "low" }[] = [];
  for (let i = 2; i < data.length - 2; i++) {
    // Swing high
    if (data[i].high > data[i - 1].high && data[i].high > data[i - 2].high &&
        data[i].high > data[i + 1].high && data[i].high > data[i + 2].high) {
      swingPoints.push({ price: data[i].high, type: "high" });
    }
    // Swing low
    if (data[i].low < data[i - 1].low && data[i].low < data[i - 2].low &&
        data[i].low < data[i + 1].low && data[i].low < data[i + 2].low) {
      swingPoints.push({ price: data[i].low, type: "low" });
    }
  }

  // Cluster nearby levels
  const clusters: { price: number; count: number; type: "support" | "resistance" }[] = [];
  for (const sp of swingPoints) {
    const existing = clusters.find((c) => Math.abs(c.price - sp.price) / sp.price < tolerance);
    if (existing) {
      existing.count++;
      existing.price = (existing.price + sp.price) / 2; // Average
    } else {
      clusters.push({
        price: sp.price,
        count: 1,
        type: sp.price > currentPrice ? "resistance" : "support",
      });
    }
  }

  // Sort by strength (count) and take top levels
  clusters.sort((a, b) => b.count - a.count);
  for (const cluster of clusters.slice(0, 8)) {
    levels.push({
      price: cluster.price,
      type: cluster.type,
      strength: cluster.count,
      timeframe: "auto",
    });
  }

  return levels.sort((a, b) => b.price - a.price); // Sort by price descending
}

// ============== Fibonacci ==============

export function calculateFibonacci(candles: OHLCV[]): FibonacciLevel[] {
  if (candles.length < 20) return [];

  // Find significant swing high and low in recent data
  const data = candles.slice(-100);
  let swingHigh = -Infinity;
  let swingLow = Infinity;

  for (const c of data) {
    if (c.high > swingHigh) swingHigh = c.high;
    if (c.low < swingLow) swingLow = c.low;
  }

  const diff = swingHigh - swingLow;
  const currentPrice = candles[candles.length - 1].close;
  const isUptrend = currentPrice > (swingHigh + swingLow) / 2;

  const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];

  return fibLevels.map((level) => ({
    level,
    price: isUptrend ? swingHigh - diff * level : swingLow + diff * level,
    label: `${(level * 100).toFixed(1)}%`,
  }));
}

// ============== Trend Analysis ==============

export function analyzeTrend(candles: OHLCV[]): TrendAnalysis {
  if (candles.length < 20) {
    return { direction: "sideways", pattern: "mixed", strength: 50, swingPoints: [] };
  }

  const data = candles.slice(-50);
  const swingPoints: { price: number; timestamp: number; type: "high" | "low" }[] = [];

  // Detect swing points
  for (let i = 2; i < data.length - 2; i++) {
    if (data[i].high > data[i - 1].high && data[i].high > data[i + 1].high &&
        data[i].high > data[i - 2].high && data[i].high > data[i + 2].high) {
      swingPoints.push({ price: data[i].high, timestamp: data[i].timestamp, type: "high" });
    }
    if (data[i].low < data[i - 1].low && data[i].low < data[i + 1].low &&
        data[i].low < data[i - 2].low && data[i].low < data[i + 2].low) {
      swingPoints.push({ price: data[i].low, timestamp: data[i].timestamp, type: "low" });
    }
  }

  // Analyze pattern
  const highs = swingPoints.filter((sp) => sp.type === "high");
  const lows = swingPoints.filter((sp) => sp.type === "low");

  let hhCount = 0;
  let lhCount = 0;
  let hlCount = 0;
  let llCount = 0;

  for (let i = 1; i < highs.length; i++) {
    if (highs[i].price > highs[i - 1].price) hhCount++;
    else lhCount++;
  }
  for (let i = 1; i < lows.length; i++) {
    if (lows[i].price > lows[i - 1].price) hlCount++;
    else llCount++;
  }

  let direction: "uptrend" | "downtrend" | "sideways";
  let pattern: "HH_HL" | "LH_LL" | "mixed";
  let strength: number;

  if (hhCount > lhCount && hlCount > llCount) {
    direction = "uptrend";
    pattern = "HH_HL";
    strength = Math.min(100, 50 + (hhCount + hlCount) * 10);
  } else if (lhCount > hhCount && llCount > hlCount) {
    direction = "downtrend";
    pattern = "LH_LL";
    strength = Math.min(100, 50 + (lhCount + llCount) * 10);
  } else {
    direction = "sideways";
    pattern = "mixed";
    strength = 50 - Math.abs(hhCount - lhCount) * 5;
  }

  return { direction, pattern, strength: Math.max(0, Math.min(100, strength)), swingPoints };
}

// ============== ADX (Average Directional Index) ==============

export function calculateADX(candles: OHLCV[], period: number = 14): ADXResult {
  if (candles.length < period * 2 + 1) {
    return { adx: 0, plusDI: 0, minusDI: 0 };
  }

  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const trueRange: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    trueRange.push(
      Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close)
      )
    );
  }

  // Wilder smoothing
  function wilderSmooth(values: number[], p: number): number[] {
    const result: number[] = [];
    let sum = 0;
    for (let i = 0; i < p; i++) sum += values[i];
    result.push(sum);
    for (let i = p; i < values.length; i++) {
      result.push(result[result.length - 1] - result[result.length - 1] / p + values[i]);
    }
    return result;
  }

  const smoothPlusDM = wilderSmooth(plusDM, period);
  const smoothMinusDM = wilderSmooth(minusDM, period);
  const smoothTR = wilderSmooth(trueRange, period);

  const len = Math.min(smoothPlusDM.length, smoothMinusDM.length, smoothTR.length);
  const plusDIArr: number[] = [];
  const minusDIArr: number[] = [];
  const dx: number[] = [];

  for (let i = 0; i < len; i++) {
    const pdi = smoothTR[i] > 0 ? (smoothPlusDM[i] / smoothTR[i]) * 100 : 0;
    const mdi = smoothTR[i] > 0 ? (smoothMinusDM[i] / smoothTR[i]) * 100 : 0;
    plusDIArr.push(pdi);
    minusDIArr.push(mdi);
    const sum = pdi + mdi;
    dx.push(sum > 0 ? (Math.abs(pdi - mdi) / sum) * 100 : 0);
  }

  if (dx.length < period) {
    return { adx: 0, plusDI: 0, minusDI: 0 };
  }

  let adxSum = 0;
  for (let i = 0; i < period; i++) adxSum += dx[i];
  let adx = adxSum / period;
  for (let i = period; i < dx.length; i++) {
    adx = (adx * (period - 1) + dx[i]) / period;
  }

  return {
    adx,
    plusDI: plusDIArr[plusDIArr.length - 1],
    minusDI: minusDIArr[minusDIArr.length - 1],
  };
}

// ============== Force Index ==============

export function calculateForceIndex(candles: OHLCV[]): ForceIndexResult {
  if (candles.length < 14) {
    return { shortTerm: 0, intermediate: 0 };
  }

  // Raw Force Index: (Close - PrevClose) × Volume
  const forceRaw: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    forceRaw.push((candles[i].close - candles[i - 1].close) * (candles[i].volume || 1));
  }

  const ema2 = calcEMA(forceRaw, 2);
  const ema13 = calcEMA(forceRaw, 13);

  return {
    shortTerm: ema2.length > 0 ? ema2[ema2.length - 1] : 0,
    intermediate: ema13.length > 0 ? ema13[ema13.length - 1] : 0,
  };
}

// ============== Elder-Ray ==============

export function calculateElderRay(candles: OHLCV[]): ElderRayResult {
  if (candles.length < 14) {
    return { bullPower: 0, bearPower: 0 };
  }

  const closes = candles.map((c) => c.close);
  const ema13 = calcEMA(closes, 13);
  if (ema13.length === 0) {
    return { bullPower: 0, bearPower: 0 };
  }

  const currentEma = ema13[ema13.length - 1];
  const currentCandle = candles[candles.length - 1];

  return {
    bullPower: currentCandle.high - currentEma,
    bearPower: currentCandle.low - currentEma,
  };
}

// ============== Elder Impulse System ==============

export function calculateImpulse(candles: OHLCV[]): ImpulseResult {
  if (candles.length < 27) {
    return { color: "blue", emaSlope: "flat", macdHistogramSlope: "flat" };
  }

  const closes = candles.map((c) => c.close);

  // EMA(13) slope
  const ema13 = calcEMA(closes, 13);
  let emaSlope: "up" | "down" | "flat" = "flat";
  if (ema13.length >= 2) {
    const diff = ema13[ema13.length - 1] - ema13[ema13.length - 2];
    if (diff > 0) emaSlope = "up";
    else if (diff < 0) emaSlope = "down";
  }

  // MACD Histogram slope
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  let macdHistogramSlope: "up" | "down" | "flat" = "flat";

  if (ema12.length > 0 && ema26.length > 0) {
    const offset = ema12.length - ema26.length;
    const macdLine: number[] = [];
    for (let i = 0; i < ema26.length; i++) {
      macdLine.push(ema12[i + offset] - ema26[i]);
    }
    const signalLine = calcEMA(macdLine, 9);
    if (signalLine.length >= 2) {
      const sOffset = macdLine.length - signalLine.length;
      const histCurr = macdLine[macdLine.length - 1] - signalLine[signalLine.length - 1];
      const histPrev = macdLine[macdLine.length - 2] - signalLine[signalLine.length - 2];
      if (histCurr > histPrev) macdHistogramSlope = "up";
      else if (histCurr < histPrev) macdHistogramSlope = "down";
    }
  }

  // Combine
  let color: "green" | "red" | "blue";
  if (emaSlope === "up" && macdHistogramSlope === "up") {
    color = "green";
  } else if (emaSlope === "down" && macdHistogramSlope === "down") {
    color = "red";
  } else {
    color = "blue";
  }

  return { color, emaSlope, macdHistogramSlope };
}

// ============== Master Function ==============

export function calculateAllIndicators(
  candles: OHLCV[],
  instrument: string,
  timeframe: string
): TechnicalSummary {
  const currentPrice = candles[candles.length - 1].close;

  return {
    instrument,
    timeframe,
    timestamp: Date.now(),
    currentPrice,
    movingAverages: calculateMovingAverages(candles),
    rsi: calculateRSI(candles),
    macd: calculateMACD(candles),
    bollingerBands: calculateBollingerBands(candles),
    atr: calculateATR(candles),
    stochasticRsi: calculateStochasticRSI(candles),
    vwap: calculateVWAP(candles),
    pivotPoints: [
      calculatePivotPoints(candles, "daily"),
      calculatePivotPoints(candles, "weekly"),
    ],
    supportResistance: detectSupportResistance(candles),
    fibonacci: calculateFibonacci(candles),
    trend: analyzeTrend(candles),
    adx: calculateADX(candles),
    forceIndex: calculateForceIndex(candles),
    elderRay: calculateElderRay(candles),
    impulse: calculateImpulse(candles),
  };
}
