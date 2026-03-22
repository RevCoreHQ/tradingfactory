"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { CpuArchitecture } from "@/components/ui/cpu-architecture";

interface MechanicalSystem {
  name: string;
  book: string;
  type: "Trend" | "Mean Reversion" | "Momentum";
  cluster: "trend" | "mean_reversion" | "momentum";
  logic: string;
  params: string;
}

const systems: MechanicalSystem[] = [
  { name: "MA Crossover", book: "Weissman", type: "Trend", cluster: "trend", logic: "SMA(9) crosses SMA(26)", params: "Fast: 9, Slow: 26" },
  { name: "MACD", book: "Weissman", type: "Trend", cluster: "trend", logic: "MACD line crosses signal line", params: "12, 26, 9" },
  { name: "BB Breakout", book: "Weissman", type: "Trend", cluster: "trend", logic: "Price closes beyond BB band", params: "20, StdDev: 2" },
  { name: "Trend Stack", book: "Multiple", type: "Trend", cluster: "trend", logic: "EMA(9) > EMA(21) > EMA(50) > SMA(200)", params: "EMAs: 9, 21, 50, 200" },
  { name: "RSI Extremes", book: "Weissman", type: "Mean Reversion", cluster: "mean_reversion", logic: "RSI(14) < 30 or > 70 with SMA(200) filter", params: "Period: 14" },
  { name: "BB Mean Rev", book: "Weissman", type: "Mean Reversion", cluster: "mean_reversion", logic: "Price touches BB band + SMA(200) confirmation", params: "20, StdDev: 2" },
  { name: "Elder Impulse", book: "Elder", type: "Momentum", cluster: "momentum", logic: "EMA(13) slope + MACD-H slope", params: "EMA: 13" },
  { name: "Elder-Ray", book: "Elder", type: "Momentum", cluster: "momentum", logic: "Bull/Bear Power relative to EMA(13)", params: "EMA: 13" },
];

const clusterConfig = {
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
};

const clusterWeights = [
  { regime: "Trend", trend: 0.45, mr: 0.15, mom: 0.40 },
  { regime: "Range", trend: 0.15, mr: 0.45, mom: 0.40 },
  { regime: "Breakout", trend: 0.35, mr: 0.10, mom: 0.55 },
];

export function SystemSignalEngine() {
  const clusters = ["trend", "mean_reversion", "momentum"] as const;

  return (
    <div className="space-y-6">
      {/* CpuArchitecture visualization — 8 systems flow to signal processor */}
      <div className="rounded-xl overflow-hidden glass-card p-4">
        <CpuArchitecture
          text="TF"
          className="w-full max-h-[160px]"
        />
        <p className="text-center text-[10px] text-muted-foreground/50 mt-2">
          8 independent systems fire in parallel through the signal processing core
        </p>
      </div>

      {/* 3 cluster zones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                <span className="text-[11px] font-semibold text-foreground">
                  {config.label}
                </span>
                <span className={cn("ml-auto text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border", config.badgeColor)}>
                  {clusterSystems.length} signals
                </span>
              </div>
              <div className="space-y-2">
                {clusterSystems.map((sys) => (
                  <div
                    key={sys.name}
                    className="glass-card rounded-lg px-3 py-2 space-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-foreground">{sys.name}</span>
                      <span className="text-[8px] font-mono text-muted-foreground/40">{sys.book}</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground/60">{sys.logic}</p>
                    <p className="text-[8px] text-muted-foreground/40">{sys.params}</p>
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
        <h4 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-3">
          Regime-Adaptive Cluster Weights
        </h4>
        <div className="grid grid-cols-3 gap-3">
          {clusterWeights.map((w) => (
            <div key={w.regime} className="space-y-2">
              <div className="text-[10px] font-semibold text-foreground text-center">{w.regime}</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[8px] text-muted-foreground/50 w-8">T</span>
                  <div className="flex-1 h-2 bg-surface-2/50 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${w.trend * 100}%` }}
                      viewport={{ once: true }}
                      className="h-full bg-neutral-accent/50 rounded-full"
                    />
                  </div>
                  <span className="text-[8px] font-mono text-muted-foreground/40 w-6">{w.trend}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] text-muted-foreground/50 w-8">MR</span>
                  <div className="flex-1 h-2 bg-surface-2/50 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${w.mr * 100}%` }}
                      viewport={{ once: true }}
                      className="h-full bg-amber-500/50 rounded-full"
                    />
                  </div>
                  <span className="text-[8px] font-mono text-muted-foreground/40 w-6">{w.mr}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] text-muted-foreground/50 w-8">M</span>
                  <div className="flex-1 h-2 bg-surface-2/50 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${w.mom * 100}%` }}
                      viewport={{ once: true }}
                      className="h-full bg-bullish/50 rounded-full"
                    />
                  </div>
                  <span className="text-[8px] font-mono text-muted-foreground/40 w-6">{w.mom}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Auto-kill callout */}
      <div className="glass-card rounded-xl px-4 py-3 border-l-[3px] border-l-[var(--bearish)]">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Auto-kill weak systems:</strong> Each system&apos;s win rate is tracked over a 30-trade window.
          Below 30% = disabled. Below 40% = penalized. Above 60% = bonus. Weights adapt automatically.
        </p>
      </div>
    </div>
  );
}
