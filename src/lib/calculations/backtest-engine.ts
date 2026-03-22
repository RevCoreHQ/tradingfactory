import type { OHLCV, Instrument } from "@/lib/types/market";
import type {
  BacktestConfig,
  BacktestTrade,
  BacktestResult,
  BacktestProgress,
} from "@/lib/types/backtest";
import type { TradeDeskSetup, ConvictionTier } from "@/lib/types/signals";
import { calculateAllIndicators } from "./technical-indicators";
import { generateTradeDeskSetup } from "./mechanical-signals";
import {
  computeStats,
  computeSystemBreakdown,
  computeRegimeBreakdown,
  computeConvictionBreakdown,
  computeMonthlyReturns,
} from "./backtest-stats";

// ==================== CONVICTION TIER ORDERING ====================

const TIER_ORDER: Record<ConvictionTier, number> = {
  "A+": 5, "A": 4, "B": 3, "C": 2, "D": 1,
};

function tierPassesMinimum(tier: ConvictionTier, minTier: ConvictionTier): boolean {
  return TIER_ORDER[tier] >= TIER_ORDER[minTier];
}

// ==================== SETUP FILTER ====================

function passesFilters(setup: TradeDeskSetup, config: BacktestConfig): boolean {
  if (setup.direction === "neutral") return false;

  const minConviction = config.minConviction ?? "A";
  if (!tierPassesMinimum(setup.conviction, minConviction)) return false;

  const minRR = config.minRiskReward ?? 1.5;
  if (setup.riskReward[0] < minRR) return false;

  if (config.enforceImpulseGate) {
    if (setup.direction === "bullish" && setup.impulse === "red") return false;
    if (setup.direction === "bearish" && setup.impulse === "green") return false;
  }

  return true;
}

// ==================== TRADE CREATION ====================

let tradeCounter = 0;

function createBacktestTrade(
  setup: TradeDeskSetup,
  barIndex: number,
  timestamp: number,
  instrumentId: string
): BacktestTrade {
  const agreeingSystems = setup.signals
    .filter((s) => s.direction === setup.direction)
    .map((s) => s.system);

  return {
    id: `bt-${++tradeCounter}`,
    instrumentId,
    setup,
    signalBarIndex: barIndex,
    signalTimestamp: timestamp,
    entryBarIndex: null,
    entryTimestamp: null,
    entryPrice: null,
    exitBarIndex: null,
    exitTimestamp: null,
    exitPrice: null,
    outcome: "still_open",
    highestTpHit: 0,
    pnlPercent: 0,
    rMultiple: 0,
    barsInTrade: 0,
    conviction: setup.conviction,
    convictionScore: setup.convictionScore,
    regime: setup.regime,
    direction: setup.direction,
    impulse: setup.impulse,
    tradingStyle: setup.tradingStyle,
    agreeingSystems,
    ictScore: setup.ictContext?.ictScore ?? 0,
  };
}

// ==================== TRADE UPDATE (BAR-BY-BAR) ====================

