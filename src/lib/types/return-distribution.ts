/**
 * Stub interfaces for future return distribution modeling.
 * Not yet implemented — reserved for Phase 3 (longer term).
 */

export interface ReturnDistribution {
  instrumentId: string;
  timeframe: string;
  sampleSize: number;
  mean: number;
  stdDev: number;
  skewness: number;
  kurtosis: number;
  percentiles: Record<number, number>;
}

export interface TailRiskMetrics {
  valueAtRisk95: number;
  expectedShortfall: number;
  maxObservedDrawdown: number;
}
