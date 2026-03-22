import type {
  MechanicalSignal,
  FullRegime,
  StructureRegime,
} from "@/lib/types/signals";

// ==================== CLUSTER TYPES ====================

export type SignalCluster = "trend" | "mean_reversion" | "momentum";

export interface ClusterScore {
  cluster: SignalCluster;
  bestSignal: MechanicalSignal | null;
  effectiveScore: number;
  signalCount: number;
  weight: number;
}

// ==================== CLUSTER MAPPING ====================

const SIGNAL_CLUSTER_MAP: Record<string, SignalCluster> = {
  "MA Crossover": "trend",
  "MACD": "trend",
  "BB Breakout": "trend",
  "Trend Stack": "trend",
  "RSI Extremes": "mean_reversion",
  "BB MR": "mean_reversion",
  "Elder Impulse": "momentum",
  "Elder-Ray": "momentum",
};

// ==================== REGIME-DEPENDENT WEIGHTS ====================

/**
 * Cluster weights vary by market structure.
 * In a trend, trend signals carry more weight.
 * In a range, mean reversion signals dominate.
 * In a breakout, momentum matters most.
 */
const CLUSTER_WEIGHTS: Record<StructureRegime, Record<SignalCluster, number>> = {
  trend:    { trend: 0.45, mean_reversion: 0.15, momentum: 0.40 },
  range:    { trend: 0.15, mean_reversion: 0.45, momentum: 0.40 },
  breakout: { trend: 0.35, mean_reversion: 0.10, momentum: 0.55 },
};

const DEFAULT_WEIGHTS: Record<SignalCluster, number> = {
  trend: 0.35, mean_reversion: 0.25, momentum: 0.40,
};

export function getClusterWeights(fullRegime?: FullRegime): Record<SignalCluster, number> {
  if (!fullRegime) return DEFAULT_WEIGHTS;
  return CLUSTER_WEIGHTS[fullRegime.structure] ?? DEFAULT_WEIGHTS;
}

// ==================== CLUSTERING ====================

/**
 * Group signals into clusters and pick the best signal per cluster
 * for the given direction. Only signals agreeing with `direction` contribute.
 * Within each cluster, only the strongest signal counts — this prevents
 * correlated signals (e.g., 4 trend indicators) from inflating conviction.
 */
export function clusterSignals(
  signals: MechanicalSignal[],
  direction: "bullish" | "bearish",
  fullRegime?: FullRegime
): ClusterScore[] {
  const weights = getClusterWeights(fullRegime);

  const clusters: Record<SignalCluster, MechanicalSignal[]> = {
    trend: [],
    mean_reversion: [],
    momentum: [],
  };

  // Group signals by cluster
  for (const signal of signals) {
    const cluster = SIGNAL_CLUSTER_MAP[signal.system];
    if (cluster && signal.direction === direction) {
      clusters[cluster].push(signal);
    }
  }

  // Build cluster scores — only the best signal per cluster counts
  const result: ClusterScore[] = [];

  for (const cluster of Object.keys(clusters) as SignalCluster[]) {
    const sigs = clusters[cluster];
    const weight = weights[cluster];

    if (sigs.length === 0) {
      result.push({ cluster, bestSignal: null, effectiveScore: 0, signalCount: 0, weight });
      continue;
    }

    // Best signal by strength
    const best = sigs.reduce((a, b) => (b.strength > a.strength ? b : a));
    const effectiveScore = weight * best.strength;

    result.push({ cluster, bestSignal: best, effectiveScore, signalCount: sigs.length, weight });
  }

  return result;
}

// ==================== DE-CORRELATED CONVICTION ====================

/**
 * Compute the de-correlated agreement factor (replaces raw agreeing/total * 40).
 * Returns a value in the range 0-40 for backward compatibility with the
 * existing conviction score scale.
 *
 * The key insight: instead of counting how many of 8 systems agree,
 * we count how many independent clusters agree, weighted by regime.
 */
export function computeDeCorrelatedAgreement(
  signals: MechanicalSignal[],
  direction: "bullish" | "bearish",
  fullRegime?: FullRegime
): { agreement: number; clusters: ClusterScore[] } {
  const clusters = clusterSignals(signals, direction, fullRegime);

  // Sum of effective scores across all clusters
  const totalEffective = clusters.reduce((sum, c) => sum + c.effectiveScore, 0);

  // Normalize: max possible is ~100 (all clusters firing at max strength)
  // Scale to 0-40 range for compatibility
  const agreement = Math.min(40, (totalEffective / 100) * 40);

  return { agreement, clusters };
}
