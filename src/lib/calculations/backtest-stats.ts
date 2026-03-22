import type {
  BacktestTrade,
  BacktestStats,
  EquityPoint,
  SystemBreakdown,
  RegimeBreakdown,
  ConvictionBreakdown,
  MonthlyReturn,
} from "@/lib/types/backtest";
import type { ConvictionTier, MarketRegime } from "@/lib/types/signals";

// ==================== Core Statistics ====================

export function computeStats(
  trades: BacktestTrade[],
  startingEquity: number
): { stats: BacktestStats; equityCurve: EquityPoint[] } {
  const resolved = trades.filter((t) => t.outcome !== "still_open");
  const wins = resolved.filter((t) => t.outcome === "win");
  const losses = resolved.filter((t) => t.outcome === "loss");
  const breakevens = resolved.filter((t) => t.outcome === "breakeven");
  const expired = resolved.filter((t) => t.outcome === "expired");

  const decisiveTrades = wins.length + losses.length;
  const winRate = decisiveTrades > 0 ? wins.length / decisiveTrades : 0;
  const avgWinR = wins.length > 0 ? wins.reduce((s, t) => s + t.rMultiple, 0) / wins.length : 0;
  const avgLossR = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.rMultiple, 0) / losses.length) : 0;
  const expectancy = decisiveTrades > 0 ? (winRate * avgWinR) - ((1 - winRate) * avgLossR) : 0;

  const grossProfit = wins.reduce((s, t) => s + t.pnlPercent, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPercent, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Build equity curve
  const equityCurve: EquityPoint[] = [];
  let equity = startingEquity;
  let peakEquity = startingEquity;
  let maxDDPercent = 0;
  let maxDDR = 0;

  equityCurve.push({ barIndex: 0, timestamp: 0, equity, drawdownPercent: 0 });

  for (const trade of resolved) {
    const pnlAmount = equity * (trade.pnlPercent / 100);
    equity += pnlAmount;
    peakEquity = Math.max(peakEquity, equity);
    const dd = peakEquity > 0 ? ((peakEquity - equity) / peakEquity) * 100 : 0;
    maxDDPercent = Math.max(maxDDPercent, dd);

    equityCurve.push({
      barIndex: trade.exitBarIndex ?? trade.signalBarIndex,
      timestamp: trade.exitTimestamp ?? trade.signalTimestamp,
      equity,
      drawdownPercent: dd,
      tradeId: trade.id,
    });
  }

  // Max drawdown in R
  const rMultiples = resolved.map((t) => t.rMultiple);
  let runningR = 0;
  let peakR = 0;
  for (const r of rMultiples) {
    runningR += r;
    peakR = Math.max(peakR, runningR);
    maxDDR = Math.max(maxDDR, peakR - runningR);
  }

  const totalReturnPercent = startingEquity > 0 ? ((equity - startingEquity) / startingEquity) * 100 : 0;
  const totalReturnR = rMultiples.reduce((s, r) => s + r, 0);

  // Sharpe & Sortino
  const returns = resolved.map((t) => t.pnlPercent);
  const sharpeRatio = computeSharpeRatio(returns);
  const sortinoRatio = computeSortinoRatio(returns);

  // Consecutive wins/losses
  let maxConsecWins = 0;
  let maxConsecLosses = 0;
  let currentStreak = 0;
  let currentOutcome: string | null = null;
  for (const t of resolved) {
    if (t.outcome === currentOutcome) {
      currentStreak++;
    } else {
      currentOutcome = t.outcome;
      currentStreak = 1;
    }
    if (currentOutcome === "win") maxConsecWins = Math.max(maxConsecWins, currentStreak);
    if (currentOutcome === "loss") maxConsecLosses = Math.max(maxConsecLosses, currentStreak);
  }

  // Average bars in trade
  const barsSum = resolved.reduce((s, t) => s + t.barsInTrade, 0);
  const avgBarsInTrade = resolved.length > 0 ? barsSum / resolved.length : 0;

  // Avg trades per month
  const timestamps = resolved.map((t) => t.signalTimestamp).filter((t) => t > 0);
  let avgTradesPerMonth = 0;
  if (timestamps.length >= 2) {
    const spanMs = Math.max(...timestamps) - Math.min(...timestamps);
    const spanMonths = spanMs / (30 * 24 * 60 * 60 * 1000);
    avgTradesPerMonth = spanMonths > 0 ? resolved.length / spanMonths : 0;
  }

  const recoveryFactor = maxDDPercent > 0 ? totalReturnPercent / maxDDPercent : 0;

  return {
    stats: {
      totalTrades: resolved.length,
      wins: wins.length,
      losses: losses.length,
      breakevens: breakevens.length,
      expired: expired.length,
      winRate,
      avgWinR,
      avgLossR,
      expectancy,
      profitFactor,
      sharpeRatio,
      sortinoRatio,
      maxDrawdownPercent: maxDDPercent,
      maxDrawdownR: maxDDR,
      avgBarsInTrade,
      totalReturnPercent,
      totalReturnR,
      recoveryFactor,
      consecutiveWins: maxConsecWins,
      consecutiveLosses: maxConsecLosses,
      avgTradesPerMonth,
    },
    equityCurve,
  };
}

