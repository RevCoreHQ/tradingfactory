"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

const tiers = [
  { tier: "A+", score: "≥ 75", signals: "5+", color: "bg-bullish text-white", barWidth: "100%", desc: "Elite setup — max conviction, all systems aligned" },
  { tier: "A", score: "≥ 60", signals: "4+", color: "bg-bullish/70 text-white", barWidth: "80%", desc: "Strong setup — high confidence, most systems agree" },
  { tier: "B", score: "≥ 40", signals: "3+", color: "bg-neutral-accent/50 text-white", barWidth: "53%", desc: "Moderate — filtered out (below quality threshold)" },
  { tier: "C", score: "≥ 25", signals: "2+", color: "bg-muted-foreground/30 text-white", barWidth: "33%", desc: "Weak — too few agreeing signals" },
  { tier: "D", score: "< 25", signals: "any", color: "bg-muted-foreground/15 text-muted-foreground", barWidth: "15%", desc: "No trade — conflicting or absent signals" },
];

export function ConvictionBreakdown() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Left: Scoring Factors */}
      <div className="lg:col-span-5">
        <div className="panel rounded-lg p-4 space-y-3">
          <h4 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
            Scoring Factors (0-100 points)
          </h4>
          <div className="space-y-2.5">
            {[
              { name: "Signal Agreement", range: "0-40 pts", pct: 40, color: "bg-neutral-accent/50", desc: "% of non-neutral systems agreeing with the dominant direction (determined by weighted strength sums)" },
              { name: "Regime Match", range: "0-25 pts", pct: 25, color: "bg-bullish/50", desc: "Regime-matched signals: ≥3 = 25 pts, ≥2 = 15 pts, ≥1 = 8 pts" },
              { name: "Impulse Alignment", range: "-15 to +20", pct: 35, color: "bg-amber-500/50", desc: "GREEN+bullish = +20, RED+bearish = +20, conflict = -15" },
              { name: "Strong Signal Bonus", range: "0-15 pts", pct: 15, color: "bg-foreground/20", desc: "5 pts per agreeing signal with strength ≥ 70 (max 15)" },
            ].map((f, i) => (
              <motion.div
                key={f.name}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-foreground">{f.name}</span>
                  <span className="text-[9px] font-mono text-muted-foreground/50">{f.range}</span>
                </div>
                <div className="h-2 bg-surface-2/50 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${f.pct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: i * 0.1 }}
                    className={cn("h-full rounded-full", f.color)}
                  />
                </div>
                <p className="text-[9px] text-muted-foreground/50">{f.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* ADX Exhaustion */}
          <div className="mt-3 bg-bearish/8 border border-bearish/15 rounded-md px-3 py-2">
            <div className="text-[10px] font-semibold text-bearish/80">ADX Exhaustion Penalty</div>
            <div className="text-[9px] text-muted-foreground/50">
              -10 points when ADX &gt; 50 (reversal risk in overextended trends)
            </div>
          </div>
        </div>
      </div>

      {/* Right: Tier Ladder */}
      <div className="lg:col-span-7">
        <div className="panel rounded-lg p-4 space-y-3">
          <h4 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
            Conviction Tiers
          </h4>
          <div className="space-y-2">
            {tiers.map((t, i) => (
              <motion.div
                key={t.tier}
                initial={{ opacity: 0, x: 10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg border",
                  i < 2 ? "border-bullish/20 bg-bullish/5" : "border-border/20 bg-surface-2/20 opacity-50"
                )}
              >
                <span className={cn("inline-flex items-center justify-center h-8 w-10 rounded text-sm font-black", t.color)}>
                  {t.tier}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-mono text-foreground/70">Score {t.score}</span>
                    <span className="text-[9px] text-muted-foreground/40">|</span>
                    <span className="text-[10px] font-mono text-foreground/70">{t.signals} signals</span>
                  </div>
                  <div className="h-1.5 bg-surface-2/50 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", t.color)} style={{ width: t.barWidth }} />
                  </div>
                  <p className="text-[9px] text-muted-foreground/50 mt-0.5">{t.desc}</p>
                </div>
                {i >= 2 && (
                  <span className="text-[8px] font-bold text-bearish/60 uppercase tracking-wider shrink-0">
                    Filtered
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
