"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Step {
  title: string;
  badge: string;
  badgeColor: string;
  content: React.ReactNode;
}

const steps: Step[] = [
  {
    title: "Candles Arrive",
    badge: "DATA",
    badgeColor: "bg-neutral-accent/12 text-neutral-accent border-neutral-accent/20",
    content: (
      <div className="space-y-2">
        <p>The system fetches <strong>both</strong> 1H and 4H OHLCV candles for every instrument from Twelve Data (primary) with Finnhub fallback.</p>
        <div className="bg-surface-2/30 rounded-md px-3 py-2 font-mono text-[9px] text-muted-foreground/60 space-y-0.5">
          <div>Instrument: EUR_USD</div>
          <div>Timeframes: 1H (300 candles), 4H (300 candles)</div>
          <div>Latest close: 1.0845</div>
          <div>Session: London-NY overlap (score: 100)</div>
        </div>
        <p className="text-[10px] text-muted-foreground/60">Both timeframes are always fetched. The system picks which one to use in the next step.</p>
      </div>
    ),
  },
  {
    title: "Indicators Calculated",
    badge: "DATA",
    badgeColor: "bg-neutral-accent/12 text-neutral-accent border-neutral-accent/20",
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
    title: "Style Selected",
    badge: "MECHANICAL",
    badgeColor: "bg-bullish/12 text-bullish border-bullish/20",
    content: (
      <div className="space-y-2">
        <p>The 4H ADX and session score determine whether the instrument trades as <strong>1H Intraday</strong> or <strong>4H Swing</strong>. This picks which candles the rest of the pipeline uses.</p>
        <div className="space-y-1.5">
          {[
            { rule: "Session score < 30", result: "Swing", desc: "Off-hours: wider stops = less noise", matched: false },
            { rule: "ADX > 50", result: "Intraday", desc: "Volatile: shorter exposure", matched: false },
            { rule: "ADX > 20", result: "Swing", desc: "Trending: ride the move", matched: true },
            { rule: "Else (low ADX)", result: "Intraday", desc: "Ranging: mean reversion", matched: false },
          ].map((r) => (
            <div key={r.rule} className="flex items-center gap-2 text-[10px]">
              <span className={cn("h-2 w-2 rounded-full shrink-0", r.matched ? "bg-bullish" : "bg-muted-foreground/20")} />
              <span className={cn("w-28 shrink-0 font-mono", r.matched ? "text-foreground font-semibold" : "text-muted-foreground/50")}>{r.rule}</span>
              <span className={cn("w-16 shrink-0 font-semibold", r.result === "Swing" ? "text-neutral-accent" : "text-amber-500")}>{r.result}</span>
              <span className="text-muted-foreground/40">{r.desc}</span>
            </div>
          ))}
        </div>
        <div className="bg-surface-2/30 rounded-md px-3 py-2 font-mono text-[10px] space-y-1 mt-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground/50">Selected:</span>
            <span className="text-foreground font-bold">4H Swing</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground/50">Params:</span>
            <span className="text-muted-foreground/70">SL 2.0 ATR | TPs 3.0/5.0/7.0 ATR | Expiry 24h</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "8 Systems Fire",
    badge: "MECHANICAL",
    badgeColor: "bg-bullish/12 text-bullish border-bullish/20",
    content: (
      <div className="space-y-2">
        <p>Each of the 8 mechanical systems independently produces a direction and strength on the <strong>selected timeframe</strong> candles.</p>
        <div className="space-y-1">
          {[
            { name: "MA Crossover", dir: "Bullish", str: 72, match: true },
            { name: "MACD", dir: "Bullish", str: 85, match: true },
            { name: "BB Breakout", dir: "Neutral", str: 30, match: false },
            { name: "RSI Extremes", dir: "Bullish", str: 78, match: false },
            { name: "BB MR", dir: "Bullish", str: 82, match: false },
            { name: "Elder Impulse", dir: "Bullish", str: 90, match: true },
            { name: "Elder-Ray", dir: "Bullish", str: 68, match: true },
            { name: "Trend Stack", dir: "Bullish", str: 75, match: true },
          ].map((s) => (
            <div key={s.name} className="flex items-center gap-2 text-[10px]">
              <span className="w-24 shrink-0 font-semibold text-foreground/70">{s.name}</span>
              <span className={cn("w-14 font-semibold", s.dir === "Bullish" ? "text-bullish" : s.dir === "Bearish" ? "text-bearish" : "text-muted-foreground/40")}>
                {s.dir}
              </span>
              <div className="flex-1 h-1.5 bg-surface-2/50 rounded-full overflow-hidden">
                <div className="h-full bg-bullish/40 rounded-full" style={{ width: `${s.str}%` }} />
              </div>
              <span className="text-[9px] font-mono text-muted-foreground/40 w-6 text-right">{s.str}</span>
              {s.match && <span className="text-[8px] text-bullish/60">MATCH</span>}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-bullish/70 font-semibold">Result: 7 bullish, 0 bearish, 1 neutral</p>
      </div>
    ),
  },
  {
    title: "Conviction Scored",
    badge: "MECHANICAL",
    badgeColor: "bg-bullish/12 text-bullish border-bullish/20",
    content: (
      <div className="space-y-2">
        <p>The conviction algorithm scores the setup:</p>
        <div className="space-y-1.5">
          {[
            { factor: "Agreement", calc: "7/7 non-neutral = 100%", pts: 40, max: 40 },
            { factor: "Regime Match", calc: "5 match trending (≥3 = max)", pts: 25, max: 25 },
            { factor: "Impulse", calc: "GREEN + bullish = aligned", pts: 20, max: 20 },
            { factor: "Strong Signals", calc: "5 signals ≥ 70 (×5 pts each)", pts: 15, max: 15 },
            { factor: "ADX Exhaustion", calc: "ADX 35 (< 50, no penalty)", pts: 0, max: -10 },
          ].map((f) => (
            <div key={f.factor} className="flex items-center gap-2">
              <span className="w-28 text-[10px] font-semibold text-foreground/70">{f.factor}</span>
              <span className="flex-1 text-[9px] text-muted-foreground/50">{f.calc}</span>
              <span className={cn("text-[10px] font-mono font-bold", f.max < 0 ? "text-muted-foreground/40" : "text-bullish")}>{f.pts}{f.max < 0 ? "" : `/${f.max}`}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-2 bg-bullish/10 rounded-md px-3 py-2">
          <span className="text-2xl font-black text-bullish">A+</span>
          <div>
            <div className="text-[10px] font-mono text-foreground/70">Score: 95/100 (clamped 0-100)</div>
            <div className="text-[9px] text-muted-foreground/50">≥75 score AND ≥5 agreeing = A+ | ≥60 AND ≥4 = A</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Hard Filters Pass",
    badge: "FILTER",
    badgeColor: "bg-bearish/12 text-bearish border-bearish/20",
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
    title: "Levels Snap to Structure",
    badge: "DATA",
    badgeColor: "bg-neutral-accent/12 text-neutral-accent border-neutral-accent/20",
    content: (
      <div className="space-y-2">
        <p>Raw ATR-based levels (computed from the style params) are snapped to nearby structural S/R zones:</p>
        <div className="bg-surface-2/30 rounded-md px-3 py-2 font-mono text-[10px] space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground/50">Raw SL (2.0 ATR):</span>
            <span className="text-bearish">1.0795</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground/50">Snapped SL (weekly S1):</span>
            <span className="text-bearish font-semibold">1.0788</span>
          </div>
          <div className="border-t border-border/20 my-1" />
          <div className="flex justify-between">
            <span className="text-muted-foreground/50">Entry zone:</span>
            <span className="text-foreground">1.0840 - 1.0850</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground/50">TP1 (fib 0.618):</span>
            <span className="text-bullish">1.0912</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground/50">TP2 (daily R1):</span>
            <span className="text-bullish">1.0958</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground/50">TP3 (weekly R2):</span>
            <span className="text-bullish">1.1025</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "Position Sized",
    badge: "FILTER",
    badgeColor: "bg-bearish/12 text-bearish border-bearish/20",
    content: (
      <div className="space-y-2">
        <p>Position size calculated from conviction tier and account equity:</p>
        <div className="bg-surface-2/30 rounded-md px-3 py-2 font-mono text-[10px] space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground/50">Account equity:</span>
            <span className="text-foreground">$10,000</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground/50">Base risk:</span>
            <span className="text-foreground">2.0%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground/50">A+ multiplier:</span>
            <span className="text-bullish">1.25x</span>
          </div>
          <div className="border-t border-border/20 my-1" />
          <div className="flex justify-between">
            <span className="text-muted-foreground/50">Risk amount:</span>
            <span className="text-foreground font-bold">$250</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground/50">Pips at risk:</span>
            <span className="text-foreground">57 pips</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground/50">Position size:</span>
            <span className="text-foreground font-bold">0.44 lots</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "AI Advisor Narrates",
    badge: "AI",
    badgeColor: "bg-amber-500/12 text-amber-500 border-amber-500/20",
    content: (
      <div className="space-y-2">
        <p>
          The mechanical engine has finished. Now the AI Desk Manager receives this setup (and all other A+/A setups)
          along with market context, and produces a narrative:
        </p>
        <div className="bg-amber-500/8 border border-amber-500/15 rounded-md px-3 py-2 text-[10px] text-foreground/70 italic leading-relaxed">
          &ldquo;EUR/USD is showing strong bullish momentum with 7 of 8 systems aligned. The Elder Impulse is
          GREEN confirming buying pressure. RSI at 28 suggests we&apos;re catching an oversold bounce in a
          trending regime (ADX 35). The London-NY session overlap provides optimal liquidity. This is my top
          pick for today — entry zone 1.0840-1.0850 with stop below weekly S1 at 1.0788.&rdquo;
        </div>
        <p className="text-[9px] text-muted-foreground/60 font-semibold">
          The AI did not create this trade idea. It explained the mechanical output in human-readable form.
        </p>
      </div>
    ),
  },
  {
    title: "Setup Tracked",
    badge: "MECHANICAL",
    badgeColor: "bg-bullish/12 text-bullish border-bullish/20",
    content: (
      <div className="space-y-2">
        <p>The setup enters the tracking lifecycle. <strong>All 13 instruments</strong> feed live prices to the tracker every cycle, so SL/TP hits are never missed — even if conviction drops.</p>
        <div className="space-y-1.5">
          {[
            { status: "Pending", desc: "Waiting for price to enter entry zone", active: true },
            { status: "Active", desc: "Price entered zone, trade is live", active: false },
            { status: "Breakeven", desc: "Price moved 1 ATR, SL moved to entry — trade is now running", active: false },
            { status: "TP1 Hit", desc: "First target reached — trade keeps running toward TP2", active: false },
            { status: "TP2 Hit", desc: "Second target reached — trade keeps running toward TP3", active: false },
            { status: "TP3 Hit", desc: "Terminal — full win, trade closed", active: false },
            { status: "SL Hit", desc: "Terminal — stop loss hit (breakeven stop after BE)", active: false },
            { status: "Expired / Invalidated", desc: "Terminal — conviction dropped, time expired, or direction flipped", active: false },
          ].map((s) => (
            <div key={s.status} className="flex items-center gap-2 text-[10px]">
              <span className={cn("h-2 w-2 rounded-full shrink-0", s.active ? "bg-bullish animate-pulse" : "bg-muted-foreground/20")} />
              <span className={cn("font-semibold", s.active ? "text-foreground" : "text-muted-foreground/50")}>{s.status}</span>
              <span className="text-muted-foreground/40">— {s.desc}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground/60 font-semibold mt-2">
          Scale-in detection: While a trade is running (BE/TP1/TP2), the system detects pullback
          opportunities. Conditions: 30-70% pullback, 3+ agreeing signals, R:R ≥ 1.5, max 2 per trade,
          50% position size.
        </p>
        <p className="text-[10px] text-muted-foreground/60">
          Outcomes feed back into the confluence learning engine, closing the loop.
        </p>
      </div>
    ),
  },
  {
    title: "Single Brain Enforcement",
    badge: "SINGLE BRAIN",
    badgeColor: "bg-[var(--amber)]/12 text-[var(--amber)] border-[var(--amber)]/20",
    content: (
      <div className="space-y-2">
        <p>Every dashboard section is <strong>overridden by the mechanical bias engine</strong>. The AI (LLM) narrates, but the bias engine is the single source of truth.</p>
        <div className="space-y-1.5">
          {[
            { trigger: "Alerts", desc: "All fire from the mechanical signal pipeline — new A+/A setups, TP milestones, SL hits" },
            { trigger: "Focus Today", desc: "LLM picks focus pairs, then strong conviction instruments (|bias| ≥ 45) are auto-injected if missing" },
            { trigger: "Sit Out", desc: "Strong conviction instruments are removed from Sit Out — they can't be both focus AND avoid" },
            { trigger: "Sector Outlook", desc: "If any instrument in a sector has strong conviction, the sector badge is driven by those instruments alone, not diluted by neutral peers" },
          ].map((a) => (
            <div key={a.trigger} className="flex items-start gap-2 text-[10px]">
              <span className="h-2 w-2 rounded-full shrink-0 bg-[var(--amber)]/40 mt-1" />
              <div>
                <span className="font-semibold text-foreground">{a.trigger}</span>
                <span className="text-muted-foreground/40"> — {a.desc}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground/60 font-semibold mt-2">
          Pipeline: Bias engine scores → Post-process LLM summary → Override focusToday, sitOut, sector badges.
          The LLM provides narrative color; the bias engine provides the numbers that drive every badge and list.
        </p>
      </div>
    ),
  },
];

export function TradeWalkthrough() {
  const [current, setCurrent] = useState(0);
  const step = steps[current];

  return (
    <div className="panel rounded-lg overflow-hidden">
      {/* Stepper */}
      <div className="px-4 py-3 border-b border-border/30 flex items-center gap-1">
        {steps.map((s, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={cn(
              "flex-1 h-1.5 rounded-full transition-all",
              i === current ? "bg-neutral-accent" : i < current ? "bg-bullish/40" : "bg-surface-2/50"
            )}
            aria-label={`Step ${i + 1}: ${s.title}`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="p-5 min-h-[280px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-mono text-muted-foreground/50">
                {current + 1}/{steps.length}
              </span>
              <h4 className="text-sm font-semibold text-foreground">{step.title}</h4>
              <span className={cn("text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border", step.badgeColor)}>
                {step.badge}
              </span>
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              {step.content}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="px-4 py-3 border-t border-border/30 flex items-center justify-between">
        <button
          onClick={() => setCurrent(Math.max(0, current - 1))}
          disabled={current === 0}
          className={cn(
            "flex items-center gap-1 text-[10px] font-semibold px-3 py-1.5 rounded-md transition-colors",
            current === 0
              ? "text-muted-foreground/30 cursor-not-allowed"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-2/50"
          )}
        >
          <ChevronLeft className="h-3 w-3" /> Previous
        </button>
        <button
          onClick={() => setCurrent(Math.min(steps.length - 1, current + 1))}
          disabled={current === steps.length - 1}
          className={cn(
            "flex items-center gap-1 text-[10px] font-semibold px-3 py-1.5 rounded-md transition-colors",
            current === steps.length - 1
              ? "text-muted-foreground/30 cursor-not-allowed"
              : "text-neutral-accent hover:bg-neutral-accent/10"
          )}
        >
          Next <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
