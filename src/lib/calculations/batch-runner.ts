import type { OHLCV } from "@/lib/types/market";
import type {
  BacktestConfig,
  BacktestResult,
  BacktestStats,
  BatchConfig,
  BatchProgress,
  BatchInstrumentResult,
  AggregateStats,
  ParameterAdjustment,
  SweepVariant,
} from "@/lib/types/backtest";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { STYLE_PARAMS } from "./mechanical-signals";
import { runBacktest } from "./backtest-engine";
import { analyzeWeaknesses } from "./backtest-analyzer";

// ==================== PARAMETER SWEEP GRID ====================

const SL_STEPS = [0.75, 1.0, 1.25, 1.5]; // multiplier relative to style default
const TP_STEPS = [0.8, 1.0, 1.2];         // multiplier relative to style default
const ENTRY_STEPS = [0.8, 1.0, 1.2];      // multiplier relative to style default

// Minimum improvement threshold — variant must beat baseline by this much to qualify
const MIN_IMPROVEMENT_THRESHOLD = 0.05; // 0.05R expectancy improvement

/**
 * Generate parameter grid variants based on the current style defaults.
 * Tests each axis independently (4 + 3 + 3 - 3 baseline dupes = 7) + 1 LLM = ~8 variants.
 * Keeps compute time reasonable while covering the search space.
 */
function generateSweepGrid(style: BacktestConfig["tradingStyle"]): SweepVariant[] {
  const base = STYLE_PARAMS[style];
  const variants: SweepVariant[] = [];

  // SL axis sweep (hold TP and entry at default)
  for (const slMul of SL_STEPS) {
    const sl = Number((base.slMultiplier * slMul).toFixed(3));
    if (slMul === 1.0) continue; // skip baseline duplicate
    variants.push({
      label: `SL ${sl.toFixed(2)}`,
      overrides: { slMultiplier: sl },
      stats: emptyStats(),
      score: 0,
    });
  }

  // TP axis sweep (hold SL and entry at default)
  for (const tpMul of TP_STEPS) {
    if (tpMul === 1.0) continue;
    const tp: [number, number, number] = [
      Number((base.tpMultipliers[0] * tpMul).toFixed(3)),
      Number((base.tpMultipliers[1] * tpMul).toFixed(3)),
      Number((base.tpMultipliers[2] * tpMul).toFixed(3)),
    ];
    variants.push({
      label: `TP ×${tpMul}`,
      overrides: { tpMultipliers: tp },
      stats: emptyStats(),
      score: 0,
    });
  }

  // Entry axis sweep
  for (const entMul of ENTRY_STEPS) {
    if (entMul === 1.0) continue;
    const ent = Number((base.entrySpreadMultiplier * entMul).toFixed(3));
    variants.push({
      label: `Entry ${ent.toFixed(2)}`,
      overrides: { entrySpreadMultiplier: ent },
      stats: emptyStats(),
      score: 0,
    });
  }

  return variants;
}

/**
 * Composite score: weighted combination of expectancy, profit factor, and drawdown.
 * Higher is better. Penalizes high drawdown and low trade count.
 */
function scoreVariant(stats: BacktestStats): number {
  if (stats.totalTrades < 5) return -999;
  const exp = stats.expectancy;
  const pf = Math.min(stats.profitFactor, 5); // cap PF to prevent outlier dominance
  const ddPenalty = stats.maxDrawdownPercent > 20 ? (stats.maxDrawdownPercent - 20) * 0.02 : 0;
  return (exp * 0.6) + (pf * 0.3) - ddPenalty;
}

// ==================== BATCH RUNNER ====================

