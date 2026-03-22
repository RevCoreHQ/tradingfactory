import type { BacktestResult, Weakness } from "@/lib/types/backtest";

/**
 * Mechanical weakness detection — no LLM needed.
 * Analyzes backtest results and identifies systematic problems.
 */
export function analyzeWeaknesses(result: BacktestResult): Weakness[] {
  const weaknesses: Weakness[] = [];
  const { stats, trades, systemBreakdown, regimeBreakdown } = result;

  if (trades.length < 5) return weaknesses;

  const resolved = trades.filter((t) => t.outcome !== "still_open");
  const wins = resolved.filter((t) => t.outcome === "win");
  const losses = resolved.filter((t) => t.outcome === "loss");

  // 1. Weak signal systems
  for (const sys of systemBreakdown) {
    if (sys.trades >= 10 && sys.winRate < 0.4) {
      weaknesses.push({
        area: `Signal System: ${sys.system}`,
        description: `${sys.system} has a ${(sys.winRate * 100).toFixed(0)}% win rate across ${sys.trades} trades — dragging overall performance`,
        severity: sys.winRate < 0.3 ? "critical" : "moderate",
        evidence: `WR ${(sys.winRate * 100).toFixed(0)}% | Expectancy ${sys.expectancy.toFixed(2)}R | PF ${sys.profitFactor.toFixed(2)}`,
        suggestedFix: `Consider reducing the weight of ${sys.system} or filtering out signals where this is the primary agreeing system`,
      });
    }
  }

  // 2. Regime mismatch
  for (const regime of regimeBreakdown) {
    if (regime.trades >= 5 && regime.expectancy < -0.2) {
      weaknesses.push({
        area: `Regime: ${regime.regime}`,
        description: `Negative expectancy in ${regime.regime} regime — system loses money in this market condition`,
        severity: regime.expectancy < -0.5 ? "critical" : "moderate",
        evidence: `Expectancy ${regime.expectancy.toFixed(2)}R | WR ${(regime.winRate * 100).toFixed(0)}% | ${regime.trades} trades`,
        suggestedFix: `Add a regime filter to avoid trading in ${regime.regime} conditions, or reduce position size`,
      });
    }
  }

  // 3. SL too tight — majority of losses happen in first 2 bars
  if (losses.length >= 5) {
    const earlyLosses = losses.filter((t) => t.barsInTrade <= 2);
    const earlyRatio = earlyLosses.length / losses.length;
    if (earlyRatio > 0.6) {
      weaknesses.push({
        area: "Stop Loss Placement",
        description: `${(earlyRatio * 100).toFixed(0)}% of losses occur within the first 2 bars — stops are likely too tight`,
        severity: "critical",
        evidence: `${earlyLosses.length}/${losses.length} losses within 2 bars`,
        suggestedFix: "Widen the SL multiplier by 0.3-0.5x ATR or use the breakeven mechanism more aggressively",
      });
    }
  }

  // 4. SL too loose — average loss too large
  if (stats.avgLossR > 1.5) {
    weaknesses.push({
      area: "Stop Loss Distance",
      description: `Average loss is ${stats.avgLossR.toFixed(2)}R — stops are too far from entry`,
      severity: stats.avgLossR > 2.0 ? "critical" : "moderate",
      evidence: `Avg Loss: -${stats.avgLossR.toFixed(2)}R | Expected: ~1.0R`,
      suggestedFix: "Tighten the SL multiplier or use structural S/R for tighter stop placement",
    });
  }

  // 5. TP too aggressive — many TP1 hits but few TP2
  if (wins.length >= 10) {
    const tp1Only = wins.filter((t) => t.highestTpHit === 1);
    const tp2Plus = wins.filter((t) => t.highestTpHit >= 2);
    const tp1Ratio = tp1Only.length / wins.length;
    const tp2Ratio = tp2Plus.length / wins.length;

    if (tp1Ratio > 0.5 && tp2Ratio < 0.2) {
      weaknesses.push({
        area: "Take Profit Targets",
        description: `${(tp1Ratio * 100).toFixed(0)}% of wins only reach TP1 — TP2/TP3 targets may be unrealistic`,
        severity: "moderate",
        evidence: `TP1 only: ${tp1Only.length} | TP2+: ${tp2Plus.length} | Total wins: ${wins.length}`,
        suggestedFix: "Tighten TP multipliers or exit more position at TP1 (increase from 33% to 50%)",
      });
    }
  }

  // 6. Entry expiry — too many setups expire without activation
  const expired = resolved.filter((t) => t.outcome === "expired");
  const expiryRatio = resolved.length > 0 ? expired.length / resolved.length : 0;
  if (expiryRatio > 0.3 && expired.length >= 5) {
    weaknesses.push({
      area: "Entry Zone Width",
      description: `${(expiryRatio * 100).toFixed(0)}% of setups expired without entry — entry zones may be too narrow`,
      severity: "moderate",
      evidence: `${expired.length}/${resolved.length} trades expired`,
      suggestedFix: "Widen the entry spread multiplier or use limit order approach at zone boundaries",
    });
  }

  // 7. ICT signal degradation
  const highICT = resolved.filter((t) => t.ictScore >= 50);
  const lowICT = resolved.filter((t) => t.ictScore < 50 && t.ictScore > 0);
  if (highICT.length >= 5 && lowICT.length >= 5) {
    const highWins = highICT.filter((t) => t.outcome === "win").length;
    const lowWins = lowICT.filter((t) => t.outcome === "win").length;
    const highWR = highWins / (highICT.filter((t) => t.outcome === "win" || t.outcome === "loss").length || 1);
    const lowWR = lowWins / (lowICT.filter((t) => t.outcome === "win" || t.outcome === "loss").length || 1);

    if (highWR < lowWR - 0.1) {
      weaknesses.push({
        area: "ICT Confluence",
        description: "High ICT score trades underperform low ICT score trades — ICT signals may not add edge",
        severity: "moderate",
        evidence: `High ICT WR: ${(highWR * 100).toFixed(0)}% | Low ICT WR: ${(lowWR * 100).toFixed(0)}%`,
        suggestedFix: "Review ICT scoring weights — FVG/OB alignment may not be adding value in this regime",
      });
    }
  }

  // 8. Direction bias
  const bullTrades = resolved.filter((t) => t.direction === "bullish");
  const bearTrades = resolved.filter((t) => t.direction === "bearish");
  if (bullTrades.length >= 5 && bearTrades.length >= 5) {
    const bullWins = bullTrades.filter((t) => t.outcome === "win").length;
    const bearWins = bearTrades.filter((t) => t.outcome === "win").length;
    const bullDecisive = bullTrades.filter((t) => t.outcome === "win" || t.outcome === "loss").length;
    const bearDecisive = bearTrades.filter((t) => t.outcome === "win" || t.outcome === "loss").length;
    const bullWR = bullDecisive > 0 ? bullWins / bullDecisive : 0;
    const bearWR = bearDecisive > 0 ? bearWins / bearDecisive : 0;

    if (Math.abs(bullWR - bearWR) > 0.2) {
      const weakDir = bullWR < bearWR ? "bullish" : "bearish";
      const strongDir = bullWR < bearWR ? "bearish" : "bullish";
      weaknesses.push({
        area: "Direction Bias",
        description: `${weakDir} trades significantly underperform ${strongDir} trades`,
        severity: "moderate",
        evidence: `Bullish WR: ${(bullWR * 100).toFixed(0)}% (${bullTrades.length}) | Bearish WR: ${(bearWR * 100).toFixed(0)}% (${bearTrades.length})`,
        suggestedFix: `Consider raising conviction threshold for ${weakDir} signals or reducing position size`,
      });
    }
  }

  // 9. Consecutive losses
  if (stats.consecutiveLosses > 5) {
    weaknesses.push({
      area: "Losing Streaks",
      description: `Maximum ${stats.consecutiveLosses} consecutive losses — indicates correlation or regime blindness`,
      severity: stats.consecutiveLosses > 8 ? "critical" : "moderate",
      evidence: `Max consecutive losses: ${stats.consecutiveLosses} | Max DD: ${stats.maxDrawdownPercent.toFixed(1)}%`,
      suggestedFix: "Add a circuit breaker (pause trading after 3-4 consecutive losses) or reduce position size during drawdowns",
    });
  }

  // 10. Excessive drawdown
  if (stats.maxDrawdownPercent > 15) {
    weaknesses.push({
      area: "Drawdown Management",
      description: `Maximum drawdown of ${stats.maxDrawdownPercent.toFixed(1)}% exceeds 15% threshold`,
      severity: stats.maxDrawdownPercent > 25 ? "critical" : "moderate",
      evidence: `Max DD: ${stats.maxDrawdownPercent.toFixed(1)}% | Recovery Factor: ${stats.recoveryFactor.toFixed(1)}x`,
      suggestedFix: "Reduce base risk percentage or tighten conviction filter to reduce trade frequency during drawdowns",
    });
  }

  return weaknesses.sort((a, b) => {
    const order = { critical: 0, moderate: 1, minor: 2 };
    return order[a.severity] - order[b.severity];
  });
}
