"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface MechanicalSystem {
  name: string;
  book: string;
  type: "Trend" | "Mean Reversion" | "Momentum";
  logic: string;
  params: string;
  regimeFit: string;
}

const systems: MechanicalSystem[] = [
  {
    name: "MA Crossover",
    book: "Weissman",
    type: "Trend",
    logic: "SMA(9) crosses SMA(26). Bullish when fast crosses above slow.",
    params: "Fast: 9, Slow: 26",
    regimeFit: "Trending markets",
  },
  {
    name: "MACD",
    book: "Weissman",
    type: "Trend",
    logic: "MACD line (EMA13-EMA26) crosses signal line. Histogram confirms momentum.",
    params: "Fast: 13, Slow: 26, Signal: 9",
    regimeFit: "Trending markets",
  },
  {
    name: "BB Breakout",
    book: "Weissman",
    type: "Trend",
    logic: "Price closes above upper band (bullish) or below lower band (bearish).",
    params: "Period: 20, StdDev: 2",
    regimeFit: "Trending + volatile markets",
  },
  {
    name: "RSI Extremes",
    book: "Weissman",
    type: "Mean Reversion",
    logic: "RSI(14) below 30 with price above SMA(200) = bullish. Above 70 with price below SMA(200) = bearish.",
    params: "Period: 14, Oversold: 30, Overbought: 70",
    regimeFit: "Ranging markets",
  },
  {
    name: "BB Mean Reversion",
    book: "Weissman",
    type: "Mean Reversion",
    logic: "Price touches lower band with SMA(200) above = bullish bounce. Upper band with SMA(200) below = bearish fade.",
    params: "Period: 20, StdDev: 2, Filter: SMA(200)",
    regimeFit: "Ranging markets",
  },
  {
    name: "Elder Impulse",
    book: "Elder",
    type: "Momentum",
    logic: "Combines EMA(13) slope + MACD-Histogram slope. GREEN = both rising, RED = both falling, BLUE = mixed.",
    params: "EMA: 13, MACD-H slope",
    regimeFit: "All regimes (hard gate filter)",
  },
  {
    name: "Elder-Ray",
    book: "Elder",
    type: "Momentum",
    logic: "Bull Power (High - EMA13) and Bear Power (Low - EMA13). Positive bull power = bullish, negative bear power = bearish.",
    params: "EMA: 13",
    regimeFit: "Trending markets",
  },
  {
    name: "Trend Stack",
    book: "Multiple",
    type: "Trend",
    logic: "Full alignment check: EMA(9) > EMA(21) > EMA(50) > SMA(200) = strong bullish. Reverse = strong bearish.",
    params: "EMAs: 9, 21, 50 + SMA: 200",
    regimeFit: "Strong trending markets",
  },
];

const typeColors = {
  Trend: "text-neutral-accent bg-neutral-accent/10 border-neutral-accent/20",
  "Mean Reversion": "text-amber-500 bg-amber-500/10 border-amber-500/20",
  Momentum: "text-bullish bg-bullish/10 border-bullish/20",
};

export function MechanicalSystemsGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {systems.map((sys, i) => (
        <motion.div
          key={sys.name}
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          className="panel rounded-lg p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold text-foreground">{sys.name}</div>
            <span className={cn("text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border", typeColors[sys.type])}>
              {sys.type}
            </span>
          </div>
          <div className="text-[9px] font-mono text-muted-foreground/50">Source: {sys.book}</div>
          <p className="text-[10px] text-muted-foreground/70 leading-relaxed">{sys.logic}</p>
          <div className="flex items-center justify-between text-[9px]">
            <span className="text-muted-foreground/40">{sys.params}</span>
          </div>
          <div className="text-[9px] text-bullish/50">Best in: {sys.regimeFit}</div>
        </motion.div>
      ))}
    </div>
  );
}
