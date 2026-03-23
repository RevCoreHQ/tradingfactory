// ==================== VOLATILITY TARGETING ====================
// Scale position sizes inversely to volatility.
// Replaces fixed % risk with volatility-aware sizing.

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
 * Calculate volatility-targeting multiplier.
 * High volatility → smaller positions (multiplier < 1).
 * Low volatility → larger positions (multiplier > 1).
 * Clamped to [0.5, 1.5].
 */
export function calculateVolTargetMultiplier(
  atr: number,
  price: number,
  targetAnnualVol: number = 0.10,
): VolatilityTarget {
  const currentVol = estimateAnnualizedVol(atr, price);
  const rawMultiplier = currentVol > 0 ? targetAnnualVol / currentVol : 1.0;
  const multiplier = Math.max(0.5, Math.min(1.5, rawMultiplier));

  return {
    targetAnnualVol,
    currentAnnualVol: Number(currentVol.toFixed(4)),
    multiplier: Number(multiplier.toFixed(3)),
  };
}
