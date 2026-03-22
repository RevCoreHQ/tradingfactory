"use client";

import { useState, useCallback, useRef } from "react";
import type { BacktestConfig, BacktestResult, BacktestProgress } from "@/lib/types/backtest";
import { DEFAULT_BACKTEST_CONFIG } from "@/lib/types/backtest";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { runBacktestAsync } from "@/lib/calculations/backtest-engine";
import { saveBacktestResult, loadBacktestResults } from "@/lib/storage/backtest-storage";

export function useBacktest() {
  const [config, setConfig] = useState<BacktestConfig>(DEFAULT_BACKTEST_CONFIG);
  const [progress, setProgress] = useState<BacktestProgress>({
    status: "idle",
    currentBar: 0,
    totalBars: 0,
    tradesFound: 0,
    percentComplete: 0,
  });
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [history, setHistory] = useState<BacktestResult[]>(() => loadBacktestResults());
  const abortRef = useRef(false);

  const run = useCallback(async () => {
    abortRef.current = false;
    setResult(null);

    // 1. Fetch historical candles
    setProgress({
      status: "fetching",
      currentBar: 0,
      totalBars: 0,
      tradesFound: 0,
      percentComplete: 0,
    });

    try {
      const res = await fetch(
        `/api/technicals/price-data?instrument=${config.instrumentId}&timeframe=${config.timeframe}&limit=1000`
      );

      if (!res.ok) {
        setProgress({
          status: "error",
          currentBar: 0,
          totalBars: 0,
          tradesFound: 0,
          percentComplete: 0,
          errorMessage: `Failed to fetch data: ${res.status}`,
        });
        return;
      }

      const data = await res.json();
      const candles = data.candles;

      if (!candles || candles.length < config.windowSize + 50) {
        setProgress({
          status: "error",
          currentBar: 0,
          totalBars: 0,
          tradesFound: 0,
          percentComplete: 0,
          errorMessage: `Insufficient data: ${candles?.length ?? 0} candles (need ${config.windowSize + 50}+)`,
        });
        return;
      }

      // 2. Find instrument
      const instrument = INSTRUMENTS.find((i) => i.id === config.instrumentId);
      if (!instrument) {
        setProgress({
          status: "error",
          currentBar: 0,
          totalBars: 0,
          tradesFound: 0,
          percentComplete: 0,
          errorMessage: `Instrument ${config.instrumentId} not found`,
        });
        return;
      }

      // 3. Run backtest
      setProgress({
        status: "running",
        currentBar: 0,
        totalBars: candles.length - config.windowSize,
        tradesFound: 0,
        percentComplete: 0,
      });

      const backtestResult = await runBacktestAsync(
        candles,
        instrument,
        config,
        (p) => {
          if (!abortRef.current) {
            setProgress(p);
          }
        }
      );

      if (abortRef.current) return;

      // 4. Save and display
      setResult(backtestResult);
      saveBacktestResult(backtestResult);
      setHistory((prev) => [backtestResult, ...prev].slice(0, 10));

      setProgress({
        status: "complete",
        currentBar: backtestResult.totalBarsProcessed,
        totalBars: backtestResult.totalBarsProcessed,
        tradesFound: backtestResult.trades.length,
        percentComplete: 100,
      });
    } catch (err) {
      if (!abortRef.current) {
        setProgress({
          status: "error",
          currentBar: 0,
          totalBars: 0,
          tradesFound: 0,
          percentComplete: 0,
          errorMessage: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  }, [config]);

  const stop = useCallback(() => {
    abortRef.current = true;
    setProgress((prev) => ({ ...prev, status: "idle" }));
  }, []);

  return {
    config,
    setConfig,
    progress,
    result,
    history,
    run,
    stop,
  };
}
