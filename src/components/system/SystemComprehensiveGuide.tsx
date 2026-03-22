"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Reusable accordion subsection ── */
function GuideSection({
  number,
  title,
  children,
  defaultExpanded = false,
}: {
  number: number;
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className="border-b border-border/20 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full py-3 flex items-center gap-3 hover:bg-surface-2/30 transition-colors text-left px-1"
      >
        <span className="text-[9px] font-mono text-neutral-accent/50 w-5 shrink-0 text-center">
          {number}
        </span>
        <span className="flex-1 text-[11px] font-semibold text-foreground">{title}</span>
        {expanded ? (
          <ChevronUp className="h-3 w-3 text-muted-foreground/40 shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground/40 shrink-0" />
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-1 pb-4 text-xs text-muted-foreground leading-relaxed space-y-3">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Styled table row ── */
function TRow({ cells, header = false }: { cells: string[]; header?: boolean }) {
  return (
    <div className={cn("grid gap-px", header && "border-b border-border/30 pb-1 mb-1")} style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
      {cells.map((cell, i) => (
        <span key={i} className={cn("text-[9px] px-2 py-1", header ? "font-bold text-foreground/70 uppercase tracking-wider" : "text-muted-foreground/70 font-mono")}>
          {cell}
        </span>
      ))}
    </div>
  );
}

/* ── Info pill ── */
function Pill({ children, color = "blue" }: { children: ReactNode; color?: "blue" | "green" | "amber" | "red" }) {
  const colors = {
    blue: "bg-neutral-accent/10 text-neutral-accent/70 border-neutral-accent/20",
    green: "bg-bullish/10 text-bullish/70 border-bullish/20",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-500/70 border-amber-500/20",
    red: "bg-bearish/10 text-bearish/70 border-bearish/20",
  };
  return (
    <span className={cn("text-[9px] font-mono px-2 py-0.5 rounded border inline-block", colors[color])}>
      {children}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                               */
/* ══════════════════════════════════════════════════════════════ */

export function SystemComprehensiveGuide() {
  return (
    <div className="space-y-0">
      {/* ── 1. SYSTEM IDENTITY ── */}
      <GuideSection number={1} title="System Identity" defaultExpanded>
        <p>
          A <strong className="text-foreground">deterministic 15-stage trading pipeline</strong> that generates, filters, and manages trades
          across 16 forex/crypto/index instruments on 4 timeframes (15M, 1H, 4H, Daily). All signal generation is 100% mechanical and rule-based.
        </p>
        <p>
          AI (LLM) serves as a <strong className="text-foreground">narrator and advisor layer</strong> — it NEVER generates or modifies trades.
          The system processes: raw OHLCV data → 20+ indicators → regime classification → 8 mechanical signals → de-correlation →
          conviction scoring → hard filters → structural level snapping → position sizing → portfolio risk gate → AI narration → learning feedback.
        </p>
      </GuideSection>

      {/* ── 2. DATA SOURCES ── */}
      <GuideSection number={2} title="Data Sources (Stage 1)">
        <h4 className="text-[10px] font-bold text-foreground/70 uppercase tracking-wider">Market Data</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
          {[
            { src: "Twelve Data", role: "Primary — OHLCV candles across 4 TFs", tier: "Paid" },
            { src: "Finnhub", role: "Fallback candles + news headlines + sentiment", tier: "Free" },
            { src: "Alpha Vantage", role: "Secondary fallback for price data", tier: "Free" },
          ].map((s) => (
            <div key={s.src} className="bg-neutral-accent/8 border border-neutral-accent/15 rounded-md px-2.5 py-1.5">
              <div className="text-[10px] font-semibold text-neutral-accent/80">{s.src}</div>
              <div className="text-[9px] text-muted-foreground/50">{s.role}</div>
            </div>
          ))}
        </div>
        <p className="text-[10px]">
          <strong className="text-foreground">Timeframes:</strong> 1H + 4H → signal engine. 15M + Daily → MTF trend alignment context only.
        </p>

        <h4 className="text-[10px] font-bold text-foreground/70 uppercase tracking-wider mt-2">Fundamental Data (Parallel Track — Separate From Signals)</h4>
        <div className="bg-surface-2/30 rounded-md overflow-hidden">
          <TRow cells={["Source", "Data", "API"]} header />
          <TRow cells={["Finnhub", "News headlines + sentiment", "REST"]} />
          <TRow cells={["Alternative.me", "Fear & Greed Index", "REST"]} />
          <TRow cells={["FMP", "Central bank policy, bond yields, COT", "REST"]} />
          <TRow cells={["FMP", "Economic calendar (CPI, GDP, NFP)", "REST"]} />
        </div>
        <p className="text-[10px]">
          Fundamentals feed the <strong className="text-foreground">bias engine</strong> and <strong className="text-foreground">AI advisor</strong> —
          they do NOT feed the mechanical signal systems directly.
        </p>
      </GuideSection>

      {/* ── 3. TECHNICAL INDICATORS ── */}
      <GuideSection number={3} title="Technical Indicators (Stage 2)">
        <p>Computed <strong className="text-foreground">locally</strong> from raw candles (no external indicator APIs):</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {[
            "EMA (9, 13, 21, 50)",
            "SMA (9, 20, 26, 50, 200)",
            "RSI (14)",
            "MACD (12, 26, 9)",
            "Bollinger Bands (20, 2)",
            "ATR (14)",
            "ADX + DI+/DI-",
            "Stochastic RSI",
            "Elder-Ray (Bull/Bear)",
            "Elder Impulse (G/R/B)",
            "Pivot Points (D+W)",
            "S/R (fractal-based)",
            "Fibonacci levels",
            "VWAP",
            "Force Index",
          ].map((ind) => (
            <span key={ind} className="text-[9px] font-mono text-neutral-accent/60 bg-neutral-accent/8 px-2 py-1 rounded text-center">{ind}</span>
          ))}
        </div>
        <p className="text-[10px]">
          Output: <code className="text-[9px] bg-surface-2/40 px-1 rounded">TechnicalSummary</code> object per instrument per timeframe.
        </p>
      </GuideSection>

      {/* ── 4. REGIME ENGINE ── */}
      <GuideSection number={4} title="Multi-Dimensional Regime Engine (Stage 3)">
        <p>Classifies the market on <strong className="text-foreground">3 independent axes</strong>:</p>
        <div className="bg-surface-2/30 rounded-md overflow-hidden">
          <TRow cells={["Axis", "Method", "Values"]} header />
          <TRow cells={["Volatility", "ATR percentile vs 100-bar window", "low (<25th), normal, high (>75th)"]} />
          <TRow cells={["Structure", "ADX + EMA slope + BB width", "trend, range, breakout"]} />
          <TRow cells={["Phase (Wyckoff)", "ADX direction + price vs EMA50", "accumulation, expansion, distribution, reversal"]} />
        </div>
        <p className="text-[10px]">
          Also computes a <strong className="text-foreground">legacy regime</strong> for backward compatibility:
          <Pill>trending_up</Pill> <Pill>trending_down</Pill> <Pill>ranging</Pill> <Pill>volatile</Pill>
        </p>
        <p className="text-[10px]">
          The regime feeds into: trading style selection, signal weighting, cluster weights, conviction scoring, and learning system tracking.
        </p>
      </GuideSection>

      {/* ── 5. MARKET STRUCTURE ── */}
      <GuideSection number={5} title="Market Structure Analysis (Stage 4 — Runs BEFORE Signals)">
        <p>Detects swing structure from raw candle fractals:</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {[
            { label: "HH", desc: "Higher High", color: "text-bullish" },
            { label: "HL", desc: "Higher Low", color: "text-bullish" },
            { label: "LH", desc: "Lower High", color: "text-bearish" },
            { label: "LL", desc: "Lower Low", color: "text-bearish" },
          ].map((s) => (
            <div key={s.label} className="bg-surface-2/30 border border-border/20 rounded-md px-2.5 py-1.5 text-center">
              <div className={cn("text-sm font-black", s.color)}>{s.label}</div>
              <div className="text-[8px] text-muted-foreground/50">{s.desc}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5 mt-1">
          <div className="bg-bullish/8 border border-bullish/15 rounded-md px-2.5 py-1.5">
            <div className="text-[10px] font-semibold text-bullish/80">BOS (Break of Structure)</div>
            <div className="text-[9px] text-muted-foreground/50">Price breaks swing in trend direction — continuation confirmed</div>
          </div>
          <div className="bg-bearish/8 border border-bearish/15 rounded-md px-2.5 py-1.5">
            <div className="text-[10px] font-semibold text-bearish/80">CHoCH (Change of Character)</div>
            <div className="text-[9px] text-muted-foreground/50">Price breaks swing against trend — potential reversal</div>
          </div>
        </div>
        <div className="bg-amber-500/8 border border-amber-500/15 rounded-md px-3 py-2 mt-1">
          <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-500/80 mb-1">ICT Concepts</div>
          <div className="grid grid-cols-2 gap-1">
            {[
              "Fair Value Gaps — 3-candle imbalances, min 0.3x ATR",
              "Order Blocks — last opposing candle before 2x ATR displacement",
              "Institutional Candles — body > 2x ATR displacement moves",
              "Consolidation Breakouts — tight range (<1.5x ATR, 5+ bars)",
            ].map((c) => (
              <span key={c} className="text-[8px] text-muted-foreground/60">{c}</span>
            ))}
          </div>
        </div>
        <p className="text-[10px]">
          <strong className="text-foreground">Structure Direction Gate:</strong> If structure is bullish, ALL bearish signals are excluded
          before scoring. If bearish, ALL bullish signals excluded. Neutral structure allows both.
        </p>
      </GuideSection>

      {/* ── 6. TRADING STYLE ── */}
      <GuideSection number={6} title="Trading Style Selection (Stage 5)">
        <div className="bg-surface-2/30 rounded-md overflow-hidden">
          <TRow cells={["Condition", "Style", "SL", "Expiry"]} header />
          <TRow cells={["Off-hours (session < 30)", "Swing", "2.0x ATR", "24h"]} />
          <TRow cells={["Distribution phase", "Intraday", "1.5x ATR", "8h"]} />
          <TRow cells={["Accumulation", "Swing", "2.0x ATR", "24h"]} />
          <TRow cells={["Expansion + trend", "Swing", "2.0x ATR", "24h"]} />
          <TRow cells={["Reversal + high vol", "Intraday", "1.5x ATR", "8h"]} />
          <TRow cells={["Breakout structure", "Intraday", "1.5x ATR", "8h"]} />
          <TRow cells={["Range structure", "Intraday", "1.5x ATR", "8h"]} />
        </div>
      </GuideSection>

      {/* ── 7. 8 MECHANICAL SIGNAL SYSTEMS ── */}
      <GuideSection number={7} title="8 Mechanical Signal Systems (Stage 6)">
        <p>
          All 100% rule-based. Each returns: <code className="text-[9px] bg-surface-2/40 px-1 rounded">
          {"{system, type, direction, strength(0-100), regimeMatch}"}
          </code>
        </p>

        <h4 className="text-[10px] font-bold text-bullish/70 uppercase tracking-wider mt-2">Trend Cluster</h4>
        <div className="space-y-1.5">
          {[
            { num: "1", name: "MA Crossover", source: "Weissman", desc: "SMA(9) vs SMA(26) crossover. Strength 85 on fresh cross, 40-70 on separation." },
            { num: "2", name: "MACD", source: "Weissman", desc: "EMA(12)-EMA(26) histogram + signal crossover. Strength 85 on crossover, 35-65 on histogram." },
            { num: "3", name: "BB Breakout", source: "Bollinger", desc: "Price breaks above/below Bollinger Bands. Strength 80 on breakout, 55 near extremes." },
            { num: "4", name: "Trend Stack", source: "Custom", desc: "EMA(9) > EMA(21) > EMA(50) > SMA(200) alignment. Full stack = 90, partial (3 EMAs) = 60." },
          ].map((s) => (
            <div key={s.num} className="flex gap-2 items-start">
              <span className="h-5 w-5 rounded-full bg-bullish/15 text-bullish text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{s.num}</span>
              <div>
                <span className="text-[10px] font-semibold text-foreground">{s.name}</span>
                <span className="text-[9px] text-muted-foreground/50 ml-1">({s.source})</span>
                <p className="text-[9px] text-muted-foreground/60">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <h4 className="text-[10px] font-bold text-amber-600 dark:text-amber-500/70 uppercase tracking-wider mt-3">Mean Reversion Cluster</h4>
        <div className="space-y-1.5">
          {[
            { num: "5", name: "RSI Extremes", source: "Williams", desc: "RSI(14) < 30 (oversold) + above SMA(200) = buy (80). RSI > 70 + below SMA(200) = sell (80). Without SMA filter = weaker (50)." },
            { num: "6", name: "BB Mean Reversion", source: "Bollinger", desc: "Price below lower BB + above SMA(200) = buy (80). Above upper BB + below SMA(200) = sell (80)." },
          ].map((s) => (
            <div key={s.num} className="flex gap-2 items-start">
              <span className="h-5 w-5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-500/70 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{s.num}</span>
              <div>
                <span className="text-[10px] font-semibold text-foreground">{s.name}</span>
                <span className="text-[9px] text-muted-foreground/50 ml-1">({s.source})</span>
                <p className="text-[9px] text-muted-foreground/60">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <h4 className="text-[10px] font-bold text-neutral-accent/70 uppercase tracking-wider mt-3">Momentum Cluster</h4>
        <div className="space-y-1.5">
          {[
            { num: "7", name: "Elder Impulse", source: "Elder", desc: "EMA(13) slope + MACD histogram slope → GREEN (bullish, shorts prohibited) / RED (bearish, longs prohibited) / BLUE (mixed). Hard gate: NEVER long on RED, NEVER short on GREEN." },
            { num: "8", name: "Elder-Ray", source: "Elder", desc: "Bull Power = High - EMA(13), Bear Power = Low - EMA(13). EMA rising + Bear Power negative = buy (70). EMA falling + Bull Power positive = sell (70)." },
          ].map((s) => (
            <div key={s.num} className="flex gap-2 items-start">
              <span className="h-5 w-5 rounded-full bg-neutral-accent/15 text-neutral-accent text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{s.num}</span>
              <div>
                <span className="text-[10px] font-semibold text-foreground">{s.name}</span>
                <span className="text-[9px] text-muted-foreground/50 ml-1">({s.source})</span>
                <p className="text-[9px] text-muted-foreground/60">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-bearish/8 border border-bearish/15 rounded-md px-3 py-2 mt-3">
          <div className="text-[10px] font-semibold text-bearish/80">Hard Regime Exclusion</div>
          <p className="text-[9px] text-muted-foreground/50">
            Trend signals in non-trending markets → excluded entirely (strength=0, direction=neutral).
            Mean reversion signals in trending markets → excluded entirely.
            Momentum signals → allowed in all regimes.
          </p>
        </div>
      </GuideSection>

      {/* ── 8. SIGNAL DE-CORRELATION ── */}
      <GuideSection number={8} title="Signal De-Correlation (Stage 7)">
        <p>
          Prevents correlated indicators from inflating conviction. Only the <strong className="text-foreground">strongest signal per cluster</strong> contributes.
          Each cluster is weighted by the current regime structure:
        </p>
        <div className="bg-surface-2/30 rounded-md overflow-hidden">
          <TRow cells={["Regime", "Trend Weight", "MR Weight", "Momentum Weight"]} header />
          <TRow cells={["Trend", "45%", "15%", "40%"]} />
          <TRow cells={["Range", "15%", "45%", "40%"]} />
          <TRow cells={["Breakout", "35%", "10%", "55%"]} />
        </div>
        <p className="text-[10px] mt-1">
          Output: de-correlated agreement score (0-40 pts) + <code className="text-[9px] bg-surface-2/40 px-1 rounded">activeClusters</code> count (0-3).
          The <code className="text-[9px] bg-surface-2/40 px-1 rounded">activeClusters</code> count replaces raw signal count in tier thresholds.
        </p>
      </GuideSection>

      {/* ── 9. MTF TREND ALIGNMENT ── */}
      <GuideSection number={9} title="MTF Trend Alignment (Stage 8)">
        <p>
          EMA stack (9/21/50/SMA200) computed on each timeframe. Higher TFs weighted more heavily:
        </p>
        <div className="bg-surface-2/30 rounded-md overflow-hidden">
          <TRow cells={["Timeframe", "Weight", "Purpose"]} header />
          <TRow cells={["1H", "20%", "Immediate momentum"]} />
          <TRow cells={["4H", "30%", "Intermediate trend"]} />
          <TRow cells={["Daily", "50%", "Primary trend direction"]} />
        </div>
        <div className="space-y-1 mt-2">
          <p className="text-[10px]"><strong className="text-foreground">EMA slope quality:</strong> Strong slope = 1.2x weight boost, weak slope = 0.8x penalty.</p>
          <p className="text-[10px]"><strong className="text-foreground">Overextension detection:</strong> Price &gt; 2.5 ATR from EMA50 → reduces confidence even if aligned.</p>
          <p className="text-[10px]"><strong className="text-foreground">Pullback completion:</strong> Lower TF flips back to daily direction after pullback.</p>
        </div>
        <div className="grid grid-cols-4 gap-1.5 mt-2">
          {[
            { label: "Full (4/4)", mod: "1.15x", color: "bg-bullish/10 border-bullish/20 text-bullish" },
            { label: "Strong (3/4)", mod: "1.0x", color: "bg-bullish/8 border-bullish/15 text-bullish/70" },
            { label: "Partial (2/4)", mod: "0.85x", color: "bg-surface-2/30 border-border/20 text-muted-foreground/60" },
            { label: "Conflicting", mod: "0.85x", color: "bg-bearish/8 border-bearish/15 text-bearish/70" },
          ].map((a) => (
            <div key={a.label} className={cn("rounded-md px-2 py-1.5 text-center border", a.color)}>
              <div className="text-[10px] font-semibold">{a.label}</div>
              <div className="text-[8px] font-mono opacity-70">{a.mod}</div>
            </div>
          ))}
        </div>
      </GuideSection>

      {/* ── 10. CONVICTION SCORING ── */}
      <GuideSection number={10} title="Conviction Scoring (Stage 9)">
        <p>Score 0-100 from <strong className="text-foreground">9 independent factors</strong>:</p>
        <div className="bg-surface-2/30 rounded-md overflow-hidden">
          <TRow cells={["Factor", "Points", "Source"]} header />
          <TRow cells={["Cluster agreement", "0-40", "De-correlated signal strength x regime weights"]} />
          <TRow cells={["Regime match", "0-25", "Count of regime-matching signals"]} />
          <TRow cells={["Impulse alignment", "-15 to +20", "Elder Impulse color vs trade direction"]} />
          <TRow cells={["Strong signal bonus", "0-15", "+5 per signal with strength >= 70"]} />
          <TRow cells={["Phase context", "-15 to +10", "Distribution/reversal vs bullish = -15"]} />
          <TRow cells={["Structure alignment", "-15 to +10", "HH/HL aligned = +10, CHoCH against = -15"]} />
          <TRow cells={["Volatility exhaustion", "-10", "High vol + ADX falling"]} />
          <TRow cells={["MTF alignment", "-10 to +10", "Weighted TF bias"]} />
          <TRow cells={["ICT confluence", "0-10", "Fresh FVG(5) + OB(3) + Displacement(2)"]} />
        </div>

        <h4 className="text-[10px] font-bold text-foreground/70 uppercase tracking-wider mt-3">Tier Mapping (Cluster-Based Thresholds)</h4>
        <div className="bg-surface-2/30 rounded-md overflow-hidden">
          <TRow cells={["Tier", "Score", "Clusters Required", "Meaning"]} header />
          <TRow cells={["A+", ">= 75", "3 (all families agree)", "Maximum conviction"]} />
          <TRow cells={["A", ">= 60", "2+", "High conviction"]} />
          <TRow cells={["B", ">= 40", "2+", "Medium (filtered out)"]} />
          <TRow cells={["C", ">= 25", "1+", "Low (filtered out)"]} />
          <TRow cells={["D", "< 25", "--", "Rejected"]} />
        </div>
      </GuideSection>

      {/* ── 11. HARD FILTERS ── */}
      <GuideSection number={11} title="Hard Filters (Stage 10)">
        <p>Only setups that pass <strong className="text-foreground">ALL</strong> gates continue:</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {[
            { rule: "Conviction = A+ or A only", desc: "B, C, D are rejected (Bellafiore quality filter)" },
            { rule: "Elder Impulse hard gate", desc: "NEVER long on RED, NEVER short on GREEN" },
            { rule: "R:R >= 1.5 on TP1", desc: "No edge below this minimum risk-reward" },
            { rule: "Non-neutral direction", desc: "Must have clear bullish or bearish bias" },
          ].map((f) => (
            <div key={f.rule} className="bg-bearish/8 border border-bearish/15 rounded-md px-2.5 py-1.5">
              <div className="text-[10px] font-semibold text-bearish/80">{f.rule}</div>
              <div className="text-[9px] text-muted-foreground/50">{f.desc}</div>
            </div>
          ))}
        </div>
      </GuideSection>

      {/* ── 12. ENTRY OPT + LEVEL SNAPPING ── */}
      <GuideSection number={12} title="Entry Optimization + Structural Level Snapping (Stages 11-12)">
        <h4 className="text-[10px] font-bold text-foreground/70 uppercase tracking-wider">Entry Optimization</h4>
        <p>Refines the ATR-based entry zone using candle patterns:</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {["Hammer / Shooting Star", "Engulfing", "Pin Bar", "Inside Bar", "Pullback to EMA(21)", "FVG Re-entry", "OB Retest"].map((p) => (
            <span key={p} className="text-[9px] font-mono text-bullish/60 bg-bullish/8 px-2 py-1 rounded text-center">{p}</span>
          ))}
        </div>
        <p className="text-[10px] mt-1">Pattern quality &gt; 60% → tightens entry to exact pattern level.</p>

        <h4 className="text-[10px] font-bold text-foreground/70 uppercase tracking-wider mt-3">Level Snapping</h4>
        <p>ATR-based levels are snapped to the nearest strong structural level:</p>
        <div className="bg-surface-2/30 rounded-md overflow-hidden">
          <TRow cells={["Level Type", "Used For"]} header />
          <TRow cells={["S/R zones (fractal-based)", "SL, TP"]} />
          <TRow cells={["Pivot Points (daily + weekly)", "SL, TP, Entry"]} />
          <TRow cells={["Fibonacci (0.236, 0.382, 0.5, 0.618, 0.786)", "TP"]} />
          <TRow cells={["FVG midpoints (Consequent Encroachment)", "Entry, SL"]} />
        </div>
        <p className="text-[10px] mt-1">
          SL placed 0.3x ATR past the structural level. Each TP must achieve minimum R:R (1.5, 2.0, 2.5).
        </p>
      </GuideSection>

      {/* ── 13. POSITION SIZING ── */}
      <GuideSection number={13} title="Position Sizing">
        <p>Conviction-scaled risk (Hougaard method):</p>
        <div className="bg-surface-2/30 rounded-md overflow-hidden">
          <TRow cells={["Tier", "Risk Multiplier", "Effective Risk (at 2% base)"]} header />
          <TRow cells={["A+", "1.25x", "2.5%"]} />
          <TRow cells={["A", "1.0x", "2.0%"]} />
        </div>
      </GuideSection>

      {/* ── 14. PORTFOLIO RISK GATE ── */}
      <GuideSection number={14} title="Portfolio Risk Gate (Stage 13)">
        <div className="bg-surface-2/30 rounded-md overflow-hidden">
          <TRow cells={["Constraint", "Default", "Logic"]} header />
          <TRow cells={["Max open positions", "5", "Block if exceeded"]} />
          <TRow cells={["Max currency exposure", "3 per currency", "Count positions using each currency"]} />
          <TRow cells={["Correlated pair limit", "2", "EUR/GBP, AUD/NZD, US indices, BTC/ETH"]} />
          <TRow cells={["Max total portfolio risk", "10%", "Sum of all position risk% must not exceed"]} />
          <TRow cells={["Drawdown throttle", "Dynamic", "2 losses=75%, 3=50%, 4+=25% size"]} />
        </div>
      </GuideSection>

      {/* ── 15. AI INTEGRATION ── */}
      <GuideSection number={15} title="AI Integration — Models and Roles (Stages 14-15)">
        <h4 className="text-[10px] font-bold text-foreground/70 uppercase tracking-wider">Model Selection Matrix</h4>
        <div className="bg-surface-2/30 rounded-md overflow-hidden">
          <TRow cells={["Function", "Model", "Provider", "Max Tokens", "Cache"]} header />
          <TRow cells={["Trade Advisor (desk briefing)", "Claude Opus 4.6", "Anthropic", "2048", "None"]} />
          <TRow cells={["Desk Chat (multi-turn)", "Claude Opus 4.6", "Anthropic", "512/reply", "None"]} />
          <TRow cells={["Market Summary (macro)", "Claude Opus 4.6", "Anthropic", "1024", "5min"]} />
          <TRow cells={["Single Instrument Analysis", "Claude Sonnet 4.6", "Anthropic", "1536", "5min"]} />
          <TRow cells={["Deep Analysis (S/D zones)", "Claude Sonnet 4.6", "Anthropic", "1024", "None"]} />
          <TRow cells={["Batch Analysis (all 16)", "Claude Haiku 4.5", "Anthropic", "250/instr", "10min"]} />
        </div>
        <p className="text-[10px] mt-1">
          <strong className="text-foreground">Fallbacks:</strong> Gemini 2.0 Flash (Google) → GPT-4o Mini (OpenAI) if Anthropic unavailable.
        </p>

        <h4 className="text-[10px] font-bold text-amber-600 dark:text-amber-500/70 uppercase tracking-wider mt-3">Trade Advisor (Claude Opus 4.6)</h4>
        <p className="text-[10px]">
          Receives all A+/A setups ranked by conviction, plus: regime summary, Fear &amp; Greed, DXY, bond yields,
          system consensus, impulse distribution, active positions, learning data (win rates, expectancy per pattern),
          MTF alignment per setup, ICT scores.
        </p>
        <p className="text-[10px]">
          <strong className="text-foreground">Returns:</strong> greeting, market regime assessment, top pick (instrument, action, conviction, reasoning, levels),
          other setups (2-3 notes), avoid list, risk warning, desk note (wisdom from 8 trading books).
        </p>
        <p className="text-[10px]">
          <strong className="text-foreground">The advisor NEVER overrides mechanical signals.</strong> It selects from setups the engine already approved
          and provides narrative context referencing specific data.
        </p>

        <h4 className="text-[10px] font-bold text-amber-600 dark:text-amber-500/70 uppercase tracking-wider mt-3">Bias Engine (3-Way Weighting)</h4>
        <div className="bg-surface-2/30 rounded-md overflow-hidden">
          <TRow cells={["Component", "Intraday Weight", "Swing Weight"]} header />
          <TRow cells={["Technical (RSI, MACD, BB, trend)", "60%", "40%"]} />
          <TRow cells={["Fundamental (news, F&G, rates)", "25%", "45%"]} />
          <TRow cells={["AI (LLM bias adjustment ±50)", "15%", "15%"]} />
        </div>
        <p className="text-[10px] mt-1">
          Maximum AI influence is 15% of the overall bias — it cannot dominate the score.
        </p>
      </GuideSection>

      {/* ── 16. LEARNING ── */}
      <GuideSection number={16} title="Expectancy-Based Learning (Stage 15)">
        <p>
          Every completed trade is recorded by <strong className="text-foreground">confluence key</strong>:
          <code className="text-[9px] bg-surface-2/40 px-1 rounded ml-1">instrument + regime + direction + conviction + impulse + style</code>
        </p>
        <p className="text-[10px]">
          With <strong className="text-foreground">regime-specific keys</strong> (preferred when &ge; 20 trades accumulated):
          <code className="text-[9px] bg-surface-2/40 px-1 rounded ml-1">instrument + structure + phase + direction + conviction</code>
        </p>

        <h4 className="text-[10px] font-bold text-foreground/70 uppercase tracking-wider mt-2">Learning Computation (requires &ge; 20 trades)</h4>
        <div className="space-y-1.5">
          {[
            { step: "1", label: "Time-decayed win rate", desc: "30-day exponential half-life — recent trades weighted higher" },
            { step: "2", label: "Expectancy (EV)", desc: "EV = (winRate x avgWinR) - ((1 - winRate) x avgLossR) in R-multiples" },
            { step: "3", label: "Kelly fraction", desc: "(WR x AvgWin - (1-WR) x AvgLoss) / AvgWin, capped at 25%" },
          ].map((s) => (
            <div key={s.step} className="flex gap-2 items-start">
              <span className="h-5 w-5 rounded-full bg-bullish/15 text-bullish text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{s.step}</span>
              <div>
                <span className="text-[10px] font-semibold text-foreground">{s.label}</span>
                <p className="text-[9px] text-muted-foreground/50">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <h4 className="text-[10px] font-bold text-foreground/70 uppercase tracking-wider mt-3">Adjustments Applied to Future Setups</h4>
        <div className="bg-surface-2/30 rounded-md overflow-hidden">
          <TRow cells={["EV", "Risk Multiplier", "Conviction Adjust"]} header />
          <TRow cells={["> 1.0R", "1.5x", "+15 pts"]} />
          <TRow cells={["> 0.5R", "1.25x", "+10 pts"]} />
          <TRow cells={["> 0.0R", "1.0x", "+5 pts"]} />
          <TRow cells={["> -0.3R", "0.75x", "-5 pts"]} />
          <TRow cells={["<= -0.3R", "0.5x", "-15 pts"]} />
        </div>
      </GuideSection>

      {/* ── 17. REAL-TIME TRACKING ── */}
      <GuideSection number={17} title="Real-Time Setup Tracking">
        <h4 className="text-[10px] font-bold text-foreground/70 uppercase tracking-wider">State Machine</h4>
        <pre className="text-[9px] font-mono text-muted-foreground/60 bg-surface-2/30 rounded-md px-3 py-2 overflow-x-auto whitespace-pre">
{`pending → active → breakeven → tp1_hit → tp2_hit → tp3_hit
                                    ↘ sl_hit
  ↘ expired
  ↘ invalidated`}
        </pre>
        <h4 className="text-[10px] font-bold text-foreground/70 uppercase tracking-wider mt-2">Partial Exit Management</h4>
        <div className="space-y-0.5">
          {[
            "TP1 hit → close 33%, move SL to breakeven",
            "TP2 hit → close 33%",
            "TP3 hit → close remaining 34%",
            "SL hit after TP1 → counted as WIN (banked partial profit)",
          ].map((line) => (
            <p key={line} className="text-[9px] text-muted-foreground/60 font-mono">{line}</p>
          ))}
        </div>
        <p className="text-[10px] mt-1">
          <strong className="text-foreground">Persistence:</strong> localStorage + IndexedDB (client-side).
          Timeline of all status changes with timestamps and prices. Peak price tracking for scale-in detection.
        </p>
      </GuideSection>

      {/* ── 18. BACKTEST ENGINE ── */}
      <GuideSection number={18} title="Backtest Engine">
        <p>Bar-by-bar simulation using the full mechanical pipeline:</p>
        <div className="space-y-1.5">
          {[
            { step: "1", label: "Setup generation on each bar", desc: "Full 15-stage pipeline runs per candle" },
            { step: "2", label: "Trade creation", desc: "If no open trade and setup passes all filters" },
            { step: "3", label: "Entry activation", desc: "Price touches entry zone → trade goes active" },
            { step: "4", label: "TP progression", desc: "33% at TP1, 33% at TP2, 34% at TP3" },
            { step: "5", label: "SL management", desc: "Moves to breakeven after TP1 hit" },
            { step: "6", label: "Outcome recording", desc: "Win/loss/breakeven + R-multiple + P&L" },
          ].map((s) => (
            <div key={s.step} className="flex gap-2 items-start">
              <span className="h-5 w-5 rounded-full bg-neutral-accent/15 text-neutral-accent text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">{s.step}</span>
              <div>
                <span className="text-[10px] font-semibold text-foreground">{s.label}</span>
                <p className="text-[9px] text-muted-foreground/50">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] mt-1">
          <strong className="text-foreground">Statistics:</strong> Win rate, avg P&amp;L, Sharpe ratio, max drawdown,
          per-system breakdown, per-regime breakdown, per-conviction-tier breakdown, monthly returns grid, equity curve.
          Results feed into the confluence bridge → updates learning patterns.
        </p>
      </GuideSection>

      {/* ── 19. COMPLETE DATA FLOW DIAGRAM ── */}
      <GuideSection number={19} title="Complete Data Flow Diagram">
        <pre className="text-[8px] sm:text-[9px] font-mono text-muted-foreground/60 bg-surface-2/30 rounded-md px-3 py-3 overflow-x-auto whitespace-pre leading-relaxed">
{`┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL DATA SOURCES                     │
│  Twelve Data ─── OHLCV candles (15M, 1H, 4H, Daily)        │
│  Finnhub ─────── News headlines + sentiment                  │
│  Alternative.me ─ Fear & Greed Index                         │
│  FMP ──────────── Central banks, yields, COT, calendar       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  STAGE 1-2: INDICATOR COMPUTATION (local, no API)            │
│  20+ indicators per instrument per timeframe                 │
│  Output: TechnicalSummary objects                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  STAGE 3: REGIME ENGINE                                      │
│  Input: candles + TechnicalSummary                           │
│  Output: FullRegime {volatility, structure, phase}           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  STAGE 4: MARKET STRUCTURE (runs BEFORE signals)             │
│  Input: raw candles                                          │
│  Output: HH/HL/LH/LL, BOS, CHoCH, structureScore            │
│  + ICT: FVGs, Order Blocks, Displacement, Consolidation     │
│  GATES: bullish structure blocks bearish signals             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  STAGE 5-6: STYLE + 8 SIGNALS (regime + structure gated)     │
│  Hard regime exclusion: non-matching → strength=0            │
│  Structure gate: opposing direction → filtered out           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  STAGE 7: DE-CORRELATION → STAGE 8: MTF → STAGE 9: SCORE   │
│  3 clusters (best per cluster) → weighted bias →             │
│  9-factor conviction score → tier (A+/A/B/C/D)              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  STAGE 10: HARD FILTERS                                      │
│  A+/A only │ Elder impulse │ R:R >= 1.5 │ non-neutral       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  STAGE 11-13: ENTRY OPT + SNAP + SIZE + PORTFOLIO GATE      │
│  Candle patterns → S/R snap → conviction risk → max 10%     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  STAGE 14: AI LAYER (narrator, NOT decision-maker)           │
│  ┌────────────────┐ ┌───────────────┐ ┌──────────────────┐  │
│  │ Trade Advisor   │ │  Desk Chat    │ │ Market Summary   │  │
│  │ Opus 4.6       │ │  Opus 4.6     │ │ Opus 4.6        │  │
│  └────────────────┘ └───────────────┘ └──────────────────┘  │
│  ┌────────────────┐ ┌───────────────┐ ┌──────────────────┐  │
│  │ Instrument LLM  │ │ Deep Analysis │ │ Batch Analysis   │  │
│  │ Sonnet 4.6     │ │ Sonnet 4.6    │ │ Haiku 4.5       │  │
│  └────────────────┘ └───────────────┘ └──────────────────┘  │
│  AI receives ONLY mechanical output — never raw candles      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  STAGE 15: LEARNING + FEEDBACK LOOP                          │
│  Track outcomes by confluence key (regime-specific)          │
│  Min 20 trades │ 30-day decay │ EV-based Kelly sizing        │
│  Adjusts future conviction scores + position sizes           │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │ Backtest  │───▶│ Confluence   │───▶│ Future Setup      │  │
│  │ Engine    │    │ Learning     │    │ Adjustment        │  │
│  └──────────┘    └──────────────┘    └───────────────────┘  │
└──────────────────────────────────────────────────────────────┘`}
        </pre>
      </GuideSection>

      {/* ── 20. DESIGN PRINCIPLES ── */}
      <GuideSection number={20} title="Key Design Principles">
        <div className="space-y-3">
          {[
            {
              num: "1",
              title: "AI is a narrator, not a trader",
              desc: "All 8 signal systems are mechanical. The LLM receives finished setups and provides narrative context — it cannot create, modify, or override trades.",
            },
            {
              num: "2",
              title: "Independence before confluence",
              desc: "De-correlation clustering ensures 4 correlated trend signals count as 1 observation. Tier thresholds use independent cluster count (max 3), not raw signal count.",
            },
            {
              num: "3",
              title: "Gate before score",
              desc: "Structure direction and regime matching are hard gates that exclude signals BEFORE conviction scoring. A bearish signal in bullish structure is deleted, not penalized.",
            },
            {
              num: "4",
              title: "Learn from outcomes",
              desc: "Every trade feeds back into expectancy calculations. Position sizing and conviction adjustments are driven by time-decayed EV with minimum sample requirements (>= 20 trades).",
            },
            {
              num: "5",
              title: "Portfolio awareness",
              desc: "Individual trade risk is bounded by conviction tier. Total portfolio risk is bounded by a 10% budget. Currency and correlation limits prevent concentration.",
            },
          ].map((p) => (
            <div key={p.num} className="flex gap-3 items-start">
              <span className="h-6 w-6 rounded-full bg-neutral-accent/15 text-neutral-accent text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                {p.num}
              </span>
              <div>
                <span className="text-[11px] font-semibold text-foreground">{p.title}</span>
                <p className="text-[9px] text-muted-foreground/60 mt-0.5">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </GuideSection>
    </div>
  );
}
