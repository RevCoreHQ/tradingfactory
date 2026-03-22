import type {
  ConfluencePattern,
  TrackedSetup,
  ConvictionTier,
} from "@/lib/types/signals";

// Minimum sample size before learning adjustments apply.
// Raised from 10 to 20: at n=10, a 60% win rate has a 95% CI of ±31%,
// making any EV-based adjustment statistically unreliable. At n=20 the
// CI narrows to ±21% — still wide but actionable for position sizing.
const MIN_TRADES_FOR_ADJUSTMENT = 20;
const MAX_TRADE_HISTORY = 100;
const DECAY_HALFLIFE_DAYS = 30;

// ==================== TIME DECAY ====================

/**
 * Exponential time decay weight.
 * Trade from today = 1.0, trade from 30 days ago = 0.5, etc.
 */
export function timeDecayWeight(tradeTimestamp: number, now?: number): number {
  const current = now ?? Date.now();
  const daysSince = (current - tradeTimestamp) / (1000 * 60 * 60 * 24);
  return Math.exp(-Math.LN2 * daysSince / DECAY_HALFLIFE_DAYS);
}

// ==================== DECAYED WIN RATE ====================

/**
 * Compute time-weighted win rate from trade history.
 * Recent trades contribute more to the win rate.
 */
export function computeDecayedWinRate(
  history: NonNullable<ConfluencePattern["tradeHistory"]>
): number {
  if (history.length === 0) return 0;

  let weightedWins = 0;
  let weightedTotal = 0;

  for (const trade of history) {
    if (trade.outcome === "breakeven") continue;
    const w = timeDecayWeight(trade.timestamp);
    weightedTotal += w;
    if (trade.outcome === "win") weightedWins += w;
  }

  return weightedTotal > 0 ? weightedWins / weightedTotal : 0;
}

// ==================== EXPECTANCY ====================

/**
 * Compute expected value (expectancy) in R-multiples.
 * EV = (winRate × avgWinR) - ((1 - winRate) × avgLossR)
 */
export function computeExpectancy(pattern: ConfluencePattern): number {
  const wr = pattern.decayedWinRate ?? pattern.winRate;
  const avgWin = pattern.avgWinR ?? 1.5;
  const avgLoss = pattern.avgLossR ?? 1.0;

  if (pattern.trades < MIN_TRADES_FOR_ADJUSTMENT) return 0;

  return (wr * avgWin) - ((1 - wr) * avgLoss);
}

/**
 * Compute Kelly fraction (capped at 25% to prevent overbetting).
 * Kelly = (winRate × avgWinR - (1 - winRate) × avgLossR) / avgWinR
 */
export function computeKellyFraction(pattern: ConfluencePattern): number {
  const wr = pattern.decayedWinRate ?? pattern.winRate;
  const avgWin = pattern.avgWinR ?? 1.5;
  const avgLoss = pattern.avgLossR ?? 1.0;

  if (avgWin === 0 || pattern.trades < MIN_TRADES_FOR_ADJUSTMENT) return 0;

  const kelly = (wr * avgWin - (1 - wr) * avgLoss) / avgWin;
  return Math.max(0, Math.min(0.25, kelly));
}

// ==================== RECORD OUTCOME ====================

export function recordOutcome(
  existing: ConfluencePattern | null,
  tracked: TrackedSetup
): ConfluencePattern {
  const base: ConfluencePattern = existing ?? {
    key: tracked.confluenceKey,
    trades: 0,
    wins: 0,
    losses: 0,
    breakevens: 0,
    winRate: 0,
    avgPnlPercent: 0,
    riskMultiplier: 1.0,
    convictionAdjust: 0,
    lastUpdated: Date.now(),
  };

  const updated = { ...base };
  updated.trades += 1;
  updated.lastUpdated = Date.now();

  if (tracked.outcome === "win") updated.wins += 1;
  else if (tracked.outcome === "loss") updated.losses += 1;
  else updated.breakevens += 1;

  // Win rate (exclude breakevens from denominator)
  const decisions = updated.wins + updated.losses;
  updated.winRate = decisions > 0 ? updated.wins / decisions : 0;

  // Running average P&L
  const pnl = tracked.pnlPercent ?? 0;
  updated.avgPnlPercent =
    ((base.avgPnlPercent * base.trades) + pnl) / updated.trades;

  // Compute R-multiple for this trade
  const entryMid = (tracked.setup.entry[0] + tracked.setup.entry[1]) / 2;
  const slDist = Math.abs(entryMid - tracked.setup.stopLoss);
  const rMultiple = slDist > 0 ? (pnl / 100) * entryMid / slDist : 0;

  // Update trade history (keep last N trades for decay weighting)
  const history = [...(updated.tradeHistory ?? [])];
  history.push({
    timestamp: Date.now(),
    outcome: tracked.outcome ?? "breakeven",
    pnlPercent: pnl,
    rMultiple: Number(rMultiple.toFixed(2)),
  });
  if (history.length > MAX_TRADE_HISTORY) {
    history.splice(0, history.length - MAX_TRADE_HISTORY);
  }
  updated.tradeHistory = history;

  // Update R-multiple averages
  const winTrades = history.filter((t) => t.outcome === "win");
  const lossTrades = history.filter((t) => t.outcome === "loss");
  updated.avgWinR = winTrades.length > 0
    ? winTrades.reduce((sum, t) => sum + Math.abs(t.rMultiple), 0) / winTrades.length
    : undefined;
  updated.avgLossR = lossTrades.length > 0
    ? lossTrades.reduce((sum, t) => sum + Math.abs(t.rMultiple), 0) / lossTrades.length
    : undefined;

  // Max drawdown
  const allLossRs = lossTrades.map((t) => Math.abs(t.rMultiple));
  updated.maxDrawdownR = allLossRs.length > 0 ? Math.max(...allLossRs) : undefined;

  // Decayed win rate
  updated.decayedWinRate = computeDecayedWinRate(history);

  // Expectancy and Kelly
  updated.expectancy = computeExpectancy(updated);
  updated.kellyFraction = computeKellyFraction(updated);

  // Recalculate multiplier and conviction adjust (now expectancy-based)
  updated.riskMultiplier = calculateRiskMultiplier(updated);
  updated.convictionAdjust = calculateConvictionAdjust(updated);

  return updated;
}

