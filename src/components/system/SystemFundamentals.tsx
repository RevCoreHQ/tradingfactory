"use client";

import { motion } from "motion/react";
import {
  Newspaper,
  Gauge,
  Landmark,
  TrendingUp,
  Calendar,
  BarChart3,
  Activity,
  Brain,
} from "lucide-react";
import type { ReactNode } from "react";

interface Source {
  name: string;
  provider: string;
  icon: ReactNode;
  measures: string;
  feedsInto: string;
}

const sources: Source[] = [
  { name: "News Sentiment", provider: "Finnhub", icon: <Newspaper className="h-3.5 w-3.5" />, measures: "Headline sentiment (-1 to +1)", feedsInto: "Score > 60 = bullish, < 40 = bearish" },
  { name: "Fear & Greed", provider: "Alternative.me", icon: <Gauge className="h-3.5 w-3.5" />, measures: "Market-wide sentiment (0-100)", feedsInto: "Greed = risk-on bullish, Fear = safe-haven bullish" },
  { name: "Central Bank", provider: "Manual + API", icon: <Landmark className="h-3.5 w-3.5" />, measures: "Rate decisions, hawk/dove stance", feedsInto: "Hiking = currency bullish (relative strength)" },
  { name: "Bond Yields", provider: "FRED", icon: <TrendingUp className="h-3.5 w-3.5" />, measures: "10Y, 5Y, 2Y yields + DXY", feedsInto: "Rising yields = stronger currency" },
  { name: "Rate Differentials", provider: "Derived", icon: <TrendingUp className="h-3.5 w-3.5" />, measures: "Base vs quote rate spread per pair", feedsInto: "Carry direction: long/short/neutral, tailwind/headwind logic" },
  { name: "Econ Calendar", provider: "Forex Factory", icon: <Calendar className="h-3.5 w-3.5" />, measures: "CPI, NFP, GDP, PMI, rate decisions", feedsInto: "Beat = bullish, miss = bearish. High-impact within 24h → reduced exposure" },
  { name: "COT Positioning", provider: "CFTC", icon: <BarChart3 className="h-3.5 w-3.5" />, measures: "Speculative + commercial positioning", feedsInto: "Crowded >70%/<30%, smart money divergence, weekly shift >15K. Filter, not trigger" },
  { name: "ADR", provider: "Calculated", icon: <Activity className="h-3.5 w-3.5" />, measures: "14-period avg daily range", feedsInto: "Volatility context for SL/TP spacing" },
];

export function SystemFundamentals() {
  return (
    <div className="space-y-6">
      {/* Hub node */}
      <div className="flex justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative"
        >
          <div className="h-16 w-16 rounded-full bg-amber-600/15 border border-amber-600/25 flex items-center justify-center">
            <Brain className="h-6 w-6 text-amber-600 dark:text-amber-500" />
          </div>
          <div className="absolute inset-0 h-16 w-16 rounded-full border border-amber-600/15 pulse-ring" />
          <p className="text-[12px] font-semibold text-amber-700 dark:text-amber-500/80 text-center mt-2">Bias Engine</p>
        </motion.div>
      </div>

      {/* Source cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {sources.map((src, i) => (
          <motion.div
            key={src.name}
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
            className="glass-card rounded-lg p-3 space-y-1.5 pipeline-node-glow pipeline-node-glow-amber"
          >
            <div className="flex items-center gap-2">
              <span className="text-amber-600 dark:text-amber-500/70">{src.icon}</span>
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-foreground truncate">{src.name}</div>
                <div className="text-[10px] font-mono text-muted-foreground/40">{src.provider}</div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground/60 leading-relaxed">{src.measures}</p>
            <p className="text-[10px] text-amber-700/70 dark:text-amber-500/50 leading-relaxed">{src.feedsInto}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