export async function runBatchBacktest(
  batchConfig: BatchConfig,
  onProgress: (progress: BatchProgress) => void,
  onInstrumentComplete: (result: BatchInstrumentResult) => void,
  abortSignal: { aborted: boolean }
): Promise<BatchInstrumentResult[]> {
  const results: BatchInstrumentResult[] = [];
  const instruments = INSTRUMENTS.filter((i) =>
    batchConfig.instruments.includes(i.id)
  );

  for (let idx = 0; idx < instruments.length; idx++) {
    if (abortSignal.aborted) break;

    const instrument = instruments[idx];

    onProgress({
      status: "running",
      currentInstrument: instrument.symbol,
      currentInstrumentIndex: idx,
      totalInstruments: instruments.length,
      phase: "backtest",
      percentComplete: (idx / instruments.length) * 100,
    });

    await yieldToMain();

    try {
      // 1. Fetch candles
      const candles = await fetchCandles(
        instrument.id,
        batchConfig.timeframe,
        1000
      );

      if (!candles || candles.length < batchConfig.baseConfig.windowSize + 10) {
        continue;
      }

      // 2. Build config
      const config: BacktestConfig = {
        ...batchConfig.baseConfig,
        instrumentId: instrument.id,
        timeframe: batchConfig.timeframe,
        tradingStyle: batchConfig.tradingStyle,
      };

      // 3. Run baseline
      const baselineResult = runBacktest(candles, instrument, config);
      const baselineScore = scoreVariant(baselineResult.stats);

      if (abortSignal.aborted) break;

      // 4. Analyze weaknesses
      onProgress({
        status: "running",
        currentInstrument: instrument.symbol,
        currentInstrumentIndex: idx,
        totalInstruments: instruments.length,
        phase: "analyze",
        percentComplete: ((idx + 0.2) / instruments.length) * 100,
      });

      const weaknesses = analyzeWeaknesses(baselineResult);

      // 5. Parameter sweep
      let sweepVariants: SweepVariant[] = [];
      let bestVariant: SweepVariant | null = null;
      let improvedResult: BacktestResult | null = null;
      let adjustments: ParameterAdjustment[] = [];
      let improvement: BatchInstrumentResult["improvement"] = null;
      let sweepImprovement = 0;

      if (batchConfig.autoImprove && baselineResult.trades.length >= 5) {
        const grid = generateSweepGrid(batchConfig.tradingStyle);

        onProgress({
          status: "improving",
          currentInstrument: instrument.symbol,
          currentInstrumentIndex: idx,
          totalInstruments: instruments.length,
          phase: "sweep",
          sweepVariant: 0,
          sweepTotal: grid.length,
          percentComplete: ((idx + 0.3) / instruments.length) * 100,
        });

        // Run each variant
        for (let v = 0; v < grid.length; v++) {
          if (abortSignal.aborted) break;

          const variant = grid[v];
          const variantConfig: BacktestConfig = {
            ...config,
            overrides: variant.overrides,
          };

          await yieldToMain();
          const variantResult = runBacktest(candles, instrument, variantConfig);
          variant.stats = variantResult.stats;
          variant.score = scoreVariant(variantResult.stats);

          onProgress({
            status: "improving",
            currentInstrument: instrument.symbol,
            currentInstrumentIndex: idx,
            totalInstruments: instruments.length,
            phase: "sweep",
            sweepVariant: v + 1,
            sweepTotal: grid.length,
            percentComplete: ((idx + 0.3 + (v / grid.length) * 0.5) / instruments.length) * 100,
          });
        }

        // Also try LLM suggestion as one more variant
        try {
          onProgress({
            status: "improving",
            currentInstrument: instrument.symbol,
            currentInstrumentIndex: idx,
            totalInstruments: instruments.length,
            phase: "improve",
            percentComplete: ((idx + 0.8) / instruments.length) * 100,
          });

          const llmAdjustments = await fetchImprovementSuggestions(baselineResult);
          if (llmAdjustments.length > 0) {
            const llmOverrides = adjustmentsToOverrides(config, llmAdjustments);
            const llmConfig: BacktestConfig = { ...config, overrides: llmOverrides };

            await yieldToMain();
            const llmResult = runBacktest(candles, instrument, llmConfig);
            const llmVariant: SweepVariant = {
              label: "AI Suggested",
              overrides: llmOverrides,
              stats: llmResult.stats,
              score: scoreVariant(llmResult.stats),
            };
            grid.push(llmVariant);
          }
        } catch {
          // LLM failed — no problem, we have the grid
        }

        sweepVariants = grid;

        // Find best variant that beats baseline by threshold
        const ranked = [...grid]
          .filter((v) => v.stats.totalTrades >= 5)
          .sort((a, b) => b.score - a.score);

        if (ranked.length > 0 && ranked[0].score > baselineScore + MIN_IMPROVEMENT_THRESHOLD) {
          bestVariant = ranked[0];
          sweepImprovement = bestVariant.stats.expectancy - baselineResult.stats.expectancy;

          // Build the winning config for complete result
          const winnerConfig: BacktestConfig = {
            ...config,
            overrides: bestVariant.overrides,
          };
          improvedResult = runBacktest(candles, instrument, winnerConfig);

          adjustments = overridesToAdjustments(bestVariant.overrides, batchConfig.tradingStyle);

          improvement = {
            winRateDelta: improvedResult.stats.winRate - baselineResult.stats.winRate,
            expectancyDelta: improvedResult.stats.expectancy - baselineResult.stats.expectancy,
            profitFactorDelta: improvedResult.stats.profitFactor - baselineResult.stats.profitFactor,
            maxDDDelta: improvedResult.stats.maxDrawdownPercent - baselineResult.stats.maxDrawdownPercent,
          };
        }
      }

      // 6. Determine edge
      const finalResult = improvedResult ?? baselineResult;
      const hasEdge =
        finalResult.stats.expectancy > 0 &&
        finalResult.stats.profitFactor > 1.0 &&
        finalResult.trades.length >= 5;

      const instrumentResult: BatchInstrumentResult = {
        instrumentId: instrument.id,
        symbol: instrument.symbol,
        category: instrument.category,
        baselineResult,
        improvedResult,
        weaknesses,
        adjustments,
        hasEdge,
        improvement,
        sweepVariants,
        bestVariant,
        sweepImprovement,
      };

      results.push(instrumentResult);
      onInstrumentComplete(instrumentResult);
    } catch {
      // Skip failed instruments
    }

    await yieldToMain();
  }

  onProgress({
    status: "complete",
    currentInstrument: "",
    currentInstrumentIndex: instruments.length,
    totalInstruments: instruments.length,
    phase: "backtest",
    percentComplete: 100,
  });

  return results;
}

