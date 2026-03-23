"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

interface Step {
  number: number;
  title: string;
  badge: string;
  summary: string;
  content: React.ReactNode;
}

const badgeColors: Record<string, string> = {
  DATA: "bg-neutral-accent/15 text-neutral-accent border-neutral-accent/25",
  MECH: "bg-bullish/15 text-bullish border-bullish/25",
  FILTER: "bg-bearish/15 text-bearish border-bearish/25",
  AI: "bg-amber-500/15 text-amber-700 dark:text-amber-500 border-amber-500/25",
};

const accentBorders: Record<string, string> = {
  DATA: "border-l-[var(--neutral-accent)]",
  MECH: "border-l-[var(--bullish)]",
  FILTER: "border-l-[var(--bearish)]",
  AI: "border-l-amber-500",
};

const steps: Step[] = [
  {
    number: 1,
    title: "Candles Arrive",
    badge: "DATA",
    summary: "OHLCV for EUR/USD on style-specific timeframes",
    content: (
      <div className="space-y-2">
        <p>The system fetches OHLCV candles using a <strong>two-phase approach</strong>: first 1H/4H/Daily (common), then style-specific extras.</p>
        <div className="bg-surface-2/30 rounded-md px-3 py-2 font-mono text-[9px] text-muted-foreground/60 space-y-0.5">
          <div>Instrument: EUR_USD</div>
          <div>Style: Swing → TFs: Weekly, Daily, 4H, 1H</div>
          <div>Latest close: 1.0845</div>
          <div>Session: London-NY overlap (score: 100)</div>
        </div>
        <p className="text-[10px] text-muted-foreground/60">Swing uses Weekly/Daily/4H/1H for MTF alignment. Intraday uses 4H/1H/15M/5M. Signal engine uses 4H (swing) or 1H (intraday).</p>
      </div>
    ),
  },
  {
    number: 2,
    title: "Indicators Calculated",
    badge: "DATA",
    summary: "20+ indicators calculated locally",
    content: (
      <div className="space-y-2">
        <p>4H indicators are <strong>always</strong> computed first (for ADX-based style selection). 1H indicators are computed only if intraday style is chosen.</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { name: "RSI(14)", value: "28.3 (Oversold)" },
            { name: "MACD", value: "Bullish crossover" },
            { name: "ADX", value: "35.2 (Trending)" },
            { name: "BB %B", value: "0.08 (Near lower)" },
            { name: "EMA Stack", value: "9>21>50 (Bullish)" },
            { name: "Impulse", value: "GREEN" },
          ].map((ind) => (
            <div key={ind.name} className="bg-surface-2/30 rounded px-2 py-1">
              <span className="text-[9px] text-muted-foreground/50">{ind.name}</span>
              <div className="text-[10px] font-mono text-foreground/80">{ind.value}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    number: 3,
    title: "Regime Classified",
    badge: "MECH",
    summary: "Normal volatility, Trend structure, Expansion phase",
    content: (
      <div className="space-y-2">
        <p>The <strong>3-axis regime engine</strong> classifies the instrument across volatility, structure, and phase:</p>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { axis: "Volatility", value: "Normal", source: "ATR percentile = 55" },
            { axis: "Structure", value: "Trend", source: "EMA slope + ADX = 28" },
            { axis: "Phase", value: "Expansion", source: "ADX rising + price > EMA50" },
          ].map((r) => (
            <div key={r.axis} className="bg-bullish/8 border border-bullish/15 rounded-md px-2.5 py-1.5">
              <div className="text-[10px] font-semibold text-bullish/80">{r.axis}</div>
              <div className="text-[10px] font-mono text-foreground/70">{r.value}</div>
              <div className="text-[8px] text-muted-foreground/50">{r.source}</div>
            </div>
          ))}
        </div>
        <div className="bg-surface-2/30 rounded-md px-3 py-2 font-mono text-[10px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground/50">Legacy regime:</span>
            <span className="text-foreground font-bold">trending_up</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    number: 4,
    title: "Structure Analyzed",
    badge: "MECH",
    summary: "HH, HL pattern — bullish structure +62",
    content: (
      <div className="space-y-2">
        <p>Swing points classified as HH/HL/LH/LL. BOS and CHoCH events tracked:</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { event: "BOS (Break of Structure)", desc: "Confirmed at 1.0892 — trend continuation", color: "text-bullish/80" },
            { event: "CHoCH", desc: "None detected — no reversal warning", color: "text-muted-foreground/50" },
          ].map((e) => (
            <div key={e.event} className="bg-neutral-accent/8 border border-neutral-accent/15 rounded-md px-2.5 py-1.5">
              <div className={`text-[10px] font-semibold ${e.color}`}>{e.event}</div>
              <div className="text-[9px] text-muted-foreground/50">{e.desc}</div>
            </div>
          ))}
        </div>
        <div className="bg-surface-2/30 rounded-md px-3 py-2 font-mono text-[10px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground/50">Last 4 swings:</span>
            <span className="text-foreground">HH, HL, HH, HL</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground/50">Structure score:</span>
            <span className="text-bullish font-bold">+62</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    number: 5,
    title: "Style Selected",
    badge: "MECH",
    summary: "Swing trading — 4H candles, 2.0 ATR stop",
    content: (
      <div className="space-y-2">
        <p>The full regime + session score determine whether the instrument trades as <strong>1H Intraday</strong> or <strong>4H Swing</strong>.</p>
        <div className="space-y-1.5">
          {[
            { rule: "Session score < 30", result: "Swing", matched: false },
            { rule: "Distribution phase", result: "Intraday", matched: false },
            { rule: "Expansion + trend", result: "Swing", matched: true },
          ].map((r) => (
            <div key={r.rule} className="flex items-center gap-2 text-[10px]">
              <span className={cn("h-2 w-2 rounded-full shrink-0", r.matched ? "bg-bullish" : "bg-muted-foreground/20")} />
              <span className={cn("w-32 shrink-0 font-mono", r.matched ? "text-foreground font-semibold" : "text-muted-foreground/50")}>{r.rule}</span>
              <span className={cn("font-semibold", r.result === "Swing" ? "text-neutral-accent" : "text-amber-500")}>{r.result}</span>
            </div>
          ))}
        </div>
        <div className="bg-surface-2/30 rounded-md px-3 py-2 font-mono text-[10px] space-y-1 mt-2">
          <div className="flex justify-between"><span className="text-muted-foreground/50">Selected:</span><span className="text-foreground font-bold">4H Swing</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground/50">Params:</span><span className="text-muted-foreground/70">SL 2.0 ATR | TPs 3.0/5.0/7.0 ATR | Expiry 24h</span></div>
        </div>
      </div>
    ),
  },
  {
    number: 6,
    title: "3 Systems Fire",
    badge: "MECH",
    summary: "3/3 bullish — full cluster agreement",
    content: (
      <div className="space-y-2">
        <p>Each of the 3 mechanical systems (one per cluster) independently produces a direction and strength on the <strong>selected timeframe</strong> candles.</p>
        <div className="space-y-1">
          {[
            { name: "Trend Stack", dir: "Bullish", str: 85, match: true },
            { name: "RSI Extremes", dir: "Bullish", str: 78, match: false },
            { name: "Elder Impulse", dir: "Bullish", str: 90, match: true },
          ].map((s) => (
            <div key={s.name} className="flex items-center gap-2 text-[10px]">
              <span className="w-24 shrink-0 font-semibold text-foreground/70">{s.name}</span>
              <span className={cn("w-14 font-semibold", s.dir === "Bullish" ? "text-bullish" : s.dir === "Bearish" ? "text-bearish" : "text-muted-foreground/40")}>{s.dir}</span>
              <div className="flex-1 h-1.5 bg-surface-2/50 rounded-full overflow-hidden">
                <div className="h-full bg-bullish/40 rounded-full" style={{ width: `${s.str}%` }} />
              </div>
              <span className="text-[9px] font-mono text-muted-foreground/40 w-6 text-right">{s.str}</span>
              {s.match && <span className="text-[8px] text-bullish/60">MATCH</span>}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-bullish/70 font-semibold">Result: 3 bullish, 0 bearish, 0 neutral — all 3 clusters agree</p>
      </div>
    ),
  },
  {
    number: 7,
    title: "De-correlated",
    badge: "MECH",
    summary: "3 clusters: Trend=85, MR=0, Momentum=65",
    content: (
      <div className="space-y-2">
        <p>Signals grouped into 3 clusters. Best signal picked per cluster, weighted by <strong>trend regime</strong>:</p>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { cluster: "Trend", pick: "Trend Stack (85)", weight: "0.45" },
            { cluster: "Mean Rev.", pick: "No signal", weight: "0.15" },
            { cluster: "Momentum", pick: "Elder Impulse (65)", weight: "0.40" },
          ].map((c) => (
            <div key={c.cluster} className="bg-neutral-accent/8 border border-neutral-accent/15 rounded-md px-2.5 py-1.5 text-center">
              <div className="text-[10px] font-semibold text-neutral-accent/80">{c.cluster}</div>
              <div className="text-[9px] font-mono text-foreground/60">{c.pick}</div>
              <div className="text-[8px] text-muted-foreground/50">Weight: {c.weight}</div>
            </div>
          ))}
        </div>
        <div className="bg-surface-2/30 rounded-md px-3 py-2 font-mono text-[10px]">
          <div className="flex justify-between">
            <span className="text-muted-foreground/50">Weighted agreement:</span>
            <span className="text-foreground font-bold">34.5 / 40 pts</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    number: 8,
    title: "Conviction Scored",
    badge: "MECH",
    summary: "Score: 78 → A+ tier",
    content: (
      <div className="space-y-2">
        <p>The conviction algorithm scores the setup:</p>
        <div className="space-y-1.5">
          {[
            { factor: "Agreement", calc: "3/3 clusters active = full", pts: 38, max: 40 },
            { factor: "Regime Match", calc: "2 match trending (TS + EI)", pts: 20, max: 25 },
            { factor: "Impulse", calc: "GREEN + bullish = aligned", pts: 20, max: 20 },
            { factor: "Strong Signals", calc: "3 signals ≥ 70 (×5 pts each)", pts: 15, max: 15 },
            { factor: "MTF Alignment", calc: "3/4 timeframes aligned = strong", pts: 5, max: 10 },
          ].map((f) => (
            <div key={f.factor} className="flex items-center gap-2">
              <span className="w-28 text-[10px] font-semibold text-foreground/70">{f.factor}</span>
              <span className="flex-1 text-[9px] text-muted-foreground/50">{f.calc}</span>
              <span className="text-[10px] font-mono font-bold text-bullish">{f.pts}/{f.max}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-2 bg-bullish/10 rounded-md px-3 py-2">
          <span className="text-2xl font-black text-bullish">A+</span>
          <div>
            <div className="text-[10px] font-mono text-foreground/70">Score: 93/100 (base 88 + MTF 5, clamped 0-100)</div>
            <div className="text-[9px] text-muted-foreground/50">&ge;70 score AND 3 active clusters = A+</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    number: 9,
    title: "Filters Pass",
    badge: "FILTER",
    summary: "A+ conviction, no impulse conflict, R:R = 2.1",
    content: (
      <div className="space-y-2">
        <p>The setup passes through 4 quality gates:</p>
        <div className="space-y-1.5">
          {[
            { check: "Conviction ≥ A", result: "A+ — PASS", pass: true },
            { check: "Impulse aligned", result: "GREEN + LONG — PASS", pass: true },
            { check: "R:R ≥ 1.5", result: "R:R = 2.1 — PASS", pass: true },
            { check: "Non-neutral", result: "Bullish — PASS", pass: true },
          ].map((c) => (
            <div key={c.check} className="flex items-center gap-2 text-[10px]">
              <span className={cn("h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold", c.pass ? "bg-bullish/20 text-bullish" : "bg-bearish/20 text-bearish")}>
                {c.pass ? "\u2713" : "\u2717"}
              </span>
              <span className="w-28 text-foreground/70">{c.check}</span>
              <span className="text-bullish/70 font-semibold">{c.result}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-bullish font-semibold mt-1">All gates passed. Setup proceeds to desk.</p>
      </div>
    ),
  },
  {
    number: 10,
    title: "Entry Optimized",
    badge: "MECH",
    summary: "Bullish engulfing detected — entry tightened",
    content: (
      <div className="space-y-2">
        <p>1H candle shows a <strong>bullish engulfing</strong> pattern (1.4x previous body). Entry zone refined:</p>
        <div className="bg-surface-2/30 rounded-md px-3 py-2 font-mono text-[10px] space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground/50">Original zone:</span><span className="text-foreground">[1.0880, 1.0895]</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground/50">Refined zone:</span><span className="text-bullish font-semibold">[1.0882, 1.0890]</span></div>
          <div className="border-t border-border/20 my-1" />
          <div className="flex justify-between"><span className="text-muted-foreground/50">Pattern quality:</span><span className="text-foreground">78 (&gt; 60 threshold)</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground/50">Effective R:R:</span><span className="text-bullish font-bold">2.3 (improved from 2.1)</span></div>
        </div>
      </div>
    ),
  },
  {
    number: 11,
    title: "Risk Gate OK",
    badge: "FILTER",
    summary: "2.1% total risk, EUR at 1.8%, no correlated",
    content: (
      <div className="space-y-2">
        <p>Portfolio-level risk gate evaluates 4 constraints:</p>
        <div className="space-y-1.5">
          {[
            { check: "Total risk < 6%", value: "2.1%", pass: true },
            { check: "EUR exposure < 4%", value: "1.8%", pass: true },
            { check: "Correlated < 2", value: "0 EUR pairs open", pass: true },
            { check: "Consecutive losses", value: "0 (full size)", pass: true },
          ].map((c) => (
            <div key={c.check} className="flex items-center gap-2 text-[10px]">
              <span className={cn("h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold", c.pass ? "bg-bullish/20 text-bullish" : "bg-bearish/20 text-bearish")}>
                {c.pass ? "\u2713" : "\u2717"}
              </span>
              <span className="w-32 text-foreground/70">{c.check}</span>
              <span className="text-muted-foreground/60 font-mono">{c.value}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-bullish font-semibold mt-1">Full position size approved.</p>
      </div>
    ),
  },
  {
    number: 12,
    title: "Setup Delivered",
    badge: "AI",
    summary: "EUR/USD A+ LONG — Risk Auditor reviews",
    content: (
      <div className="space-y-2">
        <p>Mechanical engine delivers the final setup. AI Risk Auditor reviews for risk flags:</p>
        <div className="bg-surface-2/30 rounded-md px-3 py-2 font-mono text-[10px] space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground/50">Setup:</span><span className="text-foreground font-bold">EUR/USD LONG A+</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground/50">Entry:</span><span className="text-foreground">1.0882 - 1.0890</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground/50">SL:</span><span className="text-bearish">1.0758</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground/50">TP1/TP2/TP3:</span><span className="text-bullish">1.1020 / 1.1090 / 1.1160</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground/50">Size:</span><span className="text-foreground">0.44 lots (2.5% risk, A+ 1.25x)</span></div>
        </div>
        <div className="bg-amber-500/8 border border-amber-500/15 rounded-md px-3 py-2 text-[10px] text-foreground/70 italic leading-relaxed mt-2">
          &ldquo;EUR/USD is showing strong bullish momentum with all 3 clusters aligned. COT positioning shows
          specs at 45% long — not crowded. Carry is neutral (ECB 4.5% vs Fed 5.25%), no headwind.
          No high-impact events in next 24h. Portfolio has room — no EUR concentration, diversification score 72.
          MTF 3/4 aligned with Weekly bullish. This is my top focus today.&rdquo;
        </div>
        <p className="text-[9px] text-muted-foreground/60 font-semibold">
          The AI did not create this trade idea. It explained the mechanical output in human-readable form.
        </p>
      </div>
    ),
  },
];

export function SystemTradeWalkthrough() {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 mb-2">
        {steps.map((s) => (
          <button
            key={s.number}
            onClick={() => setActiveStep(activeStep === s.number ? null : s.number)}
            className={cn(
              "h-2 w-2 rounded-full transition-all",
              activeStep === s.number
                ? "bg-neutral-accent scale-150"
                : "bg-muted-foreground/20 hover:bg-muted-foreground/40"
            )}
          />
        ))}
      </div>

      {/* Horizontal scrollable timeline */}
      <div className="system-timeline-scroll flex gap-3 pb-2">
        {steps.map((step, i) => {
          const isActive = activeStep === step.number;

          return (
            <motion.button
              key={step.number}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              onClick={() => setActiveStep(isActive ? null : step.number)}
              className={cn(
                "system-timeline-card glass-card rounded-xl p-4 text-left transition-all",
                "min-w-[200px] max-w-[240px]",
                "pipeline-node-glow",
                isActive ? "ring-1 ring-neutral-accent/40 shadow-lg" : "opacity-70 hover:opacity-100"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] font-mono text-muted-foreground/40">{step.number}</span>
                <span className={cn("text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border", badgeColors[step.badge])}>
                  {step.badge}
                </span>
              </div>
              <h5 className="text-[11px] font-semibold text-foreground mb-1">{step.title}</h5>
              <p className="text-[9px] text-muted-foreground/60 leading-relaxed">{step.summary}</p>
            </motion.button>
          );
        })}
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {activeStep && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className={cn(
              "glass-card rounded-xl p-5 border-l-[3px]",
              accentBorders[steps[activeStep - 1].badge]
            )}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-mono text-muted-foreground/40">Step {activeStep}</span>
                <span className="text-xs font-semibold text-foreground">{steps[activeStep - 1].title}</span>
                <span className={cn("text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border", badgeColors[steps[activeStep - 1].badge])}>
                  {steps[activeStep - 1].badge}
                </span>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                {steps[activeStep - 1].content}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
