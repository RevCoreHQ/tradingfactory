"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Scale, ShieldAlert, RefreshCw, ShieldCheck } from "lucide-react";

export function RiskManagementVisual() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Position Sizing */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="panel rounded-lg p-4 space-y-3"
        >
          <div className="flex items-center gap-2 mb-1">
            <Scale className="h-4 w-4 text-neutral-accent/60" />
            <h4 className="text-[11px] font-semibold text-foreground">Position Sizing</h4>
          </div>
          <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
            Each trade&apos;s position size is scaled by conviction tier. Higher conviction = more risk allocated.
          </p>
          <div className="space-y-2">
            {[
              { tier: "A+", mult: "1.25x", risk: "2.5%", example: "$250 on $10k", color: "bg-bullish" },
              { tier: "A", mult: "1.0x", risk: "2.0%", example: "$200 on $10k", color: "bg-bullish/60" },
            ].map((t) => (
              <div key={t.tier} className="flex items-center gap-2">
                <span className={cn("inline-flex items-center justify-center h-6 w-8 rounded text-[10px] font-black text-white", t.color)}>
                  {t.tier}
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-foreground">{t.mult} base</span>
                    <span className="text-[9px] text-muted-foreground/40">&rarr;</span>
                    <span className="text-[10px] font-mono text-neutral-accent/70">{t.risk} risk</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground/40">{t.example}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 bg-surface-2/30 rounded-md px-3 py-2">
            <p className="text-[9px] font-mono text-muted-foreground/50 leading-relaxed">
              lots = (equity &times; risk% &times; multiplier) / (pipsAtRisk &times; pipValue)
            </p>
          </div>
        </motion.div>

        {/* Risk Per Trade */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="panel rounded-lg p-4 space-y-3"
        >
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="h-4 w-4 text-bearish/60" />
            <h4 className="text-[11px] font-semibold text-foreground">Risk Per Trade</h4>
          </div>
          <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
            Fixed percentage risk model scaled by conviction, expectancy, and drawdown throttle.
          </p>
          <div className="space-y-2.5">
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-foreground">Base Risk</span>
                <span className="text-[10px] font-mono text-neutral-accent/70">2% per trade</span>
              </div>
              <span className="text-[9px] text-muted-foreground/40">Applied to A-tier setups</span>
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-foreground">Expectancy Adjusted</span>
                <span className="text-[10px] font-mono text-bullish/70">0.5x — 1.5x</span>
              </div>
              <span className="text-[9px] text-muted-foreground/40">EV &gt; 1.0R &rarr; 1.5x, EV 0.5-1.0R &rarr; 1.25x, EV &lt; 0 &rarr; 0.5x</span>
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-foreground">Drawdown Throttle</span>
                <span className="text-[10px] font-mono text-bearish/70">25% — 100%</span>
              </div>
              <span className="text-[9px] text-muted-foreground/40">Auto-reduces size on consecutive losing streaks</span>
            </div>
          </div>
          <div className="mt-2 bg-surface-2/30 rounded-md px-3 py-2">
            <p className="text-[9px] font-mono text-muted-foreground/50 leading-relaxed">
              risk$ = equity &times; 2% &times; convictionMult &times; expectancyMult &times; throttle
            </p>
          </div>
        </motion.div>

        {/* Expectancy Learning */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="panel rounded-lg p-4 space-y-3"
        >
          <div className="flex items-center gap-2 mb-1">
            <RefreshCw className="h-4 w-4 text-bullish/60" />
            <h4 className="text-[11px] font-semibold text-foreground">Expectancy Learning</h4>
          </div>
          <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
            R-multiple tracking with time decay replaces the old simple win-rate model.
          </p>

          {/* Learning flow */}
          <div className="space-y-1.5">
            {[
              { step: "1", label: "R-Multiple recorded", desc: "P&L normalized to risk units" },
              { step: "2", label: "Time-decayed stats", desc: "30-day half-life exponential decay" },
              { step: "3", label: "Expectancy computed", desc: "EV = (winRate × avgWinR) - (lossRate × avgLossR)" },
              { step: "4", label: "Kelly fraction", desc: "Optimal sizing capped at 25% of Kelly" },
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-2">
                <span className="h-5 w-5 rounded-full bg-bullish/15 text-bullish text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {s.step}
                </span>
                <div>
                  <span className="text-[10px] font-semibold text-foreground">{s.label}</span>
                  <p className="text-[9px] text-muted-foreground/50">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 bg-bullish/8 border border-bullish/15 rounded-md px-3 py-2">
            <div className="text-[10px] font-semibold text-bullish/80">Threshold: 10+ trades</div>
            <p className="text-[9px] text-muted-foreground/50">
              3 pattern dimensions: global, instrument-specific, and regime-specific.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Portfolio Risk Gate — full width below */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3 }}
        className="panel rounded-lg p-4 space-y-3"
      >
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-4 w-4 text-bearish/60" />
          <h4 className="text-[11px] font-semibold text-foreground">Portfolio Risk Gate</h4>
        </div>
        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
          Every new setup must pass portfolio-level constraints before reaching the desk. This prevents
          concentration risk, currency overexposure, and runaway drawdowns.
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            { check: "Total risk < 6%", desc: "Sum of all open position risk vs equity", icon: "%" },
            { check: "Currency cap < 4%", desc: "Per-currency exposure (base + quote)", icon: "$" },
            { check: "Max 2 correlated", desc: "EUR/GBP, AUD/NZD, indices, crypto groups", icon: "C" },
            { check: "Drawdown throttle", desc: "2 losses → 75%, 3 → 50%, 4+ → 25% size", icon: "D" },
          ].map((c) => (
            <div key={c.check} className="bg-bearish/8 border border-bearish/15 rounded-md px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span className="h-5 w-5 rounded bg-bearish/20 text-bearish text-[9px] font-bold flex items-center justify-center shrink-0">
                  {c.icon}
                </span>
                <span className="text-[10px] font-semibold text-bearish/80">{c.check}</span>
              </div>
              <p className="text-[9px] text-muted-foreground/50 mt-1">{c.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] text-muted-foreground/50">
          Blocked setups are capped to D-tier (auto-filtered). System performance auto-kills systems
          with &lt;30% win rate after 10+ trades.
        </p>
      </motion.div>
    </div>
  );
}
