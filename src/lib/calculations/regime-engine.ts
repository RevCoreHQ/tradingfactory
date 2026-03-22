import type { OHLCV } from "@/lib/types/market";
import type { TechnicalSummary } from "@/lib/types/indicators";
import type {
  MarketRegime,
  FullRegime,
  VolatilityRegime,
  StructureRegime,
  MarketPhase,
} from "@/lib/types/signals";
import { calcEMA, calculateATRSeries, calculateBollingerBands, calculateADX } from "./technical-indicators";

// ==================== ATR PERCENTILE ====================

/**
 * Rank the current ATR(14) within a rolling window of ATR values.
 * Returns 0-100 percentile (100 = highest volatility in window).
 */
export function calculateATRPercentile(atrSeries: number[], windowSize: number = 100): number {
  if (atrSeries.length === 0) return 50;

  const window = atrSeries.slice(-windowSize);
  const current = window[window.length - 1];
  const sorted = [...window].sort((a, b) => a - b);
  const rank = sorted.findIndex((v) => v >= current);

  return sorted.length > 1
    ? Math.round((rank / (sorted.length - 1)) * 100)
    : 50;
}

// ==================== BB WIDTH PERCENTILE ====================

/**
 * Compute BB width for a rolling window of candles and rank the current width.
 * Low percentile = squeeze, high percentile = expansion.
 */
export function calculateBBWidthPercentile(candles: OHLCV[], windowSize: number = 100): number {
  if (candles.length < 30) return 50;

  const widths: number[] = [];
  const start = Math.max(20, candles.length - windowSize);

  for (let i = start; i <= candles.length; i++) {
    const slice = candles.slice(0, i);
    const bb = calculateBollingerBands(slice);
    if (bb.width > 0) widths.push(bb.width);
  }

  if (widths.length < 2) return 50;

  const current = widths[widths.length - 1];
  const sorted = [...widths].sort((a, b) => a - b);
  const rank = sorted.findIndex((v) => v >= current);

  return Math.round((rank / (sorted.length - 1)) * 100);
}

// ==================== EMA SLOPE ====================

/**
 * Calculate normalized slope of EMA(21) over the last N bars.
 * Normalized by ATR so the value is comparable across instruments.
 * Returns roughly -3 to +3 (negative = falling, positive = rising).
 */
export function calculateEMASlope(candles: OHLCV[], atr: number, lookback: number = 5): number {
  if (candles.length < 21 + lookback || atr === 0) return 0;

  const closes = candles.map((c) => c.close);
  const ema21 = calcEMA(closes, 21);

  if (ema21.length < lookback) return 0;

  const recent = ema21.slice(-lookback);
  // Simple linear regression slope
  const n = recent.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += recent[i];
    sumXY += i * recent[i];
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // Normalize by ATR (slope per bar / ATR)
  return slope / atr;
}

// ==================== ADX TREND ====================

/**
 * Determine if ADX is rising, falling, or flat by comparing current to N bars ago.
 */
export function calculateADXTrend(
  candles: OHLCV[],
  currentADX: number,
  lookback: number = 5
): "rising" | "falling" | "flat" {
  // We need enough candles to compute ADX at an earlier point
  // Simple approach: compare current ADX to a rough estimate from fewer candles
  // For robustness, use the +DI/-DI trend as proxy
  if (candles.length < 30) return "flat";

  // Compute ADX from candles excluding last `lookback` bars
  const olderCandles = candles.slice(0, -lookback);
  if (olderCandles.length < 30) return "flat";

  // Recompute ADX for the older subset
  const olderADX = calculateADX(olderCandles).adx;

  const diff = currentADX - olderADX;
  if (diff > 2) return "rising";
  if (diff < -2) return "falling";
  return "flat";
}

// ==================== CLASSIFICATION FUNCTIONS ====================

export function classifyVolatility(atrPercentile: number): VolatilityRegime {
  if (atrPercentile < 25) return "low";
  if (atrPercentile > 75) return "high";
  return "normal";
}

export function classifyStructure(
  adx: number,
  emaSlope: number,
  bbWidthPercentile: number,
  atrPercentile: number
): StructureRegime {
  const absSlope = Math.abs(emaSlope);

  // Breakout: squeeze releasing (BB was tight, now expanding)
  // BB width < 20th percentile recently AND ATR percentile rising above 60
  if (bbWidthPercentile < 25 && atrPercentile > 60) return "breakout";

  // Trend: ADX showing direction + EMA slope meaningful
  if (adx > 25 && absSlope > 0.3) return "trend";

  // Also trend if ADX moderate but EMA slope very strong
  if (adx > 20 && absSlope > 0.6) return "trend";

  // Range: ADX low, EMA flat, BB normal
  return "range";
}