// ==================== RISK MULTIPLIER (Expectancy-Based) ====================

export function calculateRiskMultiplier(pattern: ConfluencePattern): number {
  if (pattern.trades < MIN_TRADES_FOR_ADJUSTMENT) return 1.0;

  // Use expectancy if available, otherwise fall back to win rate
  const ev = pattern.expectancy;
  if (ev !== undefined) {
    if (ev > 1.0) return 1.5;   // Strong positive expectancy
    if (ev > 0.5) return 1.25;  // Good positive expectancy
    if (ev > 0.0) return 1.0;   // Marginally profitable
    if (ev > -0.3) return 0.75; // Slightly negative, within noise
    return 0.5;                  // Clearly unprofitable
  }

  // Fallback: win-rate based (legacy patterns without expectancy)
  const wr = pattern.decayedWinRate ?? pattern.winRate;
  if (wr >= 0.75) return 1.5;
  if (wr >= 0.60) return 1.25;
  if (wr >= 0.50) return 1.0;
  if (wr >= 0.30) return 0.75;
  return 0.5;
}

// ==================== CONVICTION ADJUST ====================

export function calculateConvictionAdjust(pattern: ConfluencePattern): number {
  if (pattern.trades < MIN_TRADES_FOR_ADJUSTMENT) return 0;

  // Use expectancy-based adjustment if available
  const ev = pattern.expectancy;
  if (ev !== undefined) {
    // Scale from -15 to +15 based on expectancy
    return Math.round(Math.max(-15, Math.min(15, ev * 10)));
  }

  // Fallback: win rate deviation from 50%
  const wr = pattern.decayedWinRate ?? pattern.winRate;
  const deviation = wr - 0.5;
  return Math.round(Math.max(-15, Math.min(15, deviation * 60)));
}

// ==================== APPLY LEARNING ====================

export function applyLearning(
  convictionScore: number,
  riskAmount: number,
  lots: number,
  pattern: ConfluencePattern | null
): {
  adjustedScore: number;
  adjustedRisk: number;
  adjustedLots: number;
  applied: boolean;
  riskMultiplier: number;
  convictionAdjust: number;
  winRate: number;
  trades: number;
} {
  if (!pattern || pattern.trades < MIN_TRADES_FOR_ADJUSTMENT) {
    return {
      adjustedScore: convictionScore,
      adjustedRisk: riskAmount,
      adjustedLots: lots,
      applied: false,
      riskMultiplier: 1.0,
      convictionAdjust: 0,
      winRate: 0,
      trades: 0,
    };
  }

  const adjustedScore = Math.max(0, Math.min(100, convictionScore + pattern.convictionAdjust));
  const adjustedRisk = Number((riskAmount * pattern.riskMultiplier).toFixed(0));
  const adjustedLots = Number(Math.max(0.01, lots * pattern.riskMultiplier).toFixed(2));

  return {
    adjustedScore,
    adjustedRisk,
    adjustedLots,
    applied: true,
    riskMultiplier: pattern.riskMultiplier,
    convictionAdjust: pattern.convictionAdjust,
    winRate: pattern.decayedWinRate ?? pattern.winRate,
    trades: pattern.trades,
  };
}

// ==================== RE-TIER ====================

export function adjustedTier(score: number): ConvictionTier {
  if (score >= 75) return "A+";
  if (score >= 60) return "A";
  if (score >= 40) return "B";
  if (score >= 25) return "C";
  return "D";
}
