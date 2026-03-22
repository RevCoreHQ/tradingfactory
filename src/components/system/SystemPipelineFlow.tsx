"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { PipelineStageCard } from "@/components/brain/PipelineStageCard";
import {
  Database,
  BarChart3,
  Activity,
  TrendingUp,
  Clock,
  Cog,
  Fingerprint,
  Layers,
  Target,
  ShieldAlert,
  Crosshair,
  Scale,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  LayoutList,
  LayoutGrid,
} from "lucide-react";

/* ── Overview Grid Types ── */
type BadgeType = "mechanical" | "ai" | "filter" | "data";

interface OverviewNode {
  id: number;
  title: string;
  badge: BadgeType;
  lane: number;
  description: string;
}

const badgeColors: Record<BadgeType, { bg: string; text: string; glow: string }> = {
  data: { bg: "bg-neutral-accent/15", text: "text-neutral-accent", glow: "pipeline-node-glow-blue" },
  mechanical: { bg: "bg-bullish/15", text: "text-bullish", glow: "pipeline-node-glow-green" },
  filter: { bg: "bg-bearish/15", text: "text-bearish", glow: "pipeline-node-glow-red" },
  ai: { bg: "bg-amber-500/15", text: "text-amber-500", glow: "pipeline-node-glow-amber" },
};

const overviewNodes: OverviewNode[] = [
  { id: 1, title: "Raw Data", badge: "data", lane: 0, description: "OHLCV candles from Twelve Data across 4 timeframes (15M, 1H, 4H, Daily) for 16 instruments." },
  { id: 2, title: "Indicators", badge: "data", lane: 0, description: "20+ technical indicators computed locally: EMAs, RSI, MACD, BB, ATR, ADX, Elder-Ray, Impulse, S/R, Pivots." },
  { id: 3, title: "Regime Engine", badge: "mechanical", lane: 1, description: "3-axis classification: Volatility × Structure × Phase. ATR percentile, BB width, EMA slope, ADX direction." },
  { id: 4, title: "Market Structure", badge: "mechanical", lane: 1, description: "HH/HL/LH/LL swing classification. BOS and CHoCH detection. Structure score -100 to +100." },
  { id: 5, title: "Style Select", badge: "mechanical", lane: 1, description: "Full regime + session score → intraday vs swing. Phase and structure drive selection." },
  { id: 6, title: "8 Systems", badge: "mechanical", lane: 2, description: "Eight book-sourced mechanical systems fire independently. Dynamic weights auto-kill weak systems." },
  { id: 7, title: "De-correlate", badge: "mechanical", lane: 2, description: "Best signal per cluster, weighted by regime. Prevents fake confluence from correlated signals." },
  { id: 8, title: "MTF Align", badge: "mechanical", lane: 2, description: "EMA stack on 4 timeframes. Full (4/4) +10pts, Strong (3/4) +5pts, Against (<2) -10pts." },
  { id: 9, title: "Conviction", badge: "mechanical", lane: 2, description: "8 scoring factors → 0-100 → A+/A/B/C/D tiers." },
  { id: 10, title: "Hard Filters", badge: "filter", lane: 3, description: "Only A+/A pass. Elder Impulse gate. R:R ≥ 1.5. Non-neutral direction." },
  { id: 11, title: "Entry Opt.", badge: "mechanical", lane: 3, description: "Candle patterns + EMA(21) pullback detection. Refines entry zone." },
  { id: 12, title: "Levels + Size", badge: "data", lane: 3, description: "S/R snapping. Conviction-scaled sizing: A+ = 1.25x, A = 1.0x." },
  { id: 13, title: "Risk Gate", badge: "filter", lane: 3, description: "Total risk <6%, currency cap <4%, max 2 correlated, drawdown throttle." },
  { id: 14, title: "AI Advisor", badge: "ai", lane: 3, description: "LLM narrates top setups. Regime assessment, risk warnings. Narrator, not decision-maker." },
  { id: 15, title: "Learning", badge: "mechanical", lane: 3, description: "R-multiple tracking, 30-day decay, expectancy-based risk scaling. Kelly fraction capped at 25%." },
];