export function classifyPhase(
  adx: number,
  adxTrend: "rising" | "falling" | "flat",
  emaSlope: number,
  priceVsEma50Pct: number, // % above/below EMA50 (positive = above)
  atrPercentile: number,
  bbWidthPercentile: number
): MarketPhase {
  const absSlope = Math.abs(emaSlope);

  // Expansion: ADX rising, price moving away from EMA50, volatility increasing
  if (adxTrend === "rising" && adx > 25 && absSlope > 0.3 && atrPercentile > 40) {
    return "expansion";
  }

  // Distribution: ADX high but decelerating, price extended from EMA50
  if (adx > 30 && adxTrend === "falling" && Math.abs(priceVsEma50Pct) > 1.5) {
    return "distribution";
  }

  // Reversal: trend direction actively changing — ADX was elevated but slope
  // is weakening or has flipped sign. Replaces "markdown" (which only caught
  // bearish decline). Reversal captures BOTH bullish→bearish and bearish→bullish
  // transitions, which is more useful for directional gating.
  // Detection: ADX still meaningful (>20), trend decelerating, EMA slope weak
  // relative to volatility (direction uncertainty), and market still active.
  if (adx > 20 && adxTrend === "falling" && absSlope < 0.3 && atrPercentile > 40) {
    return "reversal";
  }
  // Also reversal: strong slope BUT ADX collapsing = momentum exhaustion
  if (adx > 25 && adxTrend === "falling" && atrPercentile > 60 && absSlope > 0.4) {
    return "reversal";
  }

  // Accumulation: ADX low/falling, tight range, low volatility
  if (adx < 25 && bbWidthPercentile < 40 && atrPercentile < 50) {
    return "accumulation";
  }

  // Default: check if more likely expansion or accumulation
  if (adxTrend === "rising" && absSlope > 0.2) return "expansion";
  if (adx < 20) return "accumulation";

  // Fallback: if ADX moderate and falling, call it distribution
  if (adxTrend === "falling") return "distribution";

  return "expansion";
}

// ==================== LEGACY DERIVATION ====================

export function deriveLegacyRegime(regime: FullRegime): MarketRegime {
  if (regime.volatility === "high" && regime.adx > 50) return "volatile";
  if (regime.structure === "trend") {
    return regime.emaSlope > 0 ? "trending_up" : "trending_down";
  }
  if (regime.structure === "breakout") {
    return regime.emaSlope > 0 ? "trending_up" : "trending_down";
  }
  return "ranging";
}

// ==================== LABEL GENERATION ====================

function buildLabel(regime: FullRegime): string {
  const phaseLabel = regime.phase.charAt(0).toUpperCase() + regime.phase.slice(1);
  const volLabel = regime.volatility === "high" ? "High Vol" : regime.volatility === "low" ? "Low Vol" : "";
  const structLabel = regime.structure === "breakout" ? "Breakout" : regime.structure === "trend" ? "Trending" : "Ranging";

  const parts = [phaseLabel, structLabel];
  if (volLabel) parts.push(volLabel);
  parts.push(`ADX ${regime.adx.toFixed(0)}`);

  return parts.join(" · ");
}

// ==================== MASTER FUNCTION ====================

/**
 * Compute the full multi-dimensional regime from candles and technical summary.
 * This replaces the old ADX-only detectRegime() as the primary regime detector.
 */
export function detectFullRegime(
  candles: OHLCV[],
  summary: TechnicalSummary
): FullRegime {
  const adx = summary.adx.adx;
  const atr = summary.atr.value;
  const bbWidth = summary.bollingerBands.width;

  // Compute supporting metrics
  const atrSeries = calculateATRSeries(candles);
  const atrPercentile = calculateATRPercentile(atrSeries);
  const bbWidthPercentile = calculateBBWidthPercentile(candles);
  const emaSlope = calculateEMASlope(candles, atr);
  const adxTrend = calculateADXTrend(candles, adx);

  // Price position vs EMA50
  const closes = candles.map((c) => c.close);
  const ema50 = calcEMA(closes, 50);
  const currentPrice = closes[closes.length - 1];
  const ema50Val = ema50.length > 0 ? ema50[ema50.length - 1] : currentPrice;
  const priceVsEma50Pct = ema50Val > 0
    ? ((currentPrice - ema50Val) / ema50Val) * 100
    : 0;

  // Classify
  const volatility = classifyVolatility(atrPercentile);
  const structure = classifyStructure(adx, emaSlope, bbWidthPercentile, atrPercentile);
  const phase = classifyPhase(adx, adxTrend, emaSlope, priceVsEma50Pct, atrPercentile, bbWidthPercentile);

  const regime: FullRegime = {
    legacy: "ranging", // placeholder, set below
    volatility,
    structure,
    phase,
    atrPercentile,
    emaSlope,
    bbWidthPercentile,
    adx,
    adxTrend,
    label: "",
  };

  regime.legacy = deriveLegacyRegime(regime);
  regime.label = buildLabel(regime);

  return regime;
}
