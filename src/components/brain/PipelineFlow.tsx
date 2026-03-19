"use client";

import { PipelineStageCard } from "./PipelineStageCard";
import {
  Database,
  BarChart3,
  Cog,
  Target,
  ShieldAlert,
  Layers,
  Clock,
  Scale,
  Sparkles,
  RefreshCw,
} from "lucide-react";

export function PipelineFlow() {
  return (
    <div className="relative space-y-2">
      {/* SVG connector line */}
      <div className="absolute left-[29px] top-0 bottom-0 w-px bg-gradient-to-b from-neutral-accent/30 via-bullish/20 to-bearish/20 hidden sm:block" />

      <PipelineStageCard
        number={1}
        title="Raw Market Data"
        subtitle="OHLCV candles, news feeds, economic data, rates"
        icon={<Database className="h-3.5 w-3.5" />}
        badge="data"
        accentColor="blue"
      >
        <p>
          Every signal starts with raw data. The system fetches OHLCV candles from Twelve Data (primary, paid tier)
          with Finnhub and Alpha Vantage as fallbacks, across multiple timeframes — <strong>1H and 4H in parallel</strong> for
          all 16 instruments. Candles are the sole input to the 8 mechanical systems below.
        </p>
        <p>
          In parallel (but on a <strong>separate track</strong>), fundamental data streams from 7 sources: news
          sentiment, Fear &amp; Greed, central bank policy, bond yields, economic calendar, COT positioning,
          and ADR. Fundamentals feed the bias engine and AI advisor — they do <strong>not</strong> feed the
          mechanical signal systems directly.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2">
          {["Finnhub", "Twelve Data", "FMP", "Alternative.me"].map((src) => (
            <span key={src} className="text-[9px] font-mono text-neutral-accent/60 bg-neutral-accent/8 px-2 py-1 rounded text-center">
              {src}
            </span>
          ))}
        </div>
      </PipelineStageCard>

      <PipelineStageCard
        number={2}
        title="Technical Indicators"
        subtitle="20+ indicators calculated from price data"
        icon={<BarChart3 className="h-3.5 w-3.5" />}
        badge="data"
        accentColor="blue"
      >
        <p>
          Raw candles are transformed into a full technical summary. Every indicator is computed locally — no
          external API calls for indicator data.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-2">
          {[
            "EMA (9,13,21,50,200)",
            "SMA (9,20,26,50,200)",
            "RSI(14)",
            "MACD (12,26,9)",
            "Bollinger Bands",
            "ATR(14)",
            "ADX",
            "Stochastic RSI",
            "Elder-Ray",
            "Elder Impulse",
            "Support/Resistance",
            "Pivot Points",
          ].map((ind) => (
            <span key={ind} className="text-[9px] font-mono text-neutral-accent/60 bg-neutral-accent/8 px-2 py-1 rounded text-center">
              {ind}
            </span>
          ))}
        </div>
      </PipelineStageCard>

      <PipelineStageCard
        number={3}
        title="8 Mechanical Signal Systems"
        subtitle="Book-sourced strategies fire independently"
        icon={<Cog className="h-3.5 w-3.5" />}
        badge="mechanical"
        accentColor="green"
      >
        <p>
          Eight independent systems — each sourced from proven trading books — analyze the indicators and
          produce a direction (<strong>bullish</strong>, <strong>bearish</strong>, or <strong>neutral</strong>),
          a strength score (0-100), and whether they match the current market regime.
        </p>
        <p>
          The regime is detected from ADX: <strong>ADX &gt; 50</strong> = volatile,{" "}
          <strong>ADX &gt; 30</strong> = trending (up/down based on DI+/DI-),{" "}
          <strong>ADX ≤ 30</strong> = ranging. Systems are categorized as <strong>Trend</strong> (MA Crossover,
          MACD, BB Breakout, Trend Stack), <strong>Mean Reversion</strong> (RSI Extremes, BB Mean Reversion),
          or <strong>Momentum</strong> (Elder Impulse, Elder-Ray). Signals that don&apos;t match the regime get
          their strength reduced by 40%.
        </p>
        <p className="text-bullish/70 font-semibold">
          This is 100% rule-based. Zero AI. Pure math from indicator values.
        </p>
      </PipelineStageCard>

      <PipelineStageCard
        number={4}
        title="Conviction Scoring"
        subtitle="Signal agreement + regime match + impulse → A+ to D"
        icon={<Target className="h-3.5 w-3.5" />}
        badge="mechanical"
        accentColor="green"
      >
        <p>A conviction score (0-100) is calculated from four factors:</p>
        <div className="space-y-1 mt-2">
          <div className="flex items-center gap-2">
            <span className="w-20 text-[9px] font-bold text-neutral-accent/60 uppercase">Agreement</span>
            <div className="flex-1 h-3 bg-neutral-accent/10 rounded-full overflow-hidden">
              <div className="h-full bg-neutral-accent/40 rounded-full" style={{ width: "40%" }} />
            </div>
            <span className="text-[9px] font-mono text-muted-foreground/60 w-12 text-right">0-40 pts</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 text-[9px] font-bold text-bullish/60 uppercase">Regime</span>
            <div className="flex-1 h-3 bg-bullish/10 rounded-full overflow-hidden">
              <div className="h-full bg-bullish/40 rounded-full" style={{ width: "25%" }} />
            </div>
            <span className="text-[9px] font-mono text-muted-foreground/60 w-12 text-right">0-25 pts</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 text-[9px] font-bold text-amber-500/60 uppercase">Impulse</span>
            <div className="flex-1 h-3 bg-amber-500/10 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500/40 rounded-full" style={{ width: "35%" }} />
            </div>
            <span className="text-[9px] font-mono text-muted-foreground/60 w-12 text-right">-15 to +20</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 text-[9px] font-bold text-[var(--foreground)]/40 uppercase">Strong</span>
            <div className="flex-1 h-3 bg-foreground/5 rounded-full overflow-hidden">
              <div className="h-full bg-foreground/20 rounded-full" style={{ width: "15%" }} />
            </div>
            <span className="text-[9px] font-mono text-muted-foreground/60 w-12 text-right">0-15 pts</span>
          </div>
        </div>
        <p className="mt-2">
          <strong>Tiers:</strong> A+ (≥75, 5+ signals) → A (≥60, 4+) → B (≥40, 3+) → C (≥25, 2+) → D (&lt;25)
        </p>
      </PipelineStageCard>

      <PipelineStageCard
        number={5}
        title="Hard Filters"
        subtitle="Quality gates that reject weak setups"
        icon={<ShieldAlert className="h-3.5 w-3.5" />}
        badge="filter"
        accentColor="red"
      >
        <p>Four non-negotiable filters remove weak setups before they reach the desk:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
          {[
            { rule: "Only A+ and A conviction", desc: "B, C, D are rejected" },
            { rule: "Elder Impulse hard gate", desc: "Never long on RED, never short on GREEN" },
            { rule: "R:R ≥ 1.5", desc: "Minimum risk-reward ratio on TP1" },
            { rule: "Non-neutral direction", desc: "Must have clear bullish or bearish bias" },
          ].map((f) => (
            <div key={f.rule} className="bg-bearish/8 border border-bearish/15 rounded-md px-2.5 py-1.5">
              <div className="text-[10px] font-semibold text-bearish/80">{f.rule}</div>
              <div className="text-[9px] text-muted-foreground/50">{f.desc}</div>
            </div>
          ))}
        </div>
      </PipelineStageCard>

      <PipelineStageCard
        number={6}
        title="Structural Level Snapping"
        subtitle="Entry, SL, TP levels aligned to real S/R zones"
        icon={<Layers className="h-3.5 w-3.5" />}
        badge="data"
        accentColor="blue"
      >
        <p>
          Raw ATR-based levels are &ldquo;snapped&rdquo; to the nearest structural support/resistance zones.
          The system collects S/R from three sources:
        </p>
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          {[
            { name: "Fractal S/R", desc: "Pivot highs & lows" },
            { name: "Pivot Points", desc: "Daily + Weekly (weighted)" },
            { name: "Fibonacci", desc: "0.618 & 0.382 levels" },
          ].map((s) => (
            <div key={s.name} className="bg-neutral-accent/8 border border-neutral-accent/15 rounded-md px-2.5 py-1.5 text-center">
              <div className="text-[10px] font-semibold text-neutral-accent/80">{s.name}</div>
              <div className="text-[9px] text-muted-foreground/50">{s.desc}</div>
            </div>
          ))}
        </div>
        <p className="mt-2">
          Stop loss snaps to the strongest nearby support/resistance. Take profits snap to levels that maintain
          minimum R:R ratios (1.5:1, 2.0:1, 2.5:1).
        </p>
      </PipelineStageCard>

      <PipelineStageCard
        number={7}
        title="Trading Style Selection"
        subtitle="ADX regime + session score → intraday vs swing"
        icon={<Clock className="h-3.5 w-3.5" />}
        badge="mechanical"
        accentColor="amber"
      >
        <p>
          Each instrument gets its own trading style based on current market conditions:
        </p>
        <div className="space-y-1 mt-2">
          {[
            { condition: "Session score < 30", result: "Swing", reason: "Off-hours = low liquidity, wider stops" },
            { condition: "ADX > 50", result: "Intraday", reason: "Very volatile = shorter exposure" },
            { condition: "ADX > 20", result: "Swing", reason: "Trending = ride the move" },
            { condition: "ADX ≤ 20", result: "Intraday", reason: "Ranging = mean reversion works" },
          ].map((r) => (
            <div key={r.condition} className="flex items-center gap-2 text-[10px]">
              <span className="font-mono text-muted-foreground/60 w-32 shrink-0">{r.condition}</span>
              <span className="text-[8px] font-bold text-foreground/60">→</span>
              <span className={r.result === "Intraday" ? "text-neutral-accent font-semibold w-14" : "text-muted-foreground font-semibold w-14"}>
                {r.result}
              </span>
              <span className="text-muted-foreground/50">{r.reason}</span>
            </div>
          ))}
        </div>
        <p className="mt-2">
          <strong>Intraday</strong>: 1H candles, 1.5 ATR stop, 8h expiry.{" "}
          <strong>Swing</strong>: 4H candles, 2.0 ATR stop, 24h expiry.
        </p>
      </PipelineStageCard>

      <PipelineStageCard
        number={8}
        title="Position Sizing"
        subtitle="Conviction-scaled risk per trade"
        icon={<Scale className="h-3.5 w-3.5" />}
        badge="filter"
        accentColor="red"
      >
        <p>
          Position size is calculated from account equity, risk percent, and conviction tier:
        </p>
        <div className="flex gap-3 mt-2">
          {[
            { tier: "A+", mult: "1.25x", risk: "2.5%", color: "text-bullish" },
            { tier: "A", mult: "1.0x", risk: "2.0%", color: "text-bullish/70" },
          ].map((t) => (
            <div key={t.tier} className="flex-1 bg-bullish/8 border border-bullish/15 rounded-md px-3 py-2 text-center">
              <div className={`text-lg font-black ${t.color}`}>{t.tier}</div>
              <div className="text-[9px] text-muted-foreground/60">{t.mult} base → {t.risk} risk</div>
            </div>
          ))}
        </div>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground/50">
          lots = (equity * riskPercent * convictionMultiplier) / (pipsAtRisk * pipValue)
        </p>
      </PipelineStageCard>

      <PipelineStageCard
        number={9}
        title="AI Trade Advisor"
        subtitle="LLM narrates and contextualizes the top setups"
        icon={<Sparkles className="h-3.5 w-3.5" />}
        badge="ai"
        accentColor="amber"
      >
        <p>
          <strong>This is where AI enters.</strong> The mechanical engine has already decided the trade ideas.
          The AI Trade Advisor (Desk Manager) receives all A+/A setups along with market context — regime
          summary, Fear &amp; Greed, DXY, bond yields, account equity.
        </p>
        <p>
          The LLM then provides: a market regime assessment, a top pick with rationale, risk warnings,
          and strategy recommendations. It&apos;s a <strong>narrator, not a decision-maker</strong>.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 mt-2">
          {[
            { name: "Instrument LLM", desc: "Single-instrument deep analysis" },
            { name: "Batch LLM", desc: "All 16 instruments in parallel" },
            { name: "Desk Manager", desc: "All A+/A setups + market context" },
          ].map((ai) => (
            <div key={ai.name} className="bg-amber-500/8 border border-amber-500/15 rounded-md px-2.5 py-1.5 text-center">
              <div className="text-[10px] font-semibold text-amber-500/80">{ai.name}</div>
              <div className="text-[9px] text-muted-foreground/50">{ai.desc}</div>
            </div>
          ))}
        </div>
      </PipelineStageCard>

      <PipelineStageCard
        number={10}
        title="Confluence Learning"
        subtitle="Feedback loop — outcomes improve future scoring"
        icon={<RefreshCw className="h-3.5 w-3.5" />}
        badge="mechanical"
        accentColor="green"
      >
        <p>
          Every trade setup is tracked through its lifecycle: <strong>pending → active → breakeven → TP1 → TP2 → TP3</strong> (or SL hit / expired / invalidated at any stage).
          Pending/active setups are continuously re-evaluated — if the setup drops out of the A+/A rankings
          (conviction fell, impulse flipped, or R:R collapsed), it is <strong>invalidated</strong> immediately.
          Trade plan levels (entry zone, SL, TP, R:R) are synced live while <strong>pending</strong> but <strong>frozen on activation</strong> —
          once price enters the entry zone, the levels lock in place so breakeven/TP tracking uses the actual
          entry price, not a drifting recalculation. Outcomes are stored with a confluence pattern
          key built from the agreeing system names + regime + impulse color + trading style.
        </p>
        <p>
          After 5+ trades on a pattern, the system adjusts risk multipliers based on win rate: ≥75% → 1.5x,
          ≥60% → 1.25x, ≥50% → 1.0x, ≥30% → 0.75x, &lt;30% → 0.5x. This creates a self-improving feedback
          loop — all without AI.
        </p>
      </PipelineStageCard>
    </div>
  );
}