// ==================== Sharpe & Sortino ====================

export function computeSharpeRatio(returns: number[], riskFreeRate: number = 0): number {
  if (returns.length < 2) return 0;
  const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - avg) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  // Annualize assuming ~6 trades/month × 12 months = 72 trades/year
  const periodsPerYear = Math.max(returns.length, 72);
  return ((avg - riskFreeRate) / std) * Math.sqrt(periodsPerYear);
}

export function computeSortinoRatio(returns: number[], riskFreeRate: number = 0): number {
  if (returns.length < 2) return 0;
  const avg = returns.reduce((s, r) => s + r, 0) / returns.length;
  const negReturns = returns.filter((r) => r < 0);
  if (negReturns.length === 0) return avg > 0 ? Infinity : 0;
  const downVariance = negReturns.reduce((s, r) => s + r ** 2, 0) / negReturns.length;
  const downDev = Math.sqrt(downVariance);
  if (downDev === 0) return 0;
  const periodsPerYear = Math.max(returns.length, 72);
  return ((avg - riskFreeRate) / downDev) * Math.sqrt(periodsPerYear);
}

// ==================== Breakdowns ====================

export function computeSystemBreakdown(trades: BacktestTrade[]): SystemBreakdown[] {
  const systemMap = new Map<string, BacktestTrade[]>();

  for (const trade of trades) {
    for (const system of trade.agreeingSystems) {
      const existing = systemMap.get(system) || [];
      existing.push(trade);
      systemMap.set(system, existing);
    }
  }

  return Array.from(systemMap.entries())
    .map(([system, systemTrades]) => {
      const wins = systemTrades.filter((t) => t.outcome === "win");
      const losses = systemTrades.filter((t) => t.outcome === "loss");
      const decisive = wins.length + losses.length;
      const wr = decisive > 0 ? wins.length / decisive : 0;
      const avgWinR = wins.length > 0 ? wins.reduce((s, t) => s + t.rMultiple, 0) / wins.length : 0;
      const avgLossR = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.rMultiple, 0) / losses.length) : 0;

      const grossProfit = wins.reduce((s, t) => s + t.pnlPercent, 0);
      const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPercent, 0));

      return {
        system,
        trades: systemTrades.length,
        winRate: wr,
        expectancy: decisive > 0 ? (wr * avgWinR) - ((1 - wr) * avgLossR) : 0,
        avgStrength: systemTrades.reduce((s, t) => {
          const sig = t.setup.signals.find((sig) => sig.system === system);
          return s + (sig?.strength ?? 0);
        }, 0) / systemTrades.length,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      };
    })
    .sort((a, b) => b.expectancy - a.expectancy);
}

