"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Step {
  number: number;
  title: string;
  badge: string;
  summary: string;
  detail: string;
}

const steps: Step[] = [
  { number: 1, title: "Candles Arrive", badge: "DATA", summary: "OHLCV for EUR/USD on 4 timeframes", detail: "Twelve Data delivers 1H + 4H candles for the signal engine, plus 15M + Daily for MTF trend. 200 candles per timeframe gives full indicator history." },
  { number: 2, title: "Indicators Computed", badge: "DATA", summary: "20+ indicators calculated locally", detail: "EMA(9,13,21,50,200), RSI(14)=42, MACD crossover pending, BB width=0.8%, ATR(14)=0.0062, ADX=28 with DI+ > DI-, Elder Impulse=BLUE." },
  { number: 3, title: "Regime Classified", badge: "MECH", summary: "Normal volatility, Trend structure, Expansion phase", detail: "ATR percentile=55 (normal), EMA slope positive + ADX=28 (trend), ADX rising + price above EMA50 (expansion). Legacy: trending_up." },
  { number: 4, title: "Structure Analyzed", badge: "MECH", summary: "HH, HL pattern — bullish structure +62", detail: "Last 4 swings: HH, HL, HH, HL. Recent BOS confirmed at 1.0892. No CHoCH. Structure score = +62." },
  { number: 5, title: "Style Selected", badge: "MECH", summary: "Swing trading — 4H candles, 2.0 ATR stop", detail: "Expansion phase + trend structure + session score 72 = swing. Uses 4H candles, 2.0 ATR stop loss, 24h expiry window." },
  { number: 6, title: "Systems Fire", badge: "MECH", summary: "6/8 bullish — MA Cross, MACD, Trend Stack, Elder-Ray, BB, Impulse", detail: "MA Crossover: bullish 72. MACD: bullish 68. BB Breakout: neutral. RSI: neutral. BB MR: neutral. Elder Impulse: bullish 65. Elder-Ray: bullish 58. Trend Stack: bullish 85." },
  { number: 7, title: "De-correlated", badge: "MECH", summary: "3 clusters active: Trend=85, MR=0, Momentum=65", detail: "Trend cluster picks Trend Stack (85). MR cluster has no signal. Momentum picks Elder Impulse (65). Weighted by trend regime: T=0.45, MR=0.15, M=0.40. Effective agreement = 34.5/40." },
  { number: 8, title: "Conviction Scored", badge: "MECH", summary: "Score: 78 → A+ tier", detail: "Cluster agreement: 34.5. Regime match: 25 (3+ matched). Impulse: 0 (BLUE). Strong signal: 10 (2x strength>=70). Phase: +10 (expansion aligned). Structure: +10 (HH/HL aligned). MTF: +5 (3/4 aligned). Exhaustion: 0. Total: 78." },
  { number: 9, title: "Filters Pass", badge: "FILTER", summary: "A+ conviction, no impulse conflict, R:R = 2.1", detail: "Conviction A+ (>=75): PASS. Elder Impulse BLUE (no conflict): PASS. R:R on TP1 = 2.1 (>= 1.5): PASS. Direction bullish (not neutral): PASS." },
  { number: 10, title: "Entry Optimized", badge: "MECH", summary: "Bullish engulfing detected — entry tightened", detail: "1H candle shows bullish engulfing (1.4x previous body). Entry zone tightened from [1.0880, 1.0895] to [1.0882, 1.0890]. Effective R:R improved to 2.3." },
  { number: 11, title: "Risk Gate OK", badge: "FILTER", summary: "2.1% total risk, EUR at 1.8%, no correlated", detail: "Portfolio total risk: 2.1% (<6% cap). EUR exposure: 1.8% (<4% cap). No correlated EUR pairs open. 0 consecutive losses. Full size approved." },
  { number: 12, title: "Setup Delivered", badge: "AI", summary: "EUR/USD A+ LONG — AI provides narrative", detail: "Mechanical engine delivers: EUR/USD LONG, A+ conviction, entry 1.0882-1.0890, SL 1.0758, TP1 1.1020, TP2 1.1090, TP3 1.1160. AI Desk Manager narrates the setup and adds macro context." },
];

const badgeColors: Record<string, string> = {
  DATA: "bg-neutral-accent/15 text-neutral-accent border-neutral-accent/25",
  MECH: "bg-bullish/15 text-bullish border-bullish/25",
  FILTER: "bg-bearish/15 text-bearish border-bearish/25",
  AI: "bg-amber-500/15 text-amber-500 border-amber-500/25",
};

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
                <span className="text-[9px] font-mono text-muted-foreground/40">
                  {step.number}
                </span>
                <span className={cn("text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border", badgeColors[step.badge])}>
                  {step.badge}
                </span>
              </div>
              <h5 className="text-[11px] font-semibold text-foreground mb-1">
                {step.title}
              </h5>
              <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
                {step.summary}
              </p>
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
            <div className="glass-card rounded-xl p-5 border-l-[3px] border-l-[var(--neutral-accent)]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-mono text-muted-foreground/40">
                  Step {activeStep}
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {steps[activeStep - 1].title}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {steps[activeStep - 1].detail}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
