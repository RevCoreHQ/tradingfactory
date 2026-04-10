// ==================== MONTE CARLO SIMULATION ====================
// Randomizes trade order to quantify how much of system performance is due
// to sequencing luck vs genuine edge. Produces confidence intervals on
// key metrics (max drawdown, total return, recovery factor).

import type { BacktestTrade } from "@/lib/types/backtest";

// ==================== TYPES ====================

export interface MonteCarloConfig {
  /** Number of random permutations to run (default 1000) */
  iterations: number;
  /** Starting equity for equity curve simulation */
  startingEquity: number;
  /** Confidence levels to report (default [0.05, 0.50, 0.95]) */
  confidenceLevels?: number[];
}

export interface MonteCarloResult {
  iterations: number;
  tradeCount: number;
  /** Confidence intervals for max drawdown % */
  maxDrawdown: ConfidenceInterval;
  /** Confidence intervals for total return % */
  totalReturn: ConfidenceInterval;
  /** Confidence intervals for final equity */
  finalEquity: ConfidenceInterval;
  /** Confidence intervals for consecutive losses */
  consecutiveLosses: ConfidenceInterval;
  /** Probability of ruin (equity drops below 50% of starting) */
  ruinProbability: number;
  /** Probability of a profitable outcome (total return > 0) */
  profitProbability: number;
  computeTimeMs: number;
}

export interface ConfidenceInterval {
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
  mean: number;
}

// ==================== FISHER-YATES SHUFFLE ====================

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ==================== SIMULATE EQUITY CURVE ====================

interface SimulationMetrics {
  maxDrawdownPercent: number;
  totalReturnPercent: number;
  finalEquity: number;
  consecutiveLosses: number;
}

function simulateEquityCurve(
  trades: BacktestTrade[],
  startingEquity: number
): SimulationMetrics {
  let equity = startingEquity;
  let peak = startingEquity;
  let maxDD = 0;
  let consLosses = 0;
  let maxConsLosses = 0;

  for (const trade of trades) {
    if (trade.outcome === "expired" || trade.outcome === "still_open") continue;

    // Apply P&L
    const pnlAmount = (trade.pnlPercent / 100) * equity;
    equity += pnlAmount;

    // Track drawdown
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    if (dd > maxDD) maxDD = dd;

    // Track consecutive losses
    if (trade.outcome === "loss") {
      consLosses++;
      if (consLosses > maxConsLosses) maxConsLosses = consLosses;
    } else {
      consLosses = 0;
    }
  }

  return {
    maxDrawdownPercent: maxDD,
    totalReturnPercent: startingEquity > 0 ? ((equity - startingEquity) / startingEquity) * 100 : 0,
    finalEquity: equity,
    consecutiveLosses: maxConsLosses,
  };
}

// ==================== PERCENTILE HELPER ====================

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function buildCI(values: number[]): ConfidenceInterval {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return {
    p5: Number(percentile(sorted, 0.05).toFixed(2)),
    p25: Number(percentile(sorted, 0.25).toFixed(2)),
    p50: Number(percentile(sorted, 0.50).toFixed(2)),
    p75: Number(percentile(sorted, 0.75).toFixed(2)),
    p95: Number(percentile(sorted, 0.95).toFixed(2)),
    mean: Number(mean.toFixed(2)),
  };
}

// ==================== MAIN FUNCTION ====================

/**
 * Run Monte Carlo simulation by shuffling trade order N times.
 *
 * This answers: "Given my system's trade outcomes, how much could my
 * equity curve vary just from the ORDER of trades?"
 *
 * Key insight: if p5 max drawdown is 30% but p95 is only 35%, the system
 * is robust to sequencing. If p5 is 10% but p95 is 60%, there's high
 * path dependency (luck-driven performance).
 */
export function runMonteCarlo(
  trades: BacktestTrade[],
  config: MonteCarloConfig,
): MonteCarloResult {
  const startTime = performance.now();

  // Filter to only resolved trades
  const resolved = trades.filter(
    (t) => t.outcome === "win" || t.outcome === "loss" || t.outcome === "breakeven"
  );

  if (resolved.length < 5) {
    return emptyMCResult(config);
  }

  const maxDDs: number[] = [];
  const totalReturns: number[] = [];
  const finalEquities: number[] = [];
  const consLosses: number[] = [];
  let ruinCount = 0;
  let profitCount = 0;

  for (let i = 0; i < config.iterations; i++) {
    const shuffled = shuffleArray(resolved);
    const metrics = simulateEquityCurve(shuffled, config.startingEquity);

    maxDDs.push(metrics.maxDrawdownPercent);
    totalReturns.push(metrics.totalReturnPercent);
    finalEquities.push(metrics.finalEquity);
    consLosses.push(metrics.consecutiveLosses);

    if (metrics.finalEquity < config.startingEquity * 0.5) ruinCount++;
    if (metrics.totalReturnPercent > 0) profitCount++;
  }

  return {
    iterations: config.iterations,
    tradeCount: resolved.length,
    maxDrawdown: buildCI(maxDDs),
    totalReturn: buildCI(totalReturns),
    finalEquity: buildCI(finalEquities),
    consecutiveLosses: buildCI(consLosses),
    ruinProbability: Number((ruinCount / config.iterations).toFixed(4)),
    profitProbability: Number((profitCount / config.iterations).toFixed(4)),
    computeTimeMs: performance.now() - startTime,
  };
}

// ==================== ASYNC WRAPPER ====================

export function runMonteCarloAsync(
  trades: BacktestTrade[],
  config: MonteCarloConfig,
): Promise<MonteCarloResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(runMonteCarlo(trades, config));
    }, 0);
  });
}

// ==================== EMPTY RESULT ====================

function emptyMCResult(config: MonteCarloConfig): MonteCarloResult {
  const emptyCI: ConfidenceInterval = { p5: 0, p25: 0, p50: 0, p75: 0, p95: 0, mean: 0 };
  return {
    iterations: config.iterations,
    tradeCount: 0,
    maxDrawdown: emptyCI,
    totalReturn: emptyCI,
    finalEquity: emptyCI,
    consecutiveLosses: emptyCI,
    ruinProbability: 0,
    profitProbability: 0,
    computeTimeMs: 0,
  };
}