// ==================== AGGREGATE STATS ====================

export function computeAggregateStats(
  results: BatchInstrumentResult[]
): AggregateStats {
  const withEdge = results.filter((r) => r.hasEdge);
  const withoutEdge = results.filter((r) => !r.hasEdge);

  const finalResults = results.map((r) => ({
    ...r,
    result: r.improvedResult ?? r.baselineResult,
  }));

  const totalTrades = finalResults.reduce(
    (sum, r) => sum + r.result.stats.totalTrades,
    0
  );

  let weightedWR = 0;
  let weightedExp = 0;
  let weightedPF = 0;
  let totalDD = 0;

  for (const r of finalResults) {
    const w = r.result.stats.totalTrades;
    if (w === 0) continue;
    weightedWR += r.result.stats.winRate * w;
    weightedExp += r.result.stats.expectancy * w;
    weightedPF += r.result.stats.profitFactor * w;
    totalDD += r.result.stats.maxDrawdownPercent;
  }

  const overallWinRate = totalTrades > 0 ? weightedWR / totalTrades : 0;
  const overallExpectancy = totalTrades > 0 ? weightedExp / totalTrades : 0;
  const overallProfitFactor = totalTrades > 0 ? weightedPF / totalTrades : 0;
  const avgMaxDrawdown = results.length > 0 ? totalDD / results.length : 0;

  const sorted = finalResults
    .filter((r) => r.result.stats.totalTrades >= 5)
    .sort((a, b) => b.result.stats.expectancy - a.result.stats.expectancy);

  const bestInstrument =
    sorted.length > 0
      ? { id: sorted[0].instrumentId, symbol: sorted[0].symbol, expectancy: sorted[0].result.stats.expectancy }
      : null;

  const worstInstrument =
    sorted.length > 0
      ? { id: sorted[sorted.length - 1].instrumentId, symbol: sorted[sorted.length - 1].symbol, expectancy: sorted[sorted.length - 1].result.stats.expectancy }
      : null;

  const categories = new Map<string, { instruments: number; totalExp: number; totalWR: number }>();
  for (const r of finalResults) {
    const cat = r.category;
    const existing = categories.get(cat) ?? { instruments: 0, totalExp: 0, totalWR: 0 };
    existing.instruments += 1;
    existing.totalExp += r.result.stats.expectancy;
    existing.totalWR += r.result.stats.winRate;
    categories.set(cat, existing);
  }

  const byCategory = Array.from(categories.entries()).map(([cat, data]) => ({
    category: cat,
    instruments: data.instruments,
    avgExpectancy: data.instruments > 0 ? data.totalExp / data.instruments : 0,
    avgWinRate: data.instruments > 0 ? data.totalWR / data.instruments : 0,
  }));

  return {
    totalInstruments: results.length,
    instrumentsWithEdge: withEdge.length,
    instrumentsWithoutEdge: withoutEdge.length,
    totalTrades,
    overallWinRate,
    overallExpectancy,
    overallProfitFactor,
    avgMaxDrawdown,
    bestInstrument,
    worstInstrument,
    byCategory,
  };
}

