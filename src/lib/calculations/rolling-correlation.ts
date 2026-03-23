// ==================== ROLLING CORRELATION ====================
// Dynamic Pearson correlation between instrument pairs using daily closes.
// Replaces static correlation groups when sufficient data is available.

import type { OHLCV } from "@/lib/types/market";

export interface CorrelationResult {
  pair: [string, string];
  correlation: number; // -1 to +1
  sampleSize: number;
}

export interface CorrelationMatrix {
  results: CorrelationResult[];
  timestamp: number;
}

export const CORRELATION_WARNING = 0.70;
export const CORRELATION_BLOCK = 0.85;

/**
 * Pearson correlation between two price series.
 * Returns 0 if insufficient data (< 10 points).
 */
export function pearsonCorrelation(seriesA: number[], seriesB: number[]): number {
  const n = Math.min(seriesA.length, seriesB.length);
  if (n < 10) return 0;

  const a = seriesA.slice(-n);
  const b = seriesB.slice(-n);

  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;

  let covAB = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    covAB += da * db;
    varA += da * da;
    varB += db * db;
  }

  const denom = Math.sqrt(varA * varB);
  return denom > 0 ? covAB / denom : 0;
}

/**
 * Build correlation matrix from daily candles for all instruments.
 */
export function buildCorrelationMatrix(
  dailyCandles: Record<string, OHLCV[]>,
  windowSize: number = 30,
): CorrelationMatrix {
  const instruments = Object.keys(dailyCandles);
  const results: CorrelationResult[] = [];

  for (let i = 0; i < instruments.length; i++) {
    for (let j = i + 1; j < instruments.length; j++) {
      const a = dailyCandles[instruments[i]];
      const b = dailyCandles[instruments[j]];
      if (!a || !b || a.length < windowSize || b.length < windowSize) continue;

      const closesA = a.slice(-windowSize).map((c) => c.close);
      const closesB = b.slice(-windowSize).map((c) => c.close);
      const corr = pearsonCorrelation(closesA, closesB);

      results.push({
        pair: [instruments[i], instruments[j]],
        correlation: Number(corr.toFixed(3)),
        sampleSize: Math.min(closesA.length, closesB.length),
      });
    }
  }

  return { results, timestamp: Date.now() };
}

/**
 * Check if a new instrument is too correlated with existing open positions.
 * Returns { blocked, warnings }.
 */
export function checkDynamicCorrelation(
  newInstrumentId: string,
  activeInstrumentIds: string[],
  matrix: CorrelationMatrix,
  maxCorrelated: number = 2,
): { blocked: boolean; warnings: string[] } {
  const warnings: string[] = [];
  let highCorrelationCount = 0;

  for (const activeId of activeInstrumentIds) {
    const result = matrix.results.find(
      (r) =>
        (r.pair[0] === newInstrumentId && r.pair[1] === activeId) ||
        (r.pair[1] === newInstrumentId && r.pair[0] === activeId),
    );
    if (!result) continue;

    const absCorr = Math.abs(result.correlation);
    if (absCorr >= CORRELATION_BLOCK) {
      highCorrelationCount++;
      warnings.push(
        `${newInstrumentId} <> ${activeId}: ${(absCorr * 100).toFixed(0)}% correlated (BLOCK)`,
      );
    } else if (absCorr >= CORRELATION_WARNING) {
      warnings.push(
        `${newInstrumentId} <> ${activeId}: ${(absCorr * 100).toFixed(0)}% correlated (WARNING)`,
      );
    }
  }

  return {
    blocked: highCorrelationCount >= maxCorrelated,
    warnings,
  };
}
