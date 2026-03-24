"use client";

import { cn } from "@/lib/utils";
import { INSTRUMENTS } from "@/lib/utils/constants";
import type { BatchConfig, BatchProgress } from "@/lib/types/backtest";
import { Play, Square, Zap, Brain, Loader2 } from "lucide-react";

interface WeekendLabConfigProps {
  config: BatchConfig;
  onConfigChange: (config: BatchConfig) => void;
  progress: BatchProgress;
  onRun: () => void;
  onStop: () => void;
}

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "forex", label: "Forex" },
  { id: "commodity", label: "Commodities" },
  { id: "crypto", label: "Crypto" },
  { id: "index", label: "Indices" },
] as const;

const PHASES: Record<string, string> = {
  backtest: "Running backtest",
  analyze: "Analyzing weaknesses",
  sweep: "Parameter sweep",
  improve: "Testing suggestion",
  retest: "Re-testing best variant",
  confluence: "Feeding confluence",
};

export function WeekendLabConfig({
  config,
  onConfigChange,
  progress,
  onRun,
  onStop,
}: WeekendLabConfigProps) {
  const isRunning = progress.status === "running" || progress.status === "improving";
  const selectedCategory = getSelectedCategory(config.instruments);

  function handleCategoryFilter(categoryId: string) {
    if (categoryId === "all") {
      onConfigChange({ ...config, instruments: INSTRUMENTS.map((i) => i.id) });
    } else {
      onConfigChange({
        ...config,
        instruments: INSTRUMENTS.filter((i) => i.category === categoryId).map((i) => i.id),
      });
    }
  }

  return (
    <div className="glass-card rounded-2xl border border-border/30 p-6 space-y-5">
      {/* Category Filter */}
      <div>
        <label className="text-[12px] font-bold text-muted-foreground/60 uppercase tracking-wider block mb-2">
          Instruments
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryFilter(cat.id)}
              disabled={isRunning}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all",
                selectedCategory === cat.id
                  ? "bg-foreground text-background"
                  : "glass-card border border-border/30 text-muted-foreground hover:text-foreground"
              )}
            >
              {cat.label}
              <span className="ml-1 text-[11px] opacity-50">
                ({cat.id === "all" ? INSTRUMENTS.length : INSTRUMENTS.filter((i) => i.category === cat.id).length})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Timeframe + Style */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="text-[12px] font-bold text-muted-foreground/60 uppercase tracking-wider block mb-2">
            Timeframe
          </label>
          <div className="flex gap-1">
            {(["1h", "4h"] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => onConfigChange({ ...config, timeframe: tf })}
                disabled={isRunning}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-lg text-[13px] font-mono font-bold transition-all",
                  config.timeframe === tf
                    ? "bg-foreground text-background"
                    : "glass-card border border-border/30 text-muted-foreground"
                )}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[12px] font-bold text-muted-foreground/60 uppercase tracking-wider block mb-2">
            Style
          </label>
          <div className="flex gap-1">
            {(["intraday", "swing"] as const).map((style) => (
              <button
                key={style}
                onClick={() => onConfigChange({ ...config, tradingStyle: style })}
                disabled={isRunning}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-lg text-[13px] font-semibold capitalize transition-all",
                  config.tradingStyle === style
                    ? "bg-foreground text-background"
                    : "glass-card border border-border/30 text-muted-foreground"
                )}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-Improve Toggle */}
        <div>
          <label className="text-[12px] font-bold text-muted-foreground/60 uppercase tracking-wider block mb-2">
            Auto-Improve
          </label>
          <button
            onClick={() => onConfigChange({ ...config, autoImprove: !config.autoImprove })}
            disabled={isRunning}
            className={cn(
              "w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all",
              config.autoImprove
                ? "bg-bullish/20 border border-bullish/30 text-bullish"
                : "glass-card border border-border/30 text-muted-foreground"
            )}
          >
            <Zap className="h-3 w-3" />
            {config.autoImprove ? "ON" : "OFF"}
          </button>
        </div>

        {/* Feed Confluence Toggle */}
        <div>
          <label className="text-[12px] font-bold text-muted-foreground/60 uppercase tracking-wider block mb-2">
            Feed Confluence
          </label>
          <button
            onClick={() => onConfigChange({ ...config, feedConfluence: !config.feedConfluence })}
            disabled={isRunning}
            className={cn(
              "w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all",
              config.feedConfluence
                ? "bg-bullish/20 border border-bullish/30 text-bullish"
                : "glass-card border border-border/30 text-muted-foreground"
            )}
          >
            <Brain className="h-3 w-3" />
            {config.feedConfluence ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Run / Stop + Progress */}
      <div className="flex items-center gap-4">
        {isRunning ? (
          <button
            onClick={onStop}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-bearish text-white text-sm font-bold transition-all hover:bg-bearish/90"
          >
            <Square className="h-4 w-4" />
            Stop
          </button>
        ) : (
          <button
            onClick={onRun}
            disabled={config.instruments.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-foreground text-background text-sm font-bold transition-all hover:opacity-90 disabled:opacity-30"
          >
            <Play className="h-4 w-4" />
            Run Weekend Lab
          </button>
        )}

        {/* Progress */}
        {isRunning && (
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-1.5 text-foreground font-semibold">
                <Loader2 className="h-3 w-3 animate-spin" />
                {progress.currentInstrument}
                <span className="text-muted-foreground/50 font-mono">
                  ({progress.currentInstrumentIndex + 1}/{progress.totalInstruments})
                </span>
              </span>
              <span className="text-muted-foreground/50 font-mono">
                {PHASES[progress.phase] ?? progress.phase}
                {progress.phase === "sweep" && progress.sweepTotal
                  ? ` (${progress.sweepVariant ?? 0}/${progress.sweepTotal})`
                  : ""}
              </span>
            </div>
            <div className="h-1.5 bg-surface-2/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-foreground/60 rounded-full transition-all duration-300"
                style={{ width: `${progress.percentComplete}%` }}
              />
            </div>
          </div>
        )}

        {progress.status === "complete" && (
          <span className="text-[13px] font-semibold text-bullish">
            Complete
          </span>
        )}

        {progress.status === "error" && (
          <span className="text-[13px] font-semibold text-bearish">
            {progress.errorMessage ?? "Error"}
          </span>
        )}
      </div>
    </div>
  );
}

function getSelectedCategory(instruments: string[]): string {
  const allIds = INSTRUMENTS.map((i) => i.id);
  if (instruments.length === allIds.length && instruments.every((id) => allIds.includes(id))) {
    return "all";
  }
  const categories = new Set(
    instruments.map((id) => INSTRUMENTS.find((i) => i.id === id)?.category).filter(Boolean)
  );
  if (categories.size === 1) return [...categories][0] as string;
  return "all";
}
