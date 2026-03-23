"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const factors = [
  { name: "Cluster Agreement", range: "0-40 pts", pct: 40, color: "bg-neutral-accent/50", desc: "De-correlated: best signal per cluster, weighted by regime" },
  { name: "Regime Match", range: "0-25 pts", pct: 25, color: "bg-bullish/50", desc: "Regime-matched signals: >=3 = 25, >=2 = 15, >=1 = 8" },
  { name: "Impulse Alignment", range: "-15 to +20", pct: 35, color: "bg-amber-500/50", desc: "GREEN+bullish = +20, RED+bearish = +20, conflict = -15" },
  { name: "Strong Signal", range: "0-15 pts", pct: 15, color: "bg-foreground/20", desc: "5 pts per signal with strength >= 70 (max 15)" },
  { name: "Phase Scoring", range: "-15 to +10", pct: 25, color: "bg-bullish/40", desc: "Expansion aligned = +10, distribution vs bullish = -15" },
  { name: "Structure", range: "-15 to +10", pct: 25, color: "bg-neutral-accent/40", desc: "HH/HL aligned = +10, CHoCH against = -15, BOS = +5" },
  { name: "Exhaustion", range: "-10 pts", pct: 10, color: "bg-bearish/40", desc: "High volatility + ADX decelerating" },
  { name: "MTF Alignment", range: "-10 to +10", pct: 20, color: "bg-neutral-accent/40", desc: "4-timeframe EMA stack: full = +10, against = -10" },
  { name: "ICT Confluence", range: "0-10 pts", pct: 10, color: "bg-amber-500/40", desc: "Fresh FVG aligned +5, Order Block ≥60 strength +3, Displacement +2" },
];

const tiers = [
  { tier: "A+", score: ">= 75", signals: "3 clusters", barWidth: "100%", desc: "Elite setup — all 3 clusters agree", highlight: true },
  { tier: "A", score: ">= 60", signals: "2+ clusters", barWidth: "80%", desc: "Strong setup — high confidence", highlight: true },
  { tier: "B", score: ">= 40", signals: "2+ clusters", barWidth: "53%", desc: "Moderate — filtered out", highlight: false },
  { tier: "C", score: ">= 25", signals: "1+ cluster", barWidth: "33%", desc: "Weak — insufficient agreement", highlight: false },
  { tier: "D", score: "< 25", signals: "any", barWidth: "15%", desc: "No trade", highlight: false },
];

export function SystemConviction() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Scoring factors */}
      <div className="lg:col-span-5">
        <h4 className="text-[12px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-3">
          9 Scoring Factors (0-100 pts)
        </h4>
        <div className="space-y-2.5">
          {factors.map((f, i) => (
            <motion.div
              key={f.name}
              initial={{ opacity: 0, x: -15 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-foreground">{f.name}</span>
                <span className="text-[11px] font-mono text-muted-foreground/50">{f.range}</span>
              </div>
              <div className="h-2 bg-surface-2/50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${f.pct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.06 }}
                  className={cn("h-full rounded-full", f.color)}
                />
              </div>
              <p className="text-[10px] text-muted-foreground/40">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Right: Tier ladder */}
      <div className="lg:col-span-7">
        <h4 className="text-[12px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-3">
          Conviction Tiers
        </h4>
        <div className="space-y-2.5">
          {tiers.map((t, i) => (
            <motion.div
              key={t.tier}
              initial={{ opacity: 0, x: 15 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border",
                t.highlight
                  ? "glass-card border-bullish/20 pipeline-node-glow pipeline-node-glow-green"
                  : "glass-card border-border/20 opacity-50"
              )}
            >
              <span
                className={cn(
                  "inline-flex items-center justify-center h-9 w-11 rounded-lg text-sm font-black",
                  t.highlight ? "bg-bullish text-white" : "bg-muted-foreground/15 text-muted-foreground"
                )}
              >
                {t.tier}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12px] font-mono text-foreground/70">Score {t.score}</span>
                  <span className="text-[11px] text-muted-foreground/30">|</span>
                  <span className="text-[12px] font-mono text-foreground/70">{t.signals} signals</span>
                </div>
                <div className="h-1.5 bg-surface-2/50 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: t.barWidth }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.08 }}
                    className={cn(
                      "h-full rounded-full",
                      t.highlight ? "bg-bullish/60" : "bg-muted-foreground/20"
                    )}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">{t.desc}</p>
              </div>
              {!t.highlight && (
                <span className="text-[10px] font-bold text-bearish/60 uppercase tracking-wider shrink-0">
                  Filtered
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </div>

    </div>
  );
}
