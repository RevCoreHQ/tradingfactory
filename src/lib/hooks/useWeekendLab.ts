"use client";

import { useState, useCallback, useRef } from "react";
import type {
  BacktestConfig,
  BatchConfig,
  BatchProgress,
  BatchInstrumentResult,
  AggregateStats,
} from "@/lib/types/backtest";
import { DEFAULT_BACKTEST_CONFIG } from "@/lib/types/backtest";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { runBatchBacktest, computeAggregateStats } from "@/lib/calculations/batch-runner";
import { feedBatchToConfluence, previewConfluenceUpdates } from "@/lib/calculations/confluence-bridge";
import { saveBatchResults } from "@/lib/storage/backtest-storage";
import { loadConfluencePatterns, saveConfluencePatterns } from "@/lib/storage/setup-storage";

export function useWeekendLab() {
  const [batchConfig, setBatchConfig] = useState<BatchConfig>({
    baseConfig: {
      ...DEFAULT_BACKTEST_CONFIG,
      windowSize: 200,
      stepSize: 1,
    },
    instruments: INSTRUMENTS.map((i) => i.id),
    autoImprove: true,
    feedConfluence: true,
    timeframe: "4h",
    tradingStyle: "swing",
  });

  const [progress, setProgress] = useState<BatchProgress>({
    status: "idle",
    currentInstrument: "",
    currentInstrumentIndex: 0,
    totalInstruments: 0,
    phase: "backtest",
    percentComplete: 0,
  });

  const [results, setResults] = useState<BatchInstrumentResult[]>([]);
  const [aggregateStats, setAggregateStats] = useState<AggregateStats | null>(null);
  const [confluenceFed, setConfluenceFed] = useState(false);
  const abortRef = useRef({ aborted: false });

  const runBatch = useCallback(async () => {
    abortRef.current = { aborted: false };
    setResults([]);
    setAggregateStats(null);
    setConfluenceFed(false);

    // Sync config
    const config: BatchConfig = {
      ...batchConfig,
      baseConfig: {
        ...batchConfig.baseConfig,
        timeframe: batchConfig.timeframe,
        tradingStyle: batchConfig.tradingStyle,
      },
    };

    const batchResults = await runBatchBacktest(
      config,
      setProgress,
      (result) => {
        setResults((prev) => {
          const updated = [...prev, result];
          setAggregateStats(computeAggregateStats(updated));
          return updated;
        });
      },
      abortRef.current
    );

    if (!abortRef.current.aborted) {
      setAggregateStats(computeAggregateStats(batchResults));

      // Save to localStorage
      saveBatchResults(batchResults);

      // Auto-feed confluence if enabled
      if (config.feedConfluence && batchResults.length > 0) {
        applyConfluenceFeedbackInternal(batchResults);
      }
    }
  }, [batchConfig]);

  const stopBatch = useCallback(() => {
    abortRef.current.aborted = true;
    setProgress((prev) => ({ ...prev, status: "idle" }));
  }, []);

  const applyConfluenceFeedbackInternal = useCallback(
    (batchResults: BatchInstrumentResult[]) => {
      const existing = loadConfluencePatterns();
      const updated = feedBatchToConfluence(batchResults, existing);
      saveConfluencePatterns(updated);
      setConfluenceFed(true);
    },
    []
  );

  const applyConfluenceFeedback = useCallback(() => {
    if (results.length > 0) {
      applyConfluenceFeedbackInternal(results);
    }
  }, [results, applyConfluenceFeedbackInternal]);

  const confluencePreview = results.length > 0
    ? previewConfluenceUpdates(results)
    : null;

  return {
    batchConfig,
    setBatchConfig,
    progress,
    results,
    aggregateStats,
    confluenceFed,
    confluencePreview,
    runBatch,
    stopBatch,
    applyConfluenceFeedback,
  };
}
