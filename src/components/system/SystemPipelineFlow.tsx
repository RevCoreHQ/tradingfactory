"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
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
} from "lucide-react";
import type { ReactNode } from "react";

type BadgeType = "mechanical" | "ai" | "filter" | "data";

interface PipelineNode {
  id: number;
  title: string;
  icon: ReactNode;
  badge: BadgeType;
  lane: number;
  col: number;
  description: string;
}

const badgeColors: Record<BadgeType, { bg: string; text: string; glow: string }> = {
  data: { bg: "bg-neutral-accent/15", text: "text-neutral-accent", glow: "pipeline-node-glow-blue" },
  mechanical: { bg: "bg-bullish/15", text: "text-bullish", glow: "pipeline-node-glow-green" },
  filter: { bg: "bg-bearish/15", text: "text-bearish", glow: "pipeline-node-glow-red" },
  ai: { bg: "bg-amber-500/15", text: "text-amber-500", glow: "pipeline-node-glow-amber" },
};

const badgeLabels: Record<BadgeType, string> = {
  data: "DATA",
  mechanical: "MECH",
  filter: "FILTER",
  ai: "AI",
};

const nodes: PipelineNode[] = [
  { id: 1, title: "Raw Data", icon: <Database className="h-3.5 w-3.5" />, badge: "data", lane: 0, col: 0, description: "OHLCV candles from Twelve Data across 4 timeframes (15M, 1H, 4H, Daily) for 16 instruments. Fundamentals from 7 sources feed the bias engine separately." },
  { id: 2, title: "Indicators", icon: <BarChart3 className="h-3.5 w-3.5" />, badge: "data", lane: 0, col: 1, description: "20+ technical indicators computed locally: EMAs, RSI, MACD, BB, ATR, ADX, Elder-Ray, Elder Impulse, S/R, Pivots." },
  { id: 3, title: "Regime Engine", icon: <Activity className="h-3.5 w-3.5" />, badge: "mechanical", lane: 1, col: 0, description: "3-axis regime classification: Volatility (ATR percentile) x Structure (trend/range/breakout) x Phase (accumulation/expansion/distribution/markdown)." },
  { id: 4, title: "Market Structure", icon: <TrendingUp className="h-3.5 w-3.5" />, badge: "mechanical", lane: 1, col: 1, description: "HH/HL/LH/LL swing classification. BOS (break of structure) and CHoCH (change of character) detection. Structure score -100 to +100." },
  { id: 5, title: "Style Select", icon: <Clock className="h-3.5 w-3.5" />, badge: "mechanical", lane: 1, col: 2, description: "Full regime + session score determines intraday vs swing. Phase and structure now drive selection instead of raw ADX alone." },
  { id: 6, title: "8 Systems", icon: <Cog className="h-3.5 w-3.5" />, badge: "mechanical", lane: 2, col: 0, description: "Eight book-sourced mechanical systems fire independently. Dynamic weights auto-kill weak systems (<30% win rate disabled)." },
  { id: 7, title: "De-correlate", icon: <Fingerprint className="h-3.5 w-3.5" />, badge: "mechanical", lane: 2, col: 1, description: "Signals grouped into 3 clusters (Trend/MR/Momentum). Best signal per cluster, weighted by regime. Prevents fake confluence." },
  { id: 8, title: "MTF Align", icon: <Layers className="h-3.5 w-3.5" />, badge: "mechanical", lane: 2, col: 2, description: "EMA stack (9/21/50 + SMA 200) on all 4 timeframes. Full alignment = +10 pts, against = -10 pts." },
  { id: 9, title: "Conviction", icon: <Target className="h-3.5 w-3.5" />, badge: "mechanical", lane: 2, col: 3, description: "8 scoring factors → 0-100 score → A+/A/B/C/D tiers. Cluster agreement, regime match, impulse, phase, structure, MTF." },
  { id: 10, title: "Hard Filters", icon: <ShieldAlert className="h-3.5 w-3.5" />, badge: "filter", lane: 3, col: 0, description: "Only A+/A pass. Elder Impulse hard gate. R:R >= 1.5. Non-neutral direction required." },
  { id: 11, title: "Entry Opt.", icon: <Crosshair className="h-3.5 w-3.5" />, badge: "mechanical", lane: 3, col: 1, description: "Candle patterns (hammer, engulfing, pin bar, inside bar) + EMA(21) pullback detection. Refines entry zone." },
  { id: 12, title: "Levels + Size", icon: <Scale className="h-3.5 w-3.5" />, badge: "data", lane: 3, col: 2, description: "S/R snapping (fractal, pivots, fibs). Conviction-scaled position sizing: A+ = 1.25x, A = 1.0x." },
  { id: 13, title: "Risk Gate", icon: <ShieldCheck className="h-3.5 w-3.5" />, badge: "filter", lane: 3, col: 3, description: "Portfolio-level: total risk <6%, currency cap <4%, max 2 correlated, drawdown throttle on losing streaks." },
  { id: 14, title: "AI Advisor", icon: <Sparkles className="h-3.5 w-3.5" />, badge: "ai", lane: 3, col: 4, description: "LLM narrates the top setups. Market regime assessment, top pick, risk warnings. Narrator, not decision-maker." },
  { id: 15, title: "Learning", icon: <RefreshCw className="h-3.5 w-3.5" />, badge: "mechanical", lane: 3, col: 5, description: "R-multiple tracking, 30-day half-life decay, expectancy-based risk scaling. 10+ trade threshold. Kelly fraction capped at 25%." },
];