function updateTradeWithBar(
  trade: BacktestTrade,
  bar: OHLCV,
  barIndex: number,
  config: BacktestConfig
): BacktestTrade {
  const setup = trade.setup;
  const isBull = setup.direction === "bullish";

  // If not yet entered, check entry zone activation
  if (trade.entryPrice === null) {
    const [lo, hi] = setup.entry[0] < setup.entry[1]
      ? [setup.entry[0], setup.entry[1]]
      : [setup.entry[1], setup.entry[0]];

    if (bar.low <= hi && bar.high >= lo) {
      // Price touched entry zone — activate
      trade = {
        ...trade,
        entryPrice: (lo + hi) / 2,
        entryBarIndex: barIndex,
        entryTimestamp: bar.timestamp,
      };
    } else {
      // Check expiry for pending trades
      trade = { ...trade, barsInTrade: trade.barsInTrade + 1 };
      const expiryBars = config.tradingStyle === "intraday" ? 8 : 24;
      if (trade.barsInTrade > expiryBars) {
        return {
          ...trade,
          outcome: "expired",
          exitBarIndex: barIndex,
          exitTimestamp: bar.timestamp,
          exitPrice: bar.close,
          pnlPercent: 0,
          rMultiple: 0,
        };
      }
      return trade;
    }
  }

  trade = { ...trade, barsInTrade: trade.barsInTrade + 1 };

  const entryMid = trade.entryPrice!;
  const slDistance = Math.abs(entryMid - setup.stopLoss);

  // Effective SL moves to breakeven after TP1
  const effectiveSL = trade.highestTpHit >= 1 ? entryMid : setup.stopLoss;

  // Check SL hit
  const slHit = isBull ? bar.low <= effectiveSL : bar.high >= effectiveSL;
  if (slHit) {
    const exitPrice = effectiveSL;
    const rawPnl = isBull ? exitPrice - entryMid : entryMid - exitPrice;
    const pnlPercent = (rawPnl / entryMid) * 100;
    const rMultiple = slDistance > 0 ? rawPnl / slDistance : 0;

    // If we already hit TP1+, this is a win (partial profit already banked)
    const isWin = trade.highestTpHit >= 1;
    // Calculate blended P&L from partial exits
    const blendedPnl = isWin ? computeBlendedPnl(trade, exitPrice) : pnlPercent;
    const blendedR = isWin ? computeBlendedR(trade, exitPrice, slDistance) : rMultiple;

    return {
      ...trade,
      outcome: isWin ? "win" : "loss",
      exitBarIndex: barIndex,
      exitTimestamp: bar.timestamp,
      exitPrice,
      pnlPercent: blendedPnl,
      rMultiple: blendedR,
    };
  }

  // Check TPs progressively
  let updatedTrade = { ...trade };
  const tpTargets = setup.takeProfit;
  for (let tp = updatedTrade.highestTpHit; tp < 3; tp++) {
    const tpPrice = tpTargets[tp as 0 | 1 | 2];
    const tpHit = isBull ? bar.high >= tpPrice : bar.low <= tpPrice;

    if (tpHit) {
      updatedTrade = { ...updatedTrade, highestTpHit: (tp + 1) as 1 | 2 | 3 };

      if (tp === 2) {
        // TP3 hit — full exit
        const blendedPnl = computeBlendedPnl(updatedTrade, tpPrice);
        const blendedR = computeBlendedR(updatedTrade, tpPrice, slDistance);
        return {
          ...updatedTrade,
          outcome: "win" as const,
          exitBarIndex: barIndex,
          exitTimestamp: bar.timestamp,
          exitPrice: tpPrice as number,
          pnlPercent: blendedPnl,
          rMultiple: blendedR,
        };
      }
    } else {
      break;
    }
  }

  return updatedTrade;
}

// ==================== BLENDED P&L (Partial Exits) ====================

// 33% closed at TP1, 33% at TP2, 34% at TP3, remainder at final exit
function computeBlendedPnl(trade: BacktestTrade, finalExitPrice: number): number {
  const entryMid = trade.entryPrice!;
  const isBull = trade.direction === "bullish";
  const setup = trade.setup;

  let totalPnl = 0;
  const portions = [0.33, 0.33, 0.34];

  for (let i = 0; i < 3; i++) {
    let exitPrice: number;
    if (i < trade.highestTpHit) {
      exitPrice = setup.takeProfit[i];
    } else if (i === trade.highestTpHit) {
      exitPrice = finalExitPrice;
    } else {
      exitPrice = finalExitPrice;
    }
    const pnl = isBull ? exitPrice - entryMid : entryMid - exitPrice;
    totalPnl += (pnl / entryMid) * 100 * portions[i];
  }

  return totalPnl;
}

function computeBlendedR(
  trade: BacktestTrade,
  finalExitPrice: number,
  slDistance: number
): number {
  if (slDistance === 0) return 0;
  const entryMid = trade.entryPrice!;
  const isBull = trade.direction === "bullish";
  const setup = trade.setup;

  let totalR = 0;
  const portions = [0.33, 0.33, 0.34];

  for (let i = 0; i < 3; i++) {
    let exitPrice: number;
    if (i < trade.highestTpHit) {
      exitPrice = setup.takeProfit[i];
    } else {
      exitPrice = finalExitPrice;
    }
    const pnl = isBull ? exitPrice - entryMid : entryMid - exitPrice;
    totalR += (pnl / slDistance) * portions[i];
  }

  return totalR;
}

// ==================== MASTER BACKTEST FUNCTION ====================

