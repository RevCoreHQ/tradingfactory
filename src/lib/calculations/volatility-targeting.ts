// ==================== VOLATILITY TARGETING ====================
// Scale position sizes inversely to volatility.
// Replaces fixed % risk with volatility-aware sizing.
// Blends ATR-based vol with return-based vol for more accurate estimates.

import type { OHLCV } from "@/lib/types/market";

export interface VolatilityTarget {
  targetAnnualVol: number; // e.g., 0.10 for 10%
  currentAnnualVol: number;
  multiplier: number; // clamped [0.5, 1.5]
}

/**
 * Estimate annualized volatility from ATR and price.
 * Formula: (ATR / price) * sqrt(252)
 */
export function estimateAnnualizedVol(atr: number, price: number): number {
  if (price <= 0) return 0.1;
  return (atr / price) * Math.sqrt(252);
}

/**
 * Calculate return-based (realized) annualized volatility from candle close prices.
 * Uses log returns: ln(close[i] / close[i-1]), then StdDev × sqrt(252).
 * More accurate than ATR-only because it captures actual return distribution
 * and volatility clustering.
 */
export function calculateReturnBasedVol(candles: OHLCV[], window: number = 20): number {
  if (candles.length < window + 1) return 0;

  // Compute log returns for the most recent `window` periods
  const returns: number[] = [];
  const start = candles.length - window;
  for (let i = start; i < candles.length; i++) {
    const prev = candles[i - 1].close;
    const curr = candles[i].close;
    if (prev > 0 && curr > 0) {
      returns.push(Math.log(curr / prev));
    }
  }

  if (returns.length < 5) return 0;

  // Standard deviation of returns
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);

  // Annualize
  return stdDev * Math.sqrt(252);
}

/**
 * Calculate volatility-targeting multiplier.
 * High volatility → smaller positions (multiplier < 1).
 * Low volatility → larger positions (multiplier > 1).
 * Clamped to [0.5, 1.5].
 *
 * When candles are provided, blends ATR-based vol (50%) with return-based vol (50%)
 * for a more robust estimate. Falls back to ATR-only when insufficient candle data.
 */
export function calculateVolTargetMultiplier(
  atr: number,
  price: number,
  targetAnnualVol: number = 0.10,
  candles?: OHLCV[],
): VolatilityTarget {
  const atrVol = estimateAnnualizedVol(atr, price);
  const returnVol = candles ? calculateReturnBasedVol(candles) : 0;

  // Blend 50/50 when return vol is available, fallback to ATR-only
  const currentVol = returnVol > 0 ? 0.5 * atrVol + 0.5 * returnVol : atrVol;

  const rawMultiplier = currentVol > 0 ? targetAnnualVol / currentVol : 1.0;
  const multiplier = Math.max(0.5, Math.min(1.5, rawMultiplier));

  return {
    targetAnnualVol,
    currentAnnualVol: Number(currentVol.toFixed(4)),
    multiplier: Number(multiplier.toFixed(3)),
  };
}