const laneLabels = ["DATA", "ANALYSIS", "SIGNALS", "EXECUTION"];
const laneColors = [
  "text-neutral-accent/60",
  "text-bullish/60",
  "text-bullish/60",
  "text-bearish/60",
];

function PipelineNodeCard({ node, index }: { node: PipelineNode; index: number }) {
  const colors = badgeColors[node.badge];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className={cn(
        "glass-card rounded-lg p-3 cursor-default group relative",
        "pipeline-node-glow",
        colors.glow
      )}
      title={node.description}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[9px] font-mono text-muted-foreground/40 w-4 shrink-0">
          {node.id}
        </span>
        <span className={cn("shrink-0", colors.text)}>{node.icon}</span>
        <span className="text-[11px] font-semibold text-foreground truncate">
          {node.title}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border",
            colors.bg,
            colors.text,
            `border-current/20`
          )}
        >
          {badgeLabels[node.badge]}
        </span>
      </div>

      {/* Hover tooltip */}
      <div className="absolute left-0 right-0 top-full mt-2 z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="glass-card rounded-lg p-3 text-[10px] text-muted-foreground leading-relaxed shadow-lg border border-border/40 mx-1">
          {node.description}
        </div>
      </div>
    </motion.div>
  );
}

export function SystemPipelineFlow() {
  // Group nodes by lane
  const lanes = [0, 1, 2, 3].map((lane) =>
    nodes.filter((n) => n.lane === lane)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6 }}
    >
      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-lg font-semibold text-foreground">
          15-Stage Pipeline
        </h2>
        <p className="text-xs text-muted-foreground/60 mt-1">
          From raw market data to trade execution — hover for details
        </p>
      </div>

      {/* Pipeline lanes */}
      <div className="space-y-4">
        {lanes.map((laneNodes, laneIdx) => (
          <div key={laneIdx} className="flex items-center gap-3">
            {/* Lane label */}
            <div className={cn("w-20 shrink-0 text-right", laneColors[laneIdx])}>
              <span className="text-[9px] font-bold uppercase tracking-wider">
                {laneLabels[laneIdx]}
              </span>
            </div>

            {/* Nodes in this lane */}
            <div className="flex-1 flex items-center gap-2">
              {laneNodes.map((node, nodeIdx) => (
                <div key={node.id} className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <PipelineNodeCard
                      node={node}
                      index={laneIdx * 4 + nodeIdx}
                    />
                  </div>
                  {/* Arrow connector */}
                  {nodeIdx < laneNodes.length - 1 && (
                    <div className="shrink-0 w-4 flex items-center justify-center">
                      <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                        <path
                          d="M0 6h12m0 0L8 2m4 4L8 10"
                          stroke="currentColor"
                          strokeWidth="1"
                          className="text-muted-foreground/30"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Lane connector lines (vertical) */}
      <div className="flex justify-center mt-4">
        <div className="flex items-center gap-3 text-[9px] text-muted-foreground/40">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-neutral-accent/40" />
            Data
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-bullish/40" />
            Mechanical
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-bearish/40" />
            Filter
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500/40" />
            AI
          </span>
        </div>
      </div>
    </motion.div>
  );
}
