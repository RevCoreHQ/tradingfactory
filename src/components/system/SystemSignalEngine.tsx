"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { CpuArchitecture } from "@/components/ui/cpu-architecture";

interface MechanicalSystem {
  name: string;
  book: string;
  type: "Trend" | "Mean Reversion" | "Momentum" | "Volume" | "Reversal";
  cluster: "trend" | "mean_reversion" | "momentum" | "volume" | "reversal";
  logic: string;
  params: string;
}

const systems: MechanicalSystem[] = [
  { name: "Trend Stack", book: "Multiple", type: "Trend", cluster: "trend", logic: "EMA(9) > EMA(21) > EMA(50) > SMA(200)", params: "EMAs: 9, 21, 50, 200" },
  { name: "RSI Extremes", book: "Weissman", type: "Mean Reversion", cluster: "mean_reversion", logic: "RSI(14) < 30 or > 70 with SMA(200) filter", params: "Period: 14" },
  { name: "Elder Impulse", book: "Elder", type: "Momentum", cluster: "momentum", logic: "EMA(13) slope + MACD-H slope", params: "EMA: 13" },
  { name: "Volume Confirmation", book: "Elder", type: "Volume", cluster: "volume", logic: "VWAP deviation + volume surge + Force Index alignment", params: "VWAP, EMA2/13 Force Index" },
  { name: "SFP", book: "ICT", type: "Reversal", cluster: "reversal", logic: "Sweep swing H/L → close back inside + wick ≥ 0.3 ATR", params: "Lookback: 50 bars, sweep: 5 candles" },
  { name: "IDF", book: "ICT", type: "Reversal", cluster: "reversal", logic: "Displacement creates FVG → price returns → structure break opposite", params: "Displacement: 30 bars, FVG fill ≥ 25%" },
];

const clusterConfig: Record<string, { label: string; color: string; badgeColor: string; dot: string }> = {
  trend: {
    label: "Trend Cluster",
    color: "border-neutral-accent/30 bg-neutral-accent/5",
    badgeColor: "bg-neutral-accent/15 text-neutral-accent border-neutral-accent/25",
    dot: "bg-neutral-accent/50",
  },
  mean_reversion: {
    label: "Mean Reversion Cluster",
    color: "border-amber-500/30 bg-amber-500/5",
    badgeColor: "bg-amber-500/15 text-amber-700 dark:text-amber-500 border-amber-500/25",
    dot: "bg-amber-500/50",
  },
  momentum: {
    label: "Momentum Cluster",
    color: "border-bullish/30 bg-bullish/5",
    badgeColor: "bg-bullish/15 text-bullish border-bullish/25",
    dot: "bg-bullish/50",
  },
  volume: {
    label: "Volume Cluster",
    color: "border-sky-500/30 bg-sky-500/5",
    badgeColor: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/25",
    dot: "bg-sky-500/50",
  },
  reversal: {
    label: "Reversal Cluster",
    color: "border-rose-500/30 bg-rose-500/5",
    badgeColor: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25",
    dot: "bg-rose-500/50",
  },
};

const clusterWeights = [
  { regime: "Trend", trend: 0.35, mr: 0.05, mom: 0.30, vol: 0.20, rev: 0.10 },
  { regime: "Range", trend: 0.10, mr: 0.35, mom: 0.25, vol: 0.15, rev: 0.15 },
  { regime: "Breakout", trend: 0.25, mr: 0.05, mom: 0.35, vol: 0.25, rev: 0.10 },
];

const weightBars: { key: string; label: string; field: keyof typeof clusterWeights[0]; barClass: string }[] = [
  { key: "T", label: "T", field: "trend", barClass: "bg-neutral-accent/50" },
  { key: "MR", label: "MR", field: "mr", barClass: "bg-amber-500/50" },
  { key: "M", label: "M", field: "mom", barClass: "bg-bullish/50" },
  { key: "V", label: "V", field: "vol", barClass: "bg-sky-500/50" },
  { key: "R", label: "R", field: "rev", barClass: "bg-rose-500/50" },
];

export function SystemSignalEngine() {
  const clusters = ["trend", "mean_reversion", "momentum", "volume", "reversal"] as const;

  return (
    <div className="space-y-6">
      {/* CpuArchitecture visualization */}
      <div className="rounded-xl overflow-hidden glass-card p-4">
        <CpuArchitecture
          text="TF"
          className="w-full max-h-[160px]"
        />
        <p className="text-center text-[12px] text-muted-foreground/50 mt-2">
          6 independent systems across 5 de-correlated clusters fire through the signal processing core
        </p>
      </div>

      {/* 5 cluster zones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {clusters.map((cluster, ci) => {
          const config = clusterConfig[cluster];
          const clusterSystems = systems.filter((s) => s.cluster === cluster);

          return (
            <motion.div
              key={cluster}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: ci * 0.1 }}
              className={cn("rounded-xl border p-4 space-y-3", config.color)}
            >
              <div className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", config.dot)} />
                <span className="text-[13px] font-semibold text-foreground">
                  {config.label}
                </span>
                <span className={cn("ml-auto text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border", config.badgeColor)}>
                  {clusterSystems.length} {clusterSystems.length === 1 ? "signal" : "signals"}
                </span>
              </div>
              <div className="space-y-2">
                {clusterSystems.map((sys) => (
                  <div
                    key={sys.name}
                    className="glass-card rounded-lg px-3 py-2 space-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-foreground">{sys.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground/40">{sys.book}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/60">{sys.logic}</p>
                    <p className="text-[10px] text-muted-foreground/40">{sys.params}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* De-correlation weight table */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="glass-card rounded-xl p-4"
      >
        <h4 className="text-[12px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-3">
          Regime-Adaptive Cluster Weights
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {clusterWeights.map((w) => (
            <div key={w.regime} className="space-y-2">
              <div className="text-[12px] font-semibold text-foreground text-center">{w.regime}</div>
              <div className="space-y-1">
                {weightBars.map((bar) => (
                  <div key={bar.key} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground/50 w-8">{bar.label}</span>
                    <div className="flex-1 h-2 bg-surface-2/50 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(w[bar.field] as number) * 100}%` }}
                        viewport={{ once: true }}
                        className={cn("h-full rounded-full", bar.barClass)}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground/40 w-6">{w[bar.field] as number}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Auto-kill callout */}
      <div className="glass-card rounded-xl px-4 py-3 border-l-[3px] border-l-[var(--bearish)]">
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Auto-kill weak systems:</strong> Each system&apos;s win rate is tracked over a 30-trade window.
          Below 30% = disabled. Below 40% = penalized. Above 60% = bonus. Weights adapt automatically.
        </p>
      </div>
    </div>
  );
}
