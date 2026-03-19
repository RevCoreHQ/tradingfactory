import type {
  ConfluencePattern,
  TrackedSetup,
  ConvictionTier,
} from "@/lib/types/signals";

const MIN_TRADES_FOR_ADJUSTMENT = 5;

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

  // Recalculate multiplier and conviction adjust
  updated.riskMultiplier = calculateRiskMultiplier(updated);
  updated.convictionAdjust = calculateConvictionAdjust(updated);

  return updated;
}

// ==================== RISK MULTIPLIER ====================

export function calculateRiskMultiplier(pattern: ConfluencePattern): number {
  if (pattern.trades < MIN_TRADES_FOR_ADJUSTMENT) return 1.0;

  const wr = pattern.winRate;
  if (wr >= 0.75) return 1.5;
  if (wr >= 0.60) return 1.25;
  if (wr >= 0.50) return 1.0;
  if (wr >= 0.30) return 0.75;
  return 0.5;
}

// ==================== CONVICTION ADJUST ====================

export function calculateConvictionAdjust(pattern: ConfluencePattern): number {
  if (pattern.trades < MIN_TRADES_FOR_ADJUSTMENT) return 0;

  // Scale from -15 to +15 based on win rate distance from 50%
  const deviation = pattern.winRate - 0.5;
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
    winRate: pattern.winRate,
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
