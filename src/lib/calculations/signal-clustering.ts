import type {
  MechanicalSignal,
  FullRegime,
  StructureRegime,
} from "@/lib/types/signals";

// ==================== CLUSTER TYPES ====================

export type SignalCluster = "trend" | "mean_reversion" | "momentum" | "volume" | "reversal";

export interface ClusterScore {
  cluster: SignalCluster;
  bestSignal: MechanicalSignal | null;
  effectiveScore: number;
  signalCount: number;
  weight: number;
}

// ==================== CLUSTER MAPPING ====================

const SIGNAL_CLUSTER_MAP: Record<string, SignalCluster> = {
  "Trend Stack": "trend",
  "RSI Extremes": "mean_reversion",
  "Elder Impulse": "momentum",
  "Volume Confirmation": "volume",
  "SFP": "reversal",
  "IDF": "reversal",
  "OB Retest": "reversal",
};

// ==================== REGIME-DEPENDENT WEIGHTS ====================

/**
 * Cluster weights vary by market structure.
 * In a trend, trend signals carry more weight.
 * In a range, mean reversion signals dominate.
 * In a breakout, momentum matters most.
 */
const CLUSTER_WEIGHTS: Record<StructureRegime, Record<SignalCluster, number>> = {
  trend:    { trend: 0.35, mean_reversion: 0.05, momentum: 0.30, volume: 0.20, reversal: 0.10 },
  range:    { trend: 0.10, mean_reversion: 0.35, momentum: 0.25, volume: 0.15, reversal: 0.15 },
  breakout: { trend: 0.25, mean_reversion: 0.05, momentum: 0.35, volume: 0.25, reversal: 0.10 },
};

const DEFAULT_WEIGHTS: Record<SignalCluster, number> = {
  trend: 0.28, mean_reversion: 0.18, momentum: 0.27, volume: 0.17, reversal: 0.10,
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
    volume: [],
    reversal: [],
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
): { agreement: number; clusters: ClusterScore[]; activeClusters: number } {
  const clusters = clusterSignals(signals, direction, fullRegime);

  // Sum of effective scores across all clusters
  const totalEffective = clusters.reduce((sum, c) => sum + c.effectiveScore, 0);

  // Normalize: max possible is ~100 (all clusters firing at max strength)
  // Scale to 0-40 range for compatibility
  const agreement = Math.min(40, (totalEffective / 100) * 40);

  // Count how many independent clusters have at least one signal agreeing with direction.
  // This replaces raw signal count for tier thresholds — prevents correlated
  // signals (e.g. 4 trend indicators) from inflating conviction tier.
  const activeClusters = clusters.filter((c) => c.bestSignal !== null && c.effectiveScore > 0).length;

  return { agreement, clusters, activeClusters };
}

// ==================== CLUSTER CONFLICT DETECTION ====================

/**
 * Detect conflicting clusters that should not agree simultaneously.
 * Trend + Mean Reversion active at the same time is almost always bad
 * regime classification rather than a genuine signal.
 *
 * Returns a penalty value (always <= 0).
 */
export function detectClusterConflict(
  clusters: ClusterScore[]
): { penalty: number; reason: string | null } {
  const trend = clusters.find((c) => c.cluster === "trend");
  const mr = clusters.find((c) => c.cluster === "mean_reversion");

  const trendActive = trend && trend.bestSignal !== null && trend.effectiveScore > 0;
  const mrActive = mr && mr.bestSignal !== null && mr.effectiveScore > 0;

  // Trend + MR conflict (most suspicious)
  if (trendActive && mrActive) {
    const trendDir = trend!.bestSignal!.direction;
    const mrDir = mr!.bestSignal!.direction;
    if (trendDir !== mrDir) {
      return { penalty: -15, reason: "Trend + MR clusters active in opposing directions" };
    }
    // Same direction still suspicious (regime likely misclassified)
    return { penalty: -10, reason: "Trend + MR clusters both active — possible regime misclassification" };
  }

  // Any two active clusters with opposing best signal directions
  const activeClusters = clusters.filter(
    (c) => c.bestSignal !== null && c.effectiveScore > 0
  );
  if (activeClusters.length >= 2) {
    const directions = activeClusters.map((c) => c.bestSignal!.direction);
    const hasBullish = directions.includes("bullish");
    const hasBearish = directions.includes("bearish");
    if (hasBullish && hasBearish) {
      return { penalty: -10, reason: "Active clusters disagree on direction" };
    }
  }

  return { penalty: 0, reason: null };
}