export function runBacktest(
  candles: OHLCV[],
  instrument: Instrument,
  config: BacktestConfig,
  onProgress?: (progress: BacktestProgress) => void
): BacktestResult {
  const startTime = performance.now();
  tradeCounter = 0;

  const trades: BacktestTrade[] = [];
  let openTrade: BacktestTrade | null = null;
  let lastSetupDirection: string | null = null;
  let lastSetupBar = -Infinity;

  const totalSteps = candles.length - config.windowSize;

  if (totalSteps <= 0) {
    return emptyResult(config);
  }

  for (let i = config.windowSize; i < candles.length; i += config.stepSize) {
    const window = candles.slice(i - config.windowSize, i);
    const currentBar = candles[i];

    // 1. Update open trade with current bar
    if (openTrade && openTrade.outcome === "still_open") {
      openTrade = updateTradeWithBar(openTrade, currentBar, i, config);

      if (openTrade.outcome !== "still_open") {
        trades.push(openTrade);
        openTrade = null;
      }
    }

    // 2. Check for new setup if no open trade
    if (!openTrade) {
      // Minimum gap between signals to avoid rapid re-entry on same direction
      if (i - lastSetupBar < 3) continue;

      const summary = calculateAllIndicators(window, instrument.id, config.timeframe);
      const setup = generateTradeDeskSetup(
        window,
        summary,
        instrument,
        config.riskPercent,
        undefined,
        config.tradingStyle,
        undefined,
        config.overrides
      );

      if (passesFilters(setup, config)) {
        // Avoid re-entering same direction immediately after a loss
        if (setup.direction === lastSetupDirection && i - lastSetupBar < 10) continue;

        openTrade = createBacktestTrade(setup, i, currentBar.timestamp, instrument.id);

        // Check if current bar already activates entry
        openTrade = updateTradeWithBar(openTrade, currentBar, i, config);

        if (openTrade.outcome !== "still_open") {
          trades.push(openTrade);
          lastSetupDirection = setup.direction;
          lastSetupBar = i;
          openTrade = null;
        } else {
          lastSetupDirection = setup.direction;
          lastSetupBar = i;
        }
      }
    }

    // 3. Report progress
    if (onProgress && (i - config.windowSize) % 50 === 0) {
      onProgress({
        status: "running",
        currentBar: i - config.windowSize,
        totalBars: totalSteps,
        tradesFound: trades.length + (openTrade ? 1 : 0),
        percentComplete: ((i - config.windowSize) / totalSteps) * 100,
      });
    }
  }

  // Close any remaining open trade as expired
  if (openTrade && openTrade.outcome === "still_open") {
    const lastBar = candles[candles.length - 1];
    openTrade = {
      ...openTrade,
      outcome: "expired",
      exitBarIndex: candles.length - 1,
      exitTimestamp: lastBar.timestamp,
      exitPrice: lastBar.close,
      pnlPercent: 0,
      rMultiple: 0,
    };
    trades.push(openTrade);
  }

  const { stats, equityCurve } = computeStats(trades, config.accountEquity);

  return {
    config,
    trades,
    stats,
    equityCurve,
    systemBreakdown: computeSystemBreakdown(trades),
    regimeBreakdown: computeRegimeBreakdown(trades),
    convictionBreakdown: computeConvictionBreakdown(trades),
    monthlyReturns: computeMonthlyReturns(trades),
    runTimestamp: Date.now(),
    totalBarsProcessed: totalSteps,
    candleCount: candles.length,
    computeTimeMs: performance.now() - startTime,
  };
}

// ==================== ASYNC WRAPPER (chunked for UI) ====================

export function runBacktestAsync(
  candles: OHLCV[],
  instrument: Instrument,
  config: BacktestConfig,
  onProgress?: (progress: BacktestProgress) => void
): Promise<BacktestResult> {
  return new Promise((resolve) => {
    // Use setTimeout to yield to the main thread before running
    setTimeout(() => {
      const result = runBacktest(candles, instrument, config, onProgress);
      resolve(result);
    }, 0);
  });
}

// ==================== EMPTY RESULT ====================

function emptyResult(config: BacktestConfig): BacktestResult {
  return {
    config,
    trades: [],
    stats: {
      totalTrades: 0, wins: 0, losses: 0, breakevens: 0, expired: 0,
      winRate: 0, avgWinR: 0, avgLossR: 0, expectancy: 0, profitFactor: 0,
      sharpeRatio: 0, sortinoRatio: 0, maxDrawdownPercent: 0, maxDrawdownR: 0,
      avgBarsInTrade: 0, totalReturnPercent: 0, totalReturnR: 0, recoveryFactor: 0,
      consecutiveWins: 0, consecutiveLosses: 0, avgTradesPerMonth: 0,
    },
    equityCurve: [],
    systemBreakdown: [],
    regimeBreakdown: [],
    convictionBreakdown: [],
    monthlyReturns: [],
    runTimestamp: Date.now(),
    totalBarsProcessed: 0,
    candleCount: 0,
    computeTimeMs: 0,
  };
}
