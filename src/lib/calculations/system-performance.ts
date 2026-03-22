import type { TrackedSetup, MechanicalSignal } from "@/lib/types/signals";

// ==================== TYPES ====================

export interface SystemPerformance {
  system: string;
  instrument?: string;
  regime?: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgStrength: number;
  weight: number;
  lastUpdated: number;
}

export interface SystemWeightConfig {
  windowSize: number;
  minTrades: number;
  penaltyThreshold: number;
  disableThreshold: number;
  bonusThreshold: number;
}

export const DEFAULT_WEIGHT_CONFIG: SystemWeightConfig = {
  windowSize: 30,
  minTrades: 10,
  penaltyThreshold: 0.40,
  disableThreshold: 0.30,
  bonusThreshold: 0.60,
};

// ==================== RECORDING ====================

/**
 * Record which systems contributed to a completed trade.
 * Called when a TrackedSetup reaches a terminal state (win/loss).
 */
export function recordSystemOutcome(
  existing: Record<string, SystemPerformance>,
  tracked: TrackedSetup
): Record<string, SystemPerformance> {
  const updated = { ...existing };
  const outcome = tracked.outcome;
  if (!outcome || outcome === "breakeven") return updated;

  const isWin = outcome === "win";
  const direction = tracked.setup.direction;

  // Each signal that agreed with the trade direction contributed
  for (const signal of tracked.setup.signals) {
    if (signal.direction !== direction) continue;

    const key = signal.system;
    const perf = updated[key] ?? {
      system: signal.system,
      trades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      avgStrength: 0,
      weight: 1.0,
      lastUpdated: 0,
    };

    perf.trades++;
    if (isWin) perf.wins++;
    else perf.losses++;

    // Running average of strength
    perf.avgStrength = perf.trades === 1
      ? signal.strength
      : perf.avgStrength + (signal.strength - perf.avgStrength) / perf.trades;

    perf.winRate = perf.trades > 0 ? perf.wins / perf.trades : 0;
    perf.weight = calculateSystemWeight(perf);
    perf.lastUpdated = Date.now();

    updated[key] = perf;
  }

  return updated;
}

// ==================== WEIGHT CALCULATION ====================

/**
 * Calculate the dynamic weight for a system based on rolling performance.
 * Returns 0.0 (disabled) to 1.5 (boosted).
 */
export function calculateSystemWeight(
  perf: SystemPerformance,
  config: SystemWeightConfig = DEFAULT_WEIGHT_CONFIG
): number {
  if (perf.trades < config.minTrades) return 1.0; // Not enough data

  const wr = perf.winRate;

  // Bonus: performing well
  if (wr >= config.bonusThreshold) {
    return Math.min(1.5, 1.0 + (wr - config.bonusThreshold) * 2);
  }

  // Neutral: acceptable performance
  if (wr >= config.penaltyThreshold) return 1.0;

  // Penalty: underperforming
  if (wr >= config.disableThreshold) {
    const range = config.penaltyThreshold - config.disableThreshold;
    return range > 0 ? 0.5 + ((wr - config.disableThreshold) / range) * 0.5 : 0.5;
  }

  // Disabled: severely underperforming
  return 0;
}

// ==================== WEIGHT LOOKUP ====================

/**
 * Get all system weights from performance records.
 */
export function getSystemWeights(
  performances: Record<string, SystemPerformance>,
  config: SystemWeightConfig = DEFAULT_WEIGHT_CONFIG
): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const [key, perf] of Object.entries(performances)) {
    weights[key] = calculateSystemWeight(perf, config);
  }
  return weights;
}

// ==================== WEIGHT APPLICATION ====================

/**
 * Apply system weights to signal strengths before conviction scoring.
 * Signals from disabled systems (weight = 0) get strength = 0 (effectively neutral).
 * Returns new array (does not mutate input).
 */
export function applySystemWeights(
  signals: MechanicalSignal[],
  weights: Record<string, number>
): MechanicalSignal[] {
  return signals.map((signal) => {
    const weight = weights[signal.system];
    if (weight === undefined) return signal; // No performance data, keep as-is

    if (weight === 0) {
      // Disabled: treat as neutral
      return { ...signal, strength: 0, direction: "neutral" as const };
    }

    // Scale strength by weight
    return { ...signal, strength: Math.round(signal.strength * weight) };
  });
}