export function computeRegimeBreakdown(trades: BacktestTrade[]): RegimeBreakdown[] {
  const regimeMap = new Map<MarketRegime, BacktestTrade[]>();

  for (const trade of trades) {
    const existing = regimeMap.get(trade.regime) || [];
    existing.push(trade);
    regimeMap.set(trade.regime, existing);
  }

  return Array.from(regimeMap.entries())
    .map(([regime, regimeTrades]) => {
      const wins = regimeTrades.filter((t) => t.outcome === "win");
      const losses = regimeTrades.filter((t) => t.outcome === "loss");
      const decisive = wins.length + losses.length;
      const wr = decisive > 0 ? wins.length / decisive : 0;
      const avgWinR = wins.length > 0 ? wins.reduce((s, t) => s + t.rMultiple, 0) / wins.length : 0;
      const avgLossR = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.rMultiple, 0) / losses.length) : 0;

      const grossProfit = wins.reduce((s, t) => s + t.pnlPercent, 0);
      const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPercent, 0));

      return {
        regime,
        trades: regimeTrades.length,
        winRate: wr,
        expectancy: decisive > 0 ? (wr * avgWinR) - ((1 - wr) * avgLossR) : 0,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
        avgConviction: regimeTrades.reduce((s, t) => s + t.convictionScore, 0) / regimeTrades.length,
      };
    })
    .sort((a, b) => b.expectancy - a.expectancy);
}

export function computeConvictionBreakdown(trades: BacktestTrade[]): ConvictionBreakdown[] {
  const tierMap = new Map<ConvictionTier, BacktestTrade[]>();

  for (const trade of trades) {
    const existing = tierMap.get(trade.conviction) || [];
    existing.push(trade);
    tierMap.set(trade.conviction, existing);
  }

  const tierOrder: ConvictionTier[] = ["A+", "A", "B", "C", "D"];
  return tierOrder
    .filter((tier) => tierMap.has(tier))
    .map((tier) => {
      const tierTrades = tierMap.get(tier)!;
      const wins = tierTrades.filter((t) => t.outcome === "win");
      const losses = tierTrades.filter((t) => t.outcome === "loss");
      const decisive = wins.length + losses.length;
      const wr = decisive > 0 ? wins.length / decisive : 0;
      const avgWinR = wins.length > 0 ? wins.reduce((s, t) => s + t.rMultiple, 0) / wins.length : 0;
      const avgLossR = losses.length > 0 ? Math.abs(losses.reduce((s, t) => s + t.rMultiple, 0) / losses.length) : 0;

      const grossProfit = wins.reduce((s, t) => s + t.pnlPercent, 0);
      const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlPercent, 0));

      return {
        tier,
        trades: tierTrades.length,
        winRate: wr,
        expectancy: decisive > 0 ? (wr * avgWinR) - ((1 - wr) * avgLossR) : 0,
        avgRR: tierTrades.reduce((s, t) => s + t.setup.riskReward[0], 0) / tierTrades.length,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      };
    });
}

export function computeMonthlyReturns(trades: BacktestTrade[]): MonthlyReturn[] {
  const monthMap = new Map<string, BacktestTrade[]>();

  for (const trade of trades) {
    if (trade.outcome === "still_open") continue;
    const ts = trade.exitTimestamp ?? trade.signalTimestamp;
    if (!ts) continue;
    const d = new Date(ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const existing = monthMap.get(key) || [];
    existing.push(trade);
    monthMap.set(key, existing);
  }

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, monthTrades]) => {
      const wins = monthTrades.filter((t) => t.outcome === "win");
      const losses = monthTrades.filter((t) => t.outcome === "loss");
      const decisive = wins.length + losses.length;
      return {
        month,
        returnPercent: monthTrades.reduce((s, t) => s + t.pnlPercent, 0),
        returnR: monthTrades.reduce((s, t) => s + t.rMultiple, 0),
        trades: monthTrades.length,
        winRate: decisive > 0 ? wins.length / decisive : 0,
      };
    });
}
