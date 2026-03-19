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
  {
    name: "News Sentiment",
    provider: "Finnhub",
    icon: <Newspaper className="h-4 w-4" />,
    measures: "Headline sentiment scoring (-1 to +1) weighted by recency",
    feedsInto: "Drives bias direction. Score > 60 = bullish, < 40 = bearish",
  },
  {
    name: "Fear & Greed Index",
    provider: "Alternative.me",
    icon: <Gauge className="h-4 w-4" />,
    measures: "Market-wide sentiment gauge (0-100)",
    feedsInto: "Adapted per asset class: Greed = bullish for risk-on, Fear = bullish for safe-havens (Gold)",
  },
  {
    name: "Central Bank Policy",
    provider: "Manual + API",
    icon: <Landmark className="h-4 w-4" />,
    measures: "Rate decisions, hiking/cutting/holding, hawkish/dovish stance",
    feedsInto: "Base currency hiking = bullish. Quote currency cutting = bullish (relative strength)",
  },
  {
    name: "Bond Yields",
    provider: "FRED / Treasury",
    icon: <TrendingUp className="h-4 w-4" />,
    measures: "10Y, 5Y, 2Y yields for USD & EUR + DXY (Dollar Index)",
    feedsInto: "Rising yields = stronger currency. Yield inversions signal risk-off",
  },
  {
    name: "Economic Calendar",
    provider: "FMP",
    icon: <Calendar className="h-4 w-4" />,
    measures: "High-impact events: CPI, NFP, GDP, PMI. Actual vs forecast vs previous",
    feedsInto: "Drives volatility spikes. Beat = bullish for currency, miss = bearish",
  },
  {
    name: "COT Positioning",
    provider: "CFTC",
    icon: <BarChart3 className="h-4 w-4" />,
    measures: "Weekly institutional positioning: commercial vs speculative long/short ratios",
    feedsInto: "Extreme positioning flags potential reversals. Used for mean reversion context",
  },
  {
    name: "Average Daily Range",
    provider: "Calculated",
    icon: <Activity className="h-4 w-4" />,
    measures: "14-period average daily range. Ranked as percentile (0-100)",
    feedsInto: "Volatility context for SL/TP spacing. High ADR = wider stops needed",
  },
];

export function FundamentalSourcesGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {sources.map((src, i) => (
        <motion.div
          key={src.name}
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          className="panel rounded-lg p-3 space-y-2"
        >
          <div className="flex items-center gap-2">
            <span className="text-amber-500/60">{src.icon}</span>
            <div>
              <div className="text-[11px] font-semibold text-foreground">{src.name}</div>
              <div className="text-[9px] font-mono text-muted-foreground/50">{src.provider}</div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/70 leading-relaxed">{src.measures}</p>
          <p className="text-[9px] text-amber-500/50 leading-relaxed">{src.feedsInto}</p>
        </motion.div>
      ))}
    </div>
  );
}
