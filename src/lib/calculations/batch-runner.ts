import type { OHLCV, Instrument } from "@/lib/types/market";
import type {
  BacktestConfig,
  BacktestResult,
  BatchConfig,
  BatchProgress,
  BatchInstrumentResult,
  AggregateStats,
  ParameterAdjustment,
  Weakness,
} from "@/lib/types/backtest";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { runBacktest } from "./backtest-engine";
import { analyzeWeaknesses } from "./backtest-analyzer";

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

    // Yield to UI
    await yieldToMain();

    try {
      // 1. Fetch candles
      const candles = await fetchCandles(
        instrument.id,
        batchConfig.timeframe,
        1000
      );

      if (!candles || candles.length < batchConfig.baseConfig.windowSize + 10) {
        // Skip instruments with insufficient data
        continue;
      }

      // 2. Build config for this instrument
      const config: BacktestConfig = {
        ...batchConfig.baseConfig,
        instrumentId: instrument.id,
        timeframe: batchConfig.timeframe,
        tradingStyle: batchConfig.tradingStyle,
      };

      // 3. Run baseline backtest
      const baselineResult = runBacktest(candles, instrument, config);

      if (abortSignal.aborted) break;

      // 4. Analyze weaknesses
      onProgress({
        status: "running",
        currentInstrument: instrument.symbol,
        currentInstrumentIndex: idx,
        totalInstruments: instruments.length,
        phase: "analyze",
        percentComplete: ((idx + 0.4) / instruments.length) * 100,
      });

      const weaknesses = analyzeWeaknesses(baselineResult);

      // 5. Auto-improve if enabled
      let improvedResult: BacktestResult | null = null;
      let adjustments: ParameterAdjustment[] = [];
      let improvement: BatchInstrumentResult["improvement"] = null;

      if (batchConfig.autoImprove && baselineResult.trades.length >= 5) {
        onProgress({
          status: "improving",
          currentInstrument: instrument.symbol,
          currentInstrumentIndex: idx,
          totalInstruments: instruments.length,
          phase: "improve",
          percentComplete: ((idx + 0.6) / instruments.length) * 100,
        });

        try {
          // Call LLM for improvement suggestions
          adjustments = await fetchImprovementSuggestions(baselineResult);

          if (adjustments.length > 0 && !abortSignal.aborted) {
            // Apply adjustments and re-run
            const improvedConfig = applyAdjustmentsToConfig(config, adjustments);

            onProgress({
              status: "improving",
              currentInstrument: instrument.symbol,
              currentInstrumentIndex: idx,
              totalInstruments: instruments.length,
              phase: "retest",
              percentComplete: ((idx + 0.8) / instruments.length) * 100,
            });

            await yieldToMain();
            improvedResult = runBacktest(candles, instrument, improvedConfig);

            // Compute improvement deltas
            improvement = {
              winRateDelta: improvedResult.stats.winRate - baselineResult.stats.winRate,
              expectancyDelta: improvedResult.stats.expectancy - baselineResult.stats.expectancy,
              profitFactorDelta: improvedResult.stats.profitFactor - baselineResult.stats.profitFactor,
              maxDDDelta: improvedResult.stats.maxDrawdownPercent - baselineResult.stats.maxDrawdownPercent,
            };
          }
        } catch {
          // LLM failed — continue with baseline only
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

  // Use improved results where available, otherwise baseline
  const finalResults = results.map((r) => ({
    ...r,
    result: r.improvedResult ?? r.baselineResult,
  }));

  const totalTrades = finalResults.reduce(
    (sum, r) => sum + r.result.stats.totalTrades,
    0
  );

  // Weighted averages (weighted by trade count)
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
  const avgMaxDrawdown =
    results.length > 0 ? totalDD / results.length : 0;

  // Best / worst instrument
  const sorted = finalResults
    .filter((r) => r.result.stats.totalTrades >= 5)
    .sort((a, b) => b.result.stats.expectancy - a.result.stats.expectancy);

  const bestInstrument =
    sorted.length > 0
      ? {
          id: sorted[0].instrumentId,
          symbol: sorted[0].symbol,
          expectancy: sorted[0].result.stats.expectancy,
        }
      : null;

  const worstInstrument =
    sorted.length > 0
      ? {
          id: sorted[sorted.length - 1].instrumentId,
          symbol: sorted[sorted.length - 1].symbol,
          expectancy: sorted[sorted.length - 1].result.stats.expectancy,
        }
      : null;

  // Category breakdown
  const categories = new Map<
    string,
    { instruments: number; totalExp: number; totalWR: number }
  >();

  for (const r of finalResults) {
    const cat = r.category;
    const existing = categories.get(cat) ?? {
      instruments: 0,
      totalExp: 0,
      totalWR: 0,
    };
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

// ==================== CONFIG ADJUSTMENTS ====================

export function applyAdjustmentsToConfig(
  config: BacktestConfig,
  adjustments: ParameterAdjustment[]
): BacktestConfig {
  const overrides: NonNullable<BacktestConfig["overrides"]> = {
    ...config.overrides,
  };

  for (const adj of adjustments) {
    const param = adj.parameter.toLowerCase();
    const val =
      typeof adj.suggestedValue === "number"
        ? adj.suggestedValue
        : parseFloat(String(adj.suggestedValue));

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
    } else if (
      param.includes("entryspread") ||
      param.includes("entry_spread")
    ) {
      overrides.entrySpreadMultiplier = val;
    }
  }

  return { ...config, overrides };
}

// ==================== HELPERS ====================

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

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}
