"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Scale, ShieldAlert, RefreshCw } from "lucide-react";

export function RiskManagementVisual() {
  return (
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
                  <span className="text-[9px] text-muted-foreground/40">→</span>
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

      {/* Portfolio Limits */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="panel rounded-lg p-4 space-y-3"
      >
        <div className="flex items-center gap-2 mb-1">
          <ShieldAlert className="h-4 w-4 text-bearish/60" />
          <h4 className="text-[11px] font-semibold text-foreground">Portfolio Guardrails</h4>
        </div>
        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
          Hard limits that prevent over-exposure regardless of conviction.
        </p>
        <div className="space-y-2.5">
          {[
            { name: "Portfolio Heat", limit: "6%", desc: "Max total equity at risk", pct: 60 },
            { name: "Daily Loss", limit: "5%", desc: "Stop trading if hit", pct: 50 },
            { name: "Weekly Loss", limit: "10%", desc: "Stop trading if hit", pct: 100 },
            { name: "Open Positions", limit: "5 max", desc: "Concurrent trade cap", pct: 50 },
          ].map((g) => (
            <div key={g.name} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-foreground">{g.name}</span>
                <span className="text-[10px] font-mono text-bearish/70">{g.limit}</span>
              </div>
              <div className="h-1.5 bg-surface-2/50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${g.pct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className="h-full bg-bearish/40 rounded-full"
                />
              </div>
              <span className="text-[9px] text-muted-foreground/40">{g.desc}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-bullish" />
            <span className="text-[9px] text-muted-foreground/50">CLEAR — All limits within bounds</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-[9px] text-muted-foreground/50">CAUTION — Approaching limit (60%+)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-bearish" />
            <span className="text-[9px] text-muted-foreground/50">STOP — Limit hit, no new trades</span>
          </div>
        </div>
      </motion.div>

      {/* Confluence Learning */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2 }}
        className="panel rounded-lg p-4 space-y-3"
      >
        <div className="flex items-center gap-2 mb-1">
          <RefreshCw className="h-4 w-4 text-bullish/60" />
          <h4 className="text-[11px] font-semibold text-foreground">Confluence Learning</h4>
        </div>
        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
          A self-improving feedback loop that adjusts risk based on historical performance of signal patterns.
        </p>

        {/* Learning flow */}
        <div className="space-y-1.5">
          {[
            { step: "1", label: "Trade closes", desc: "Win, loss, or breakeven recorded" },
            { step: "2", label: "Pattern key built", desc: "Signals + regime + impulse + style" },
            { step: "3", label: "Stats updated", desc: "Win rate, avg P&L per pattern" },
            { step: "4", label: "Multiplier adjusted", desc: "≥75% → 1.5x, ≥60% → 1.25x, ≥50% → 1.0x, <30% → 0.5x" },
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
          <div className="text-[10px] font-semibold text-bullish/80">Threshold: 5+ trades</div>
          <p className="text-[9px] text-muted-foreground/50">
            Learning only kicks in after 5 completed trades on a pattern. Multiplier range: 0.5x to 1.5x.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
