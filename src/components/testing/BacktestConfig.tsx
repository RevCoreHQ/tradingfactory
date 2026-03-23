"use client";

import { cn } from "@/lib/utils";
import { INSTRUMENTS } from "@/lib/utils/constants";
import type { BacktestConfig as BacktestConfigType, BacktestProgress } from "@/lib/types/backtest";
import type { ConvictionTier, TradingStyle } from "@/lib/types/signals";
import { Play, Square, Loader2 } from "lucide-react";

interface Props {
  config: BacktestConfigType;
  onConfigChange: (config: BacktestConfigType) => void;
  progress: BacktestProgress;
  onRun: () => void;
  onStop: () => void;
}

export function BacktestConfig({ config, onConfigChange, progress, onRun, onStop }: Props) {
  const isRunning = progress.status === "running" || progress.status === "fetching";

  const update = (partial: Partial<BacktestConfigType>) => {
    onConfigChange({ ...config, ...partial });
  };

  return (
    <div className="section-card p-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Instrument */}
        <div>
          <label className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1.5 block">
            Instrument
          </label>
          <select
            value={config.instrumentId}
            onChange={(e) => update({ instrumentId: e.target.value })}
            disabled={isRunning}
            className="w-full h-8 rounded-md border border-border/50 bg-[var(--surface-1)] px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-neutral-accent/40"
          >
            {INSTRUMENTS.map((i) => (
              <option key={i.id} value={i.id}>
                {i.symbol}
              </option>
            ))}
          </select>
        </div>

        {/* Timeframe */}
        <div>
          <label className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1.5 block">
            Timeframe
          </label>
          <div className="flex gap-1">
            {(["1h", "4h"] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => update({ timeframe: tf })}
                disabled={isRunning}
                className={cn(
                  "flex-1 h-8 rounded-md text-xs font-medium transition-all",
                  config.timeframe === tf
                    ? "bg-neutral-accent/15 text-neutral-accent border border-neutral-accent/30"
                    : "bg-[var(--surface-1)] text-muted-foreground border border-border/50 hover:text-foreground"
                )}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Trading Style */}
        <div>
          <label className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1.5 block">
            Style
          </label>
          <div className="flex gap-1">
            {(["swing", "intraday"] as TradingStyle[]).map((s) => (
              <button
                key={s}
                onClick={() => update({ tradingStyle: s })}
                disabled={isRunning}
                className={cn(
                  "flex-1 h-8 rounded-md text-xs font-medium transition-all capitalize",
                  config.tradingStyle === s
                    ? "bg-neutral-accent/15 text-neutral-accent border border-neutral-accent/30"
                    : "bg-[var(--surface-1)] text-muted-foreground border border-border/50 hover:text-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Equity */}
        <div>
          <label className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1.5 block">
            Equity ($)
          </label>
          <input
            type="number"
            value={config.accountEquity}
            onChange={(e) => update({ accountEquity: Math.max(0, Number(e.target.value) || 0) })}
            disabled={isRunning}
            className="w-full h-8 rounded-md border border-border/50 bg-[var(--surface-1)] px-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-neutral-accent/40"
          />
        </div>

        {/* Risk % */}
        <div>
          <label className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1.5 block">
            Risk %
          </label>
          <input
            type="number"
            value={config.riskPercent}
            onChange={(e) => update({ riskPercent: Math.max(0.1, Math.min(10, Number(e.target.value) || 2)) })}
            disabled={isRunning}
            step={0.5}
            className="w-full h-8 rounded-md border border-border/50 bg-[var(--surface-1)] px-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-neutral-accent/40"
          />
        </div>

        {/* Min Conviction */}
        <div>
          <label className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1.5 block">
            Min Conviction
          </label>
          <select
            value={config.minConviction ?? "A"}
            onChange={(e) => update({ minConviction: e.target.value as ConvictionTier })}
            disabled={isRunning}
            className="w-full h-8 rounded-md border border-border/50 bg-[var(--surface-1)] px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-neutral-accent/40"
          >
            {(["A+", "A", "B", "C", "D"] as ConvictionTier[]).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Advanced row */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/20">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={config.enforceImpulseGate}
            onChange={(e) => update({ enforceImpulseGate: e.target.checked })}
            disabled={isRunning}
            className="rounded border-border/50"
          />
          Impulse gate
        </label>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-muted-foreground/60 uppercase">Min R:R</span>
          <input
            type="number"
            value={config.minRiskReward ?? 1.5}
            onChange={(e) => update({ minRiskReward: Math.max(0.5, Number(e.target.value) || 1.5) })}
            disabled={isRunning}
            step={0.5}
            className="w-16 h-7 rounded-md border border-border/50 bg-[var(--surface-1)] px-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-neutral-accent/40"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-muted-foreground/60 uppercase">Window</span>
          <input
            type="number"
            value={config.windowSize}
            onChange={(e) => update({ windowSize: Math.max(50, Math.min(500, Number(e.target.value) || 200)) })}
            disabled={isRunning}
            className="w-16 h-7 rounded-md border border-border/50 bg-[var(--surface-1)] px-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-neutral-accent/40"
          />
        </div>

        <div className="ml-auto flex items-center gap-3">
          {isRunning ? (
            <button
              onClick={onStop}
              className="h-9 px-5 rounded-lg bg-bearish/15 text-bearish text-xs font-semibold border border-bearish/30 hover:bg-bearish/25 transition-all flex items-center gap-2"
            >
              <Square className="h-3 w-3" />
              Stop
            </button>
          ) : (
            <button
              onClick={onRun}
              className="h-9 px-5 rounded-lg bg-bullish/15 text-bullish text-xs font-semibold border border-bullish/30 hover:bg-bullish/25 transition-all flex items-center gap-2"
            >
              <Play className="h-3 w-3" />
              Run Backtest
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {(progress.status === "running" || progress.status === "fetching") && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[12px] text-muted-foreground/60 flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              {progress.status === "fetching" ? "Fetching historical data..." : `Processing bar ${progress.currentBar} / ${progress.totalBars}`}
            </span>
            <span className="text-[12px] font-mono text-muted-foreground/60">
              {progress.tradesFound} trades found
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div
              className="h-full rounded-full bg-neutral-accent transition-all duration-300"
              style={{ width: `${progress.percentComplete}%` }}
            />
          </div>
        </div>
      )}

      {progress.status === "error" && (
        <div className="mt-3 px-3 py-2 rounded-lg bg-bearish/10 border border-bearish/20 text-xs text-bearish">
          {progress.errorMessage}
        </div>
      )}
    </div>
  );
}