// ==================== GENERATE CLAUDE PROMPT ====================

export function generateOptimizationPrompt(
  results: BatchInstrumentResult[],
  style: BacktestConfig["tradingStyle"]
): string {
  const base = STYLE_PARAMS[style];
  const improved = results.filter((r) => r.bestVariant !== null);

  if (improved.length === 0) {
    return "No parameter improvements found — the current STYLE_PARAMS are already optimal for the tested instruments.";
  }

  // Aggregate the winning overrides across instruments to find consensus
  const slValues: number[] = [];
  const tp1Values: number[] = [];
  const tp2Values: number[] = [];
  const tp3Values: number[] = [];
  const entryValues: number[] = [];

  for (const r of improved) {
    const o = r.bestVariant!.overrides;
    if (o.slMultiplier !== undefined) slValues.push(o.slMultiplier);
    if (o.tpMultipliers) {
      tp1Values.push(o.tpMultipliers[0]);
      tp2Values.push(o.tpMultipliers[1]);
      tp3Values.push(o.tpMultipliers[2]);
    }
    if (o.entrySpreadMultiplier !== undefined) entryValues.push(o.entrySpreadMultiplier);
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
  const avgSL = avg(slValues);
  const avgTP1 = avg(tp1Values);
  const avgTP2 = avg(tp2Values);
  const avgTP3 = avg(tp3Values);
  const avgEntry = avg(entryValues);

  const lines: string[] = [
    `Weekend Lab Results — ${style} style`,
    `=`.repeat(50),
    ``,
    `Tested ${results.length} instruments. ${improved.length} found improvements via parameter sweep.`,
    ``,
    `Current STYLE_PARAMS["${style}"]:`,
    `  slMultiplier: ${base.slMultiplier}`,
    `  tpMultipliers: [${base.tpMultipliers.join(", ")}]`,
    `  entrySpreadMultiplier: ${base.entrySpreadMultiplier}`,
    ``,
  ];

  if (avgSL || avgTP1 || avgEntry) {
    lines.push(`Suggested changes (averaged across ${improved.length} instruments):`);
    if (avgSL) lines.push(`  slMultiplier: ${base.slMultiplier} → ${avgSL.toFixed(3)}`);
    if (avgTP1 && avgTP2 && avgTP3) lines.push(`  tpMultipliers: [${base.tpMultipliers.join(", ")}] → [${avgTP1.toFixed(3)}, ${avgTP2.toFixed(3)}, ${avgTP3.toFixed(3)}]`);
    if (avgEntry) lines.push(`  entrySpreadMultiplier: ${base.entrySpreadMultiplier} → ${avgEntry.toFixed(3)}`);
    lines.push(``);
  }

  lines.push(`Per-instrument breakdown:`);
  for (const r of improved) {
    const v = r.bestVariant!;
    lines.push(`  ${r.symbol}: ${v.label} → Exp ${r.baselineResult.stats.expectancy.toFixed(2)}R → ${v.stats.expectancy.toFixed(2)}R (+${r.sweepImprovement.toFixed(2)}R)`);
  }

  lines.push(``);
  lines.push(`Update STYLE_PARAMS in src/lib/calculations/mechanical-signals.ts with these values.`);

  return lines.join("\n");
}

// ==================== HELPERS ====================

function adjustmentsToOverrides(
  config: BacktestConfig,
  adjustments: ParameterAdjustment[]
): NonNullable<BacktestConfig["overrides"]> {
  const overrides: NonNullable<BacktestConfig["overrides"]> = { ...config.overrides };

  for (const adj of adjustments) {
    const param = adj.parameter.toLowerCase();
    const val = typeof adj.suggestedValue === "number" ? adj.suggestedValue : parseFloat(String(adj.suggestedValue));
    if (isNaN(val)) continue;

    if (param.includes("slmultiplier") || param.includes("sl_multiplier")) {
      overrides.slMultiplier = val;
    } else if (param.includes("tp") && param.includes("1")) {
      const existing = overrides.tpMultipliers ?? [3.0, 5.0, 7.0];
      overrides.tpMultipliers = [val, existing[1], existing[2]];
    } else if (param.includes("tp") && param.includes("2")) {
      const existing = overrides.tpMultipliers ?? [3.0, 5.0, 7.0];
      overrides.tpMultipliers = [existing[0], val, existing[2]];
    } else if (param.includes("tp") && param.includes("3")) {
      const existing = overrides.tpMultipliers ?? [3.0, 5.0, 7.0];
      overrides.tpMultipliers = [existing[0], existing[1], val];
    } else if (param.includes("entryspread") || param.includes("entry_spread")) {
      overrides.entrySpreadMultiplier = val;
    }
  }

  return overrides;
}

function overridesToAdjustments(
  overrides: NonNullable<BacktestConfig["overrides"]>,
  style: BacktestConfig["tradingStyle"]
): ParameterAdjustment[] {
  const base = STYLE_PARAMS[style];
  const adjustments: ParameterAdjustment[] = [];

  if (overrides.slMultiplier !== undefined) {
    adjustments.push({
      parameter: "slMultiplier",
      currentValue: base.slMultiplier,
      suggestedValue: overrides.slMultiplier,
      reasoning: "Parameter sweep optimization",
      impact: "high",
      category: "risk",
    });
  }

  if (overrides.tpMultipliers) {
    adjustments.push({
      parameter: "tpMultipliers",
      currentValue: `[${base.tpMultipliers.join(",")}]`,
      suggestedValue: `[${overrides.tpMultipliers.join(",")}]`,
      reasoning: "Parameter sweep optimization",
      impact: "high",
      category: "exit",
    });
  }

  if (overrides.entrySpreadMultiplier !== undefined) {
    adjustments.push({
      parameter: "entrySpreadMultiplier",
      currentValue: base.entrySpreadMultiplier,
      suggestedValue: overrides.entrySpreadMultiplier,
      reasoning: "Parameter sweep optimization",
      impact: "medium",
      category: "entry",
    });
  }

  return adjustments;
}

async function fetchCandles(
  instrumentId: string,
  timeframe: "1h" | "4h",
  limit: number
): Promise<OHLCV[] | null> {
  try {
    const res = await fetch(
      `/api/technicals/price-data?instrument=${instrumentId}&timeframe=${timeframe}&limit=${limit}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.candles ?? null;
  } catch {
    return null;
  }
}

async function fetchImprovementSuggestions(
  result: BacktestResult
): Promise<ParameterAdjustment[]> {
  try {
    const res = await fetch("/api/analysis/backtest-improvement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stats: result.stats,
        systemBreakdown: result.systemBreakdown,
        regimeBreakdown: result.regimeBreakdown,
        convictionBreakdown: result.convictionBreakdown,
        config: result.config,
        tradeCount: result.trades.length,
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.suggestions ?? [];
  } catch {
    return [];
  }
}

function emptyStats(): BacktestStats {
  return {
    totalTrades: 0, wins: 0, losses: 0, breakevens: 0, expired: 0,
    winRate: 0, avgWinR: 0, avgLossR: 0, expectancy: 0, profitFactor: 0,
    sharpeRatio: 0, sortinoRatio: 0, maxDrawdownPercent: 0, maxDrawdownR: 0,
    avgBarsInTrade: 0, totalReturnPercent: 0, totalReturnR: 0, recoveryFactor: 0,
    consecutiveWins: 0, consecutiveLosses: 0, avgTradesPerMonth: 0,
  };
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}
