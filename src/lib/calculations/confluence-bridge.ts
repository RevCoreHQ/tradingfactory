import type { ConfluencePattern, TrackedSetup } from "@/lib/types/signals";
import type { BacktestTrade, BatchInstrumentResult } from "@/lib/types/backtest";
import { recordOutcome } from "./confluence-learning";
import { buildConfluenceKey } from "./setup-tracker";

// ==================== BRIDGE: Backtest → Confluence ====================

/**
 * Convert backtest trades into confluence pattern updates.
 * Each trade generates a TrackedSetup-like record that can be fed
 * into the existing recordOutcome() function.
 */
export function feedBacktestToConfluence(
  trades: BacktestTrade[],
  existingPatterns: Record<string, ConfluencePattern>
): Record<string, ConfluencePattern> {
  const patterns = { ...existingPatterns };

  // Only feed decisive trades (win/loss) — skip expired/breakeven/still_open
  const resolved = trades.filter(
    (t) => t.outcome === "win" || t.outcome === "loss" || t.outcome === "breakeven"
  );

  for (const trade of resolved) {
    const key = buildConfluenceKey(trade.setup);
    const outcome: "win" | "loss" | "breakeven" =
      trade.outcome === "win" ? "win" : trade.outcome === "loss" ? "loss" : "breakeven";

    // Build a TrackedSetup-compatible record for recordOutcome
    const tracked: TrackedSetup = {
      id: trade.id,
      setup: trade.setup,
      status: outcome === "win" ? "tp1_hit" : outcome === "loss" ? "sl_hit" : "expired",
      createdAt: trade.signalTimestamp,
      activatedAt: trade.entryTimestamp,
      closedAt: trade.exitTimestamp,
      outcome,
      pnlPercent: trade.pnlPercent,
      highestTpHit: trade.highestTpHit,
      confluenceKey: key,
      scaleIns: [],
      peakPrice: null,
      timeline: [],
      missedEntry: false,
    };

    patterns[key] = recordOutcome(patterns[key] ?? null, tracked);
  }

  return patterns;
}

/**
 * Feed all batch results into confluence patterns at once.
 */
export function feedBatchToConfluence(
  results: BatchInstrumentResult[],
  existingPatterns: Record<string, ConfluencePattern>
): Record<string, ConfluencePattern> {
  let patterns = { ...existingPatterns };

  for (const result of results) {
    // Use improved result if available, otherwise baseline
    const finalResult = result.improvedResult ?? result.baselineResult;
    patterns = feedBacktestToConfluence(finalResult.trades, patterns);
  }

  return patterns;
}

/**
 * Preview how many trades and unique patterns would be updated.
 */
export function previewConfluenceUpdates(
  results: BatchInstrumentResult[]
): { totalTrades: number; uniquePatterns: number; byCategory: Record<string, number> } {
  const patternKeys = new Set<string>();
  let totalTrades = 0;
  const byCategory: Record<string, number> = {};

  for (const result of results) {
    const finalResult = result.improvedResult ?? result.baselineResult;
    const resolved = finalResult.trades.filter(
      (t) => t.outcome === "win" || t.outcome === "loss" || t.outcome === "breakeven"
    );

    totalTrades += resolved.length;
    byCategory[result.category] = (byCategory[result.category] ?? 0) + resolved.length;

    for (const trade of resolved) {
      patternKeys.add(buildConfluenceKey(trade.setup));
    }
  }

  return { totalTrades, uniquePatterns: patternKeys.size, byCategory };
}