const laneLabels = ["DATA", "ANALYSIS", "SIGNALS", "EXECUTION"];
const laneColors = ["text-neutral-accent/60", "text-bullish/60", "text-bullish/60", "text-bearish/60"];

/* ── Overview Tooltip Node ── */
function OverviewNodeCard({ node, index }: { node: OverviewNode; index: number }) {
  const [showTip, setShowTip] = useState(false);
  const colors = badgeColors[node.badge];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className={cn("glass-card rounded-lg p-3 cursor-pointer group relative", "pipeline-node-glow", colors.glow)}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[9px] font-mono text-muted-foreground/40 w-4 shrink-0">{node.id}</span>
        <span className="text-[11px] font-semibold text-foreground truncate">{node.title}</span>
      </div>
      <span className={cn("text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border", colors.bg, colors.text, "border-current/20")}>
        {node.badge === "mechanical" ? "MECH" : node.badge.toUpperCase()}
      </span>

      {showTip && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute left-0 right-0 top-full mt-1.5 z-[60]"
        >
          <div className="glass-card rounded-lg p-3 text-[10px] text-muted-foreground leading-relaxed shadow-lg border border-border/40 mx-1">
            {node.description}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ── Overview Grid ── */
function OverviewGrid() {
  const lanes = [0, 1, 2, 3].map((lane) => overviewNodes.filter((n) => n.lane === lane));

  return (
    <div className="space-y-4">
      {lanes.map((laneNodes, laneIdx) => (
        <div key={laneIdx} className="flex items-center gap-3">
          <div className={cn("w-20 shrink-0 text-right", laneColors[laneIdx])}>
            <span className="text-[9px] font-bold uppercase tracking-wider">{laneLabels[laneIdx]}</span>
          </div>
          <div className="flex-1 flex items-center gap-2">
            {laneNodes.map((node, nodeIdx) => (
              <div key={node.id} className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <OverviewNodeCard node={node} index={laneIdx * 4 + nodeIdx} />
                </div>
                {nodeIdx < laneNodes.length - 1 && (
                  <div className="shrink-0 w-4 flex items-center justify-center">
                    <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                      <path d="M0 6h12m0 0L8 2m4 4L8 10" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/30" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="flex justify-center mt-4">
        <div className="flex items-center gap-3 text-[9px] text-muted-foreground/40">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-neutral-accent/40" />Data</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-bullish/40" />Mechanical</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-bearish/40" />Filter</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500/40" />AI</span>
        </div>
      </div>
    </div>
  );
}

/* ── Lane Divider ── */
function LaneDivider({ label, color }: { label: string; color: string }) {
  return (
    <div className="pipeline-lane-divider my-3 ml-8">
      <span className={cn("text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border", color)}>
        {label}
      </span>
    </div>
  );
}

/* ── Detailed Accordion View ── */
function DetailedView() {
  return (
    <div className="relative space-y-2">
      {/* Vertical flow spine */}
      <div className="absolute left-[29px] top-0 bottom-0 w-px bg-gradient-to-b from-neutral-accent/30 via-bullish/20 via-60% to-bearish/20 hidden sm:block" />

      {/* Animated particles */}
      <div className="absolute left-0 top-0 bottom-0 w-[60px] hidden sm:block overflow-hidden pointer-events-none">
        <div className="pipeline-spine-particle pipeline-spine-particle-1" />
        <div className="pipeline-spine-particle pipeline-spine-particle-2" />
        <div className="pipeline-spine-particle pipeline-spine-particle-3" />
        <div className="pipeline-spine-particle pipeline-spine-particle-4" />
      </div>

      {/* ── DATA INGESTION ── */}
      <LaneDivider label="Data Ingestion" color="bg-neutral-accent/10 text-neutral-accent/70 border-neutral-accent/20" />

      <PipelineStageCard number={1} title="Raw Market Data" subtitle="OHLCV candles, news feeds, economic data, rates" icon={<Database className="h-3.5 w-3.5" />} badge="data" accentColor="blue">
        <p>
          Every signal starts with raw data. The system fetches OHLCV candles from Twelve Data (primary, paid tier)
          with Finnhub and Alpha Vantage as fallbacks, across <strong>4 timeframes — 15M, 1H, 4H, and Daily</strong> for
          all 16 instruments. 1H and 4H feed the signal engine; 15M and Daily add MTF trend alignment context.
        </p>
        <p>
          In parallel (but on a <strong>separate track</strong>), fundamental data streams from 7 sources: news
          sentiment, Fear &amp; Greed, central bank policy, bond yields, economic calendar, COT positioning,
          and ADR. Fundamentals feed the bias engine and AI advisor — they do <strong>not</strong> feed the
          mechanical signal systems directly.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2">
          {["Finnhub", "Twelve Data", "FMP", "Alternative.me"].map((src) => (
            <span key={src} className="text-[9px] font-mono text-neutral-accent/60 bg-neutral-accent/8 px-2 py-1 rounded text-center">{src}</span>
          ))}
        </div>
      </PipelineStageCard>

      <PipelineStageCard number={2} title="Technical Indicators" subtitle="20+ indicators calculated from price data" icon={<BarChart3 className="h-3.5 w-3.5" />} badge="data" accentColor="blue">
        <p>Raw candles are transformed into a full technical summary. Every indicator is computed locally — no external API calls for indicator data.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-2">
          {["EMA (9,13,21,50,200)", "SMA (9,20,26,50,200)", "RSI(14)", "MACD (12,26,9)", "Bollinger Bands", "ATR(14) + Series", "ADX + DI+/DI-", "Stochastic RSI", "Elder-Ray", "Elder Impulse", "Support/Resistance", "Pivot Points"].map((ind) => (
            <span key={ind} className="text-[9px] font-mono text-neutral-accent/60 bg-neutral-accent/8 px-2 py-1 rounded text-center">{ind}</span>
          ))}
        </div>
      </PipelineStageCard>

      {/* ── ANALYSIS ── */}
      <LaneDivider label="Analysis" color="bg-bullish/10 text-bullish/70 border-bullish/20" />

      <PipelineStageCard number={3} title="Multi-Dimensional Regime Engine" subtitle="ATR percentile × BB width × EMA slope × ADX → volatility/structure/phase" icon={<Activity className="h-3.5 w-3.5" />} badge="mechanical" accentColor="green">
        <p>
          Replaces the old ADX-only regime detection with a <strong>3-axis classification</strong>. Four
          independent metrics — ATR percentile (rolling 100-bar), BB width percentile, EMA(21) slope, and ADX
          direction — are combined to classify every instrument on three dimensions:
        </p>
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          {[
            { axis: "Volatility", values: "Low / Normal / High", source: "ATR percentile vs rolling window" },
            { axis: "Structure", values: "Trend / Range / Breakout", source: "ADX + EMA slope + BB width" },
            { axis: "Phase", values: "Accumulation / Expansion / Distribution / Markdown", source: "Wyckoff-inspired: ADX direction + price vs EMA50" },
          ].map((a) => (
            <div key={a.axis} className="bg-bullish/8 border border-bullish/15 rounded-md px-2.5 py-1.5">
              <div className="text-[10px] font-semibold text-bullish/80">{a.axis}</div>
              <div className="text-[9px] font-mono text-foreground/60">{a.values}</div>
              <div className="text-[8px] text-muted-foreground/50 mt-0.5">{a.source}</div>
            </div>
          ))}
        </div>
        <p className="mt-2">
          A backward-compatible <strong>legacy regime</strong> (trending_up/trending_down/ranging/volatile) is
          derived for existing systems. The full regime powers phase-aware conviction scoring, cluster weighting,
          and trading style selection.
        </p>
      </PipelineStageCard>

      <PipelineStageCard number={4} title="Market Structure Analysis" subtitle="HH/HL/LH/LL swing classification + BOS/CHoCH detection" icon={<TrendingUp className="h-3.5 w-3.5" />} badge="mechanical" accentColor="green">
        <p>
          Swing points are identified using a configurable lookback window, then classified as <strong>Higher High
          (HH)</strong>, <strong>Higher Low (HL)</strong>, <strong>Lower High (LH)</strong>, or <strong>Lower Low
          (LL)</strong> based on the prior swing of the same type.
        </p>
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          {[
            { event: "BOS (Break of Structure)", desc: "Price breaks a swing in the existing trend direction — trend continuation confirmed", color: "text-bullish/80" },
            { event: "CHoCH (Change of Character)", desc: "Price breaks a swing against the trend — potential reversal warning", color: "text-bearish/80" },
          ].map((e) => (
            <div key={e.event} className="bg-neutral-accent/8 border border-neutral-accent/15 rounded-md px-2.5 py-1.5">
              <div className={`text-[10px] font-semibold ${e.color}`}>{e.event}</div>
              <div className="text-[9px] text-muted-foreground/50">{e.desc}</div>
            </div>
          ))}
        </div>
        <p className="mt-2">
          A <strong>structure score</strong> (-100 to +100) is computed from the balance of HH/HL vs LH/LL swings.
          This feeds conviction scoring: aligned structure adds +10, opposing structure subtracts -10, and
          a recent CHoCH against the signal direction incurs a -15 penalty.
        </p>
      </PipelineStageCard>

      <PipelineStageCard number={5} title="Trading Style Selection" subtitle="Full regime + session score → intraday vs swing" icon={<Clock className="h-3.5 w-3.5" />} badge="mechanical" accentColor="amber">
        <p>
          Each instrument gets its own trading style based on the <strong>full regime classification</strong> and
          session conditions. The regime phase and structure now drive selection instead of raw ADX alone.
        </p>
        <div className="space-y-1 mt-2">
          {[
            { condition: "Session score < 30", result: "Swing", reason: "Off-hours = low liquidity, wider stops" },
            { condition: "Distribution phase", result: "Intraday", reason: "Reversal risk = shorter exposure" },
            { condition: "Accumulation phase", result: "Swing", reason: "Position for breakout" },
            { condition: "Expansion + trend", result: "Swing", reason: "Ride the move" },
            { condition: "Breakout structure", result: "Intraday", reason: "Capture initial momentum" },
            { condition: "Range structure", result: "Intraday", reason: "Mean reversion plays" },
          ].map((r) => (
            <div key={r.condition} className="flex items-center gap-2 text-[10px]">
              <span className="font-mono text-muted-foreground/60 w-36 shrink-0">{r.condition}</span>
              <span className="text-[8px] font-bold text-foreground/60">&rarr;</span>
              <span className={r.result === "Intraday" ? "text-neutral-accent font-semibold w-14" : "text-muted-foreground font-semibold w-14"}>{r.result}</span>
              <span className="text-muted-foreground/50">{r.reason}</span>
            </div>
          ))}
        </div>
        <p className="mt-2">
          <strong>Intraday</strong>: 1H candles, 1.5 ATR stop, 8h expiry.{" "}
          <strong>Swing</strong>: 4H candles, 2.0 ATR stop, 24h expiry.
        </p>
      </PipelineStageCard>

      {/* ── SIGNAL GENERATION ── */}
      <LaneDivider label="Signal Generation" color="bg-bullish/10 text-bullish/70 border-bullish/20" />

      <PipelineStageCard number={6} title="8 Mechanical Signal Systems" subtitle="Book-sourced strategies with dynamic system weights" icon={<Cog className="h-3.5 w-3.5" />} badge="mechanical" accentColor="green">
        <p>
          Eight independent systems — each sourced from proven trading books — analyze the indicators and
          produce a direction (<strong>bullish</strong>, <strong>bearish</strong>, or <strong>neutral</strong>),
          a strength score (0-100), and whether they match the current market regime.
        </p>
        <p>
          Systems are grouped into three <strong>de-correlation clusters</strong> — Trend (MA Crossover, MACD,
          BB Breakout, Trend Stack), Mean Reversion (RSI Extremes, BB MR), and Momentum (Elder Impulse, Elder-Ray).
          Signals that don&apos;t match the regime get their strength reduced by 40%.
        </p>
        <p>
          <strong>Auto-kill weak systems:</strong> Each system&apos;s historical win rate is tracked. Systems
          below 30% win rate (after 10+ trades) are disabled. Systems below 40% get a strength penalty.
          Systems above 60% get a bonus. Weights adapt automatically over a 30-trade rolling window.
        </p>
        <p className="text-bullish/70 font-semibold">
          100% rule-based. Zero AI. Pure math from indicator values.
        </p>
      </PipelineStageCard>

      <PipelineStageCard number={7} title="Signal De-correlation" subtitle="Cluster-weighted agreement prevents fake confluence" icon={<Fingerprint className="h-3.5 w-3.5" />} badge="mechanical" accentColor="green">
        <p>
          Raw signal agreement (5/8 bullish) can overcount because many systems derive from the same OHLCV data.
          The de-correlation engine groups signals into <strong>3 clusters</strong> and picks only the best
          signal per cluster. Each cluster is weighted by the current regime structure:
        </p>
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          {[
            { regime: "Trend", trend: "0.45", mr: "0.15", mom: "0.40" },
            { regime: "Range", trend: "0.15", mr: "0.45", mom: "0.40" },
            { regime: "Breakout", trend: "0.35", mr: "0.10", mom: "0.55" },
          ].map((r) => (
            <div key={r.regime} className="bg-neutral-accent/8 border border-neutral-accent/15 rounded-md px-2.5 py-1.5 text-center">
              <div className="text-[10px] font-semibold text-neutral-accent/80">{r.regime}</div>
              <div className="text-[8px] font-mono text-muted-foreground/50">T:{r.trend} MR:{r.mr} M:{r.mom}</div>
            </div>
          ))}
        </div>
        <p className="mt-2">
          The weighted cluster score (0-40 pts) replaces the old raw agreement count in conviction scoring.
          This prevents 4 correlated trend signals from inflating conviction the same way 4 independent
          signals would.
        </p>
      </PipelineStageCard>

      <PipelineStageCard number={8} title="MTF Trend Alignment" subtitle="Daily/4H/1H/15M EMA stack → alignment score" icon={<TrendingUp className="h-3.5 w-3.5" />} badge="mechanical" accentColor="green">
        <p>
          The EMA stack (EMA 9/21/50 + SMA 200) is computed on <strong>all 4 timeframes</strong>. Bullish stack:
          EMA9 &gt; EMA21 &gt; EMA50 &gt; SMA200. Bearish: reversed. Otherwise: mixed.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2">
          {[
            { label: "Full (4/4)", mod: "+10", color: "bg-bullish/10 border-bullish/20 text-bullish" },
            { label: "Strong (3/4)", mod: "+5", color: "bg-bullish/8 border-bullish/15 text-bullish/70" },
            { label: "Partial (2/4)", mod: "0", color: "bg-muted/10 border-border/20 text-muted-foreground/60" },
            { label: "Against (<2)", mod: "-10", color: "bg-bearish/8 border-bearish/15 text-bearish/70" },
          ].map((a) => (
            <div key={a.label} className={`rounded-md px-2.5 py-1.5 text-center border ${a.color}`}>
              <div className="text-[10px] font-semibold">{a.label}</div>
              <div className="text-[9px] font-mono opacity-70">{a.mod} pts</div>
            </div>
          ))}
        </div>
      </PipelineStageCard>

      <PipelineStageCard number={9} title="Conviction Scoring" subtitle="De-correlated agreement + regime + phase + structure + impulse → A+ to D" icon={<Target className="h-3.5 w-3.5" />} badge="mechanical" accentColor="green">
        <p>A conviction score (0-100) is calculated from <strong>eight factors</strong>:</p>
        <div className="space-y-1 mt-2">
          {[
            { label: "Cluster Agreement", range: "0-40 pts", width: "40%", color: "bg-neutral-accent/40" },
            { label: "Regime Match", range: "0-25 pts", width: "25%", color: "bg-bullish/40" },
            { label: "Impulse Alignment", range: "-15 to +20", width: "35%", color: "bg-amber-500/40" },
            { label: "Strong Signal Bonus", range: "0-15 pts", width: "15%", color: "bg-foreground/20" },
            { label: "Phase Scoring", range: "-15 to +10", width: "25%", color: "bg-bullish/30" },
            { label: "Structure Alignment", range: "-15 to +10", width: "25%", color: "bg-neutral-accent/30" },
            { label: "Exhaustion Penalty", range: "-10 pts", width: "10%", color: "bg-bearish/40" },
            { label: "MTF Alignment", range: "-10 to +10", width: "20%", color: "bg-neutral-accent/40" },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-2">
              <span className="w-28 text-[9px] font-bold text-muted-foreground/60 uppercase shrink-0">{f.label}</span>
              <div className="flex-1 h-3 bg-surface-2/30 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${f.color}`} style={{ width: f.width }} />
              </div>
              <span className="text-[9px] font-mono text-muted-foreground/60 w-16 text-right shrink-0">{f.range}</span>
            </div>
          ))}
        </div>
        <p className="mt-2">
          <strong>Phase scoring</strong>: Distribution/markdown against bullish = -15, accumulation against bearish = -10,
          expansion aligned = +10. <strong>Structure</strong>: HH/HL aligned = +10, CHoCH against = -15, BOS aligned = +5.
        </p>
        <p>
          <strong>Tiers:</strong> A+ (&ge;75, 5+ signals) &rarr; A (&ge;60, 4+) &rarr; B (&ge;40, 3+) &rarr; C (&ge;25, 2+) &rarr; D (&lt;25)
        </p>
      </PipelineStageCard>

      {/* ── EXECUTION ── */}
      <LaneDivider label="Execution" color="bg-bearish/10 text-bearish/70 border-bearish/20" />

      <PipelineStageCard number={10} title="Hard Filters" subtitle="Quality gates that reject weak setups" icon={<ShieldAlert className="h-3.5 w-3.5" />} badge="filter" accentColor="red">
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

      <PipelineStageCard number={11} title="Entry Optimization" subtitle="Candle patterns + pullback detection refine entry timing" icon={<Crosshair className="h-3.5 w-3.5" />} badge="mechanical" accentColor="green">
        <p>
          After structural level snapping, the entry zone is refined using <strong>candle pattern recognition</strong>
          and <strong>pullback detection</strong>. The system scans the most recent candles for:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-2">
          {[
            { name: "Hammer / Shooting Star", desc: "Reversal candle with long wick" },
            { name: "Engulfing", desc: "Current body engulfs previous (1.2x min)" },
            { name: "Pin Bar", desc: "Tiny body (<20%), dominant wick (>60%)" },
            { name: "Inside Bar", desc: "Range compression = breakout anticipation" },
            { name: "Pullback to EMA(21)", desc: "30-70% retracement to key MA" },
            { name: "Refined Entry Zone", desc: "Tightened when pattern quality > 60" },
          ].map((p) => (
            <div key={p.name} className="bg-bullish/8 border border-bullish/15 rounded-md px-2.5 py-1.5">
              <div className="text-[10px] font-semibold text-bullish/80">{p.name}</div>
              <div className="text-[9px] text-muted-foreground/50">{p.desc}</div>
            </div>
          ))}
        </div>
        <p className="mt-2">
          When a high-quality pattern is detected, the entry zone is tightened to the candle&apos;s
          key levels, giving better fills and improving the effective risk-reward ratio.
        </p>
      </PipelineStageCard>

      <PipelineStageCard number={12} title="Structural Level Snapping + Position Sizing" subtitle="S/R snap → conviction-scaled risk per trade" icon={<Scale className="h-3.5 w-3.5" />} badge="data" accentColor="blue">
        <p>
          Raw ATR-based levels are &ldquo;snapped&rdquo; to the nearest structural support/resistance zones
          (Fractal S/R, Pivot Points, Fibonacci). Position size scales by conviction tier:
        </p>
        <div className="flex gap-3 mt-2">
          {[
            { tier: "A+", mult: "1.25x", risk: "2.5%", color: "text-bullish" },
            { tier: "A", mult: "1.0x", risk: "2.0%", color: "text-bullish/70" },
          ].map((t) => (
            <div key={t.tier} className="flex-1 bg-bullish/8 border border-bullish/15 rounded-md px-3 py-2 text-center">
              <div className={`text-lg font-black ${t.color}`}>{t.tier}</div>
              <div className="text-[9px] text-muted-foreground/60">{t.mult} base &rarr; {t.risk} risk</div>
            </div>
          ))}
        </div>
      </PipelineStageCard>

      <PipelineStageCard number={13} title="Portfolio Risk Gate" subtitle="Currency exposure caps, correlation blocking, drawdown throttle" icon={<ShieldCheck className="h-3.5 w-3.5" />} badge="filter" accentColor="red">
        <p>
          Before any setup reaches the desk, a <strong>portfolio-level risk gate</strong> evaluates
          whether it can be opened given current exposure:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
          {[
            { check: "Total portfolio risk < 6%", desc: "Sum of all open position risk amounts vs equity" },
            { check: "Currency exposure < 4% per currency", desc: "Both base and quote currency caps enforced" },
            { check: "Max 2 correlated positions", desc: "EUR/GBP, AUD/NZD, US indices, crypto groups" },
            { check: "Drawdown throttle", desc: "2 consecutive losses → 75% size, 3 → 50%, 4+ → 25%" },
          ].map((c) => (
            <div key={c.check} className="bg-bearish/8 border border-bearish/15 rounded-md px-2.5 py-1.5">
              <div className="text-[10px] font-semibold text-bearish/80">{c.check}</div>
              <div className="text-[9px] text-muted-foreground/50">{c.desc}</div>
            </div>
          ))}
        </div>
        <p className="mt-2">
          Blocked setups are capped to D-tier conviction (filtered out). The drawdown throttle
          automatically reduces position sizes during losing streaks.
        </p>
      </PipelineStageCard>

      <PipelineStageCard number={14} title="AI Trade Advisor" subtitle="LLM narrates and contextualizes the top setups" icon={<Sparkles className="h-3.5 w-3.5" />} badge="ai" accentColor="amber">
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

      <PipelineStageCard number={15} title="Expectancy-Based Learning" subtitle="R-multiple tracking, time decay, Kelly sizing — outcomes improve future scoring" icon={<RefreshCw className="h-3.5 w-3.5" />} badge="mechanical" accentColor="green">
        <p>
          Every trade is tracked through its lifecycle. Outcomes are stored with confluence pattern keys
          (signal names + regime + impulse + style), plus <strong>instrument-specific</strong> and{" "}
          <strong>regime-specific</strong> keys for granular learning.
        </p>
        <div className="space-y-1.5 mt-2">
          {[
            { step: "1", label: "R-Multiple recorded", desc: "P&L converted to R-multiples (risk units) for normalization" },
            { step: "2", label: "Time-decayed win rate", desc: "30-day half-life exponential decay — recent trades matter more" },
            { step: "3", label: "Expectancy computed", desc: "EV = (decayedWinRate × avgWinR) - ((1-decayedWinRate) × avgLossR)" },
            { step: "4", label: "Kelly fraction capped", desc: "Position sizing suggestion capped at 25% of Kelly criterion" },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-2">
              <span className="h-5 w-5 rounded-full bg-bullish/15 text-bullish text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{s.step}</span>
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
            Learning kicks in after 10 completed trades. EV &gt; 1.0R &rarr; 1.5x risk, EV 0.5-1.0R &rarr; 1.25x, EV &lt; 0 &rarr; 0.5x.
            Falls back to win-rate multipliers when expectancy data is insufficient.
          </p>
        </div>
      </PipelineStageCard>
    </div>
  );
}

/* ── Main Component ── */
export function SystemPipelineFlow() {
  const [view, setView] = useState<"detailed" | "overview">("detailed");

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6 }}
    >
      {/* Header with toggle */}
      <div className="flex items-center justify-between mb-8">
        <div className="text-center flex-1">
          <h2 className="text-lg font-semibold text-foreground">15-Stage Pipeline</h2>
          <p className="text-xs text-muted-foreground/60 mt-1">
            From raw market data to trade execution
          </p>
        </div>
        <div className="flex items-center gap-1 glass-card rounded-lg p-1 shrink-0">
          <button
            onClick={() => setView("detailed")}
            className={cn(
              "flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-md transition-colors",
              view === "detailed" ? "bg-neutral-accent/15 text-neutral-accent" : "text-muted-foreground/50 hover:text-muted-foreground"
            )}
          >
            <LayoutList className="h-3 w-3" /> Detailed
          </button>
          <button
            onClick={() => setView("overview")}
            className={cn(
              "flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-md transition-colors",
              view === "overview" ? "bg-neutral-accent/15 text-neutral-accent" : "text-muted-foreground/50 hover:text-muted-foreground"
            )}
          >
            <LayoutGrid className="h-3 w-3" /> Overview
          </button>
        </div>
      </div>

      {view === "detailed" ? <DetailedView /> : <OverviewGrid />}
    </motion.div>
  );
}
