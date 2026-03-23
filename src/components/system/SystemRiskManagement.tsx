"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Scale, ShieldAlert, RefreshCw, ShieldCheck } from "lucide-react";

const gateChecks = [
  { icon: "%", check: "Total risk < 10%", desc: "Sum of all open position risk% must not exceed budget" },
  { icon: "$", check: "Max 3/currency", desc: "Per-currency position count (base + quote)" },
  { icon: "C", check: "Max 2 correlated", desc: "EUR/GBP, AUD/NZD, indices, crypto" },
  { icon: "D", check: "Drawdown throttle", desc: "2 losses = 75%, 3 = 50%, 4+ = 25%" },
  { icon: "E", check: "Directional exposure", desc: "Net long/short per currency across all positions" },
  { icon: "S", check: "Concentration risk", desc: "Diversification score 0-100, desk manager veto if < 30" },
  { icon: "W", check: "Correlation warnings", desc: "Flagged by portfolio risk — reduce or sit out" },
];

export function SystemRiskManagement() {
  return (
    <div className="space-y-6">
      {/* Three cards: Position Sizing → Risk Per Trade → Expectancy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Position Sizing */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-neutral-accent/60" />
            <h4 className="text-[11px] font-semibold text-foreground">Position Sizing</h4>
          </div>
          <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
            Conviction-scaled risk. Higher tier = more capital allocated.
          </p>
          <div className="space-y-2">
            {[
              { tier: "A+", mult: "1.25x", risk: "2.5%", color: "bg-bullish" },
              { tier: "A", mult: "1.0x", risk: "2.0%", color: "bg-bullish/60" },
            ].map((t) => (
              <div key={t.tier} className="flex items-center gap-2">
                <span className={cn("h-6 w-8 rounded text-[10px] font-black text-white flex items-center justify-center", t.color)}>
                  {t.tier}
                </span>
                <div className="flex-1">
                  <span className="text-[10px] font-semibold text-foreground">{t.mult}</span>
                  <span className="text-[9px] text-muted-foreground/40 ml-1">&rarr; {t.risk} risk</span>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-surface-2/30 rounded-md px-3 py-2">
            <p className="text-[8px] font-mono text-muted-foreground/50">
              lots = (equity &times; risk% &times; mult) / (pips &times; pipValue)
            </p>
          </div>
        </motion.div>

        {/* Risk Per Trade */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-bearish/60" />
            <h4 className="text-[11px] font-semibold text-foreground">Risk Per Trade</h4>
          </div>
          <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
            Fixed % risk scaled by conviction, expectancy, and drawdown throttle.
          </p>
          <div className="space-y-2">
            {[
              { label: "Base Risk", value: "2% per trade", sub: "Applied to A-tier setups" },
              { label: "Expectancy Adj.", value: "0.5x — 1.5x", sub: "EV > 1.0R = 1.5x, EV < 0 = 0.5x" },
              { label: "Drawdown Throttle", value: "25% — 100%", sub: "Auto-reduces on losing streaks" },
            ].map((r) => (
              <div key={r.label} className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-foreground">{r.label}</span>
                  <span className="text-[9px] font-mono text-neutral-accent/70">{r.value}</span>
                </div>
                <span className="text-[8px] text-muted-foreground/40">{r.sub}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Expectancy Learning */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-bullish/60" />
            <h4 className="text-[11px] font-semibold text-foreground">Expectancy Learning</h4>
          </div>
          <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
            R-multiple tracking with 30-day time decay.
          </p>
          <div className="space-y-1.5">
            {[
              { step: "1", label: "R-Multiple recorded", desc: "P&L normalized to risk units" },
              { step: "2", label: "Time-decayed stats", desc: "30-day half-life exponential decay" },
              { step: "3", label: "Expectancy computed", desc: "EV = (winRate x avgWinR) - (lossRate x avgLossR)" },
              { step: "4", label: "Kelly fraction", desc: "Optimal sizing capped at 25%" },
            ].map((s) => (
              <div key={s.step} className="flex items-start gap-2">
                <span className="h-4 w-4 rounded-full bg-bullish/15 text-bullish text-[8px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {s.step}
                </span>
                <div>
                  <span className="text-[9px] font-semibold text-foreground">{s.label}</span>
                  <p className="text-[8px] text-muted-foreground/40">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-bullish/8 border border-bullish/15 rounded-md px-3 py-1.5">
            <span className="text-[9px] font-semibold text-bullish/80">20+ trades threshold</span>
          </div>
        </motion.div>
      </div>

      {/* Portfolio Risk Gate — full width */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3 }}
        className="glass-card rounded-xl p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-4 w-4 text-bearish/60" />
          <h4 className="text-[11px] font-semibold text-foreground">Portfolio Risk Gate</h4>
          <p className="text-[10px] text-muted-foreground/50 ml-2">
            Every setup must pass all 7 constraints
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {gateChecks.map((c, i) => (
            <motion.div
              key={c.check}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + i * 0.08 }}
              className="bg-bearish/8 border border-bearish/15 rounded-lg px-3 py-2.5 pipeline-node-glow pipeline-node-glow-red"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="h-5 w-5 rounded bg-bearish/20 text-bearish text-[9px] font-bold flex items-center justify-center shrink-0">
                  {c.icon}
                </span>
                <span className="text-[10px] font-semibold text-bearish/80">{c.check}</span>
              </div>
              <p className="text-[9px] text-muted-foreground/50">{c.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
