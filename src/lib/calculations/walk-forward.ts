// ==================== WALK-FORWARD OPTIMIZATION ====================
// Prevents overfitting by splitting data into rolling train/test windows.
// All reported metrics come from out-of-sample (OOS) data only.

import type { OHLCV, Instrument } from "@/lib/types/market";
import type { BacktestConfig, BacktestResult, BacktestStats } from "@/lib/types/backtest";
import { runBacktest } from "./backtest-engine";
import { computeStats } from "./backtest-stats";
import type { BacktestTrade } from "@/lib/types/backtest";

// ==================== TYPES ====================

export interface WalkForwardConfig {
  /** Number of candles in the training window */
  trainBars: number;
  /** Number of candles in the test window */
  testBars: number;
  /** How many candles to advance between windows (defaults to testBars) */
  stepBars?: number;
}

export interface WalkForwardWindow {
  windowIndex: number;
  trainStart: number;
  trainEnd: number;
  testStart: number;
  testEnd: number;
  inSample: BacktestStats;
  outOfSample: BacktestStats;
  trades: BacktestTrade[];
  /** OOS expectancy / IS expectancy — measures overfitting. >0.5 = robust */
  walkForwardEfficiency: number;
}

export interface WalkForwardResult {
  windows: WalkForwardWindow[];
  aggregateOOS: BacktestStats;
  allOOSTrades: BacktestTrade[];
  /** Average WFE across all windows. >0.5 = system is robust, <0.3 = overfit */
  avgWalkForwardEfficiency: number;
  /** Percentage of windows where OOS was profitable */
  oosWinRateByWindow: number;
  totalBarsProcessed: number;
  computeTimeMs: number;
}

// ==================== WALK-FORWARD ENGINE ====================

/**
 * Run a walk-forward analysis on the given candle data.
 *
 * For each rolling window:
 *   1. Train: run backtest on [trainStart..trainEnd] to get IS stats
 *   2. Test:  run backtest on [testEnd-windowSize..testEnd] to get OOS stats
 *   3. Compute Walk-Forward Efficiency = OOS expectancy / IS expectancy
 *
 * The aggregate result combines all OOS trades for the final statistics.
 * This ensures no look-ahead bias — every trade in the aggregate was tested
 * on data the system hadn't "seen" during training.
 */
export function runWalkForward(
  candles: OHLCV[],
  instrument: Instrument,
  backtestConfig: BacktestConfig,
  wfConfig: WalkForwardConfig,
  onProgress?: (windowIndex: number, totalWindows: number) => void,
): WalkForwardResult {
  const startTime = performance.now();
  const { trainBars, testBars, stepBars = testBars } = wfConfig;
  const totalRequired = trainBars + testBars;

  if (candles.length < totalRequired) {
    return emptyWFResult();
  }

  const windows: WalkForwardWindow[] = [];
  const allOOSTrades: BacktestTrade[] = [];
  let windowIndex = 0;

  for (let offset = 0; offset + totalRequired <= candles.length; offset += stepBars) {
    const trainStart = offset;
    const trainEnd = offset + trainBars;
    const testStart = trainEnd;
    const testEnd = Math.min(trainEnd + testBars, candles.length);

    if (testEnd - testStart < backtestConfig.windowSize + 10) break; // not enough test data

    // In-sample backtest (training window)
    const trainCandles = candles.slice(trainStart, trainEnd);
    const isResult = runBacktest(trainCandles, instrument, backtestConfig);

    // Out-of-sample backtest (test window)
    const testCandles = candles.slice(testStart, testEnd);
    const oosResult = runBacktest(testCandles, instrument, backtestConfig);

    // Walk-Forward Efficiency: how much of IS performance carries to OOS
    const wfe = isResult.stats.expectancy > 0
      ? oosResult.stats.expectancy / isResult.stats.expectancy
      : 0;

    windows.push({
      windowIndex,
      trainStart,
      trainEnd,
      testStart,
      testEnd,
      inSample: isResult.stats,
      outOfSample: oosResult.stats,
      trades: oosResult.trades,
      walkForwardEfficiency: Number(wfe.toFixed(3)),
    });

    allOOSTrades.push(...oosResult.trades);
    windowIndex++;

    if (onProgress) {
      const totalWindows = Math.floor((candles.length - totalRequired) / stepBars) + 1;
      onProgress(windowIndex, totalWindows);
    }
  }

  // Aggregate all OOS trades
  const { stats: aggregateOOS } = computeStats(allOOSTrades, backtestConfig.accountEquity);

  // Average WFE
  const avgWFE = windows.length > 0
    ? windows.reduce((s, w) => s + w.walkForwardEfficiency, 0) / windows.length
    : 0;

  // Percentage of windows where OOS was profitable (expectancy > 0)
  const profitableWindows = windows.filter((w) => w.outOfSample.expectancy > 0).length;
  const oosWinRateByWindow = windows.length > 0 ? profitableWindows / windows.length : 0;

  return {
    windows,
    aggregateOOS,
    allOOSTrades,
    avgWalkForwardEfficiency: Number(avgWFE.toFixed(3)),
    oosWinRateByWindow: Number(oosWinRateByWindow.toFixed(3)),
    totalBarsProcessed: candles.length,
    computeTimeMs: performance.now() - startTime,
  };
}

// ==================== ASYNC WRAPPER ====================

export function runWalkForwardAsync(
  candles: OHLCV[],
  instrument: Instrument,
  backtestConfig: BacktestConfig,
  wfConfig: WalkForwardConfig,
  onProgress?: (windowIndex: number, totalWindows: number) => void,
): Promise<WalkForwardResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const result = runWalkForward(candles, instrument, backtestConfig, wfConfig, onProgress);
      resolve(result);
    }, 0);
  });
}

// ==================== EMPTY RESULT ====================

function emptyWFResult(): WalkForwardResult {
  return {
    windows: [],
    aggregateOOS: {
      totalTrades: 0, wins: 0, losses: 0, breakevens: 0, expired: 0,
      winRate: 0, avgWinR: 0, avgLossR: 0, expectancy: 0, profitFactor: 0,
      sharpeRatio: 0, sortinoRatio: 0, maxDrawdownPercent: 0, maxDrawdownR: 0,
      avgBarsInTrade: 0, totalReturnPercent: 0, totalReturnR: 0, recoveryFactor: 0,
      consecutiveWins: 0, consecutiveLosses: 0, avgTradesPerMonth: 0,
    },
    allOOSTrades: [],
    avgWalkForwardEfficiency: 0,
    oosWinRateByWindow: 0,
    totalBarsProcessed: 0,
    computeTimeMs: 0,
  };
}
