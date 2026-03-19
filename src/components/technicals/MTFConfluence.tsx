"use client";

import { useMultiTimeframeAnalysis } from "@/lib/hooks/useMultiTimeframeAnalysis";
import { GlassCard } from "@/components/common/GlassCard";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Layers } from "lucide-react";

const trendIcon = (dir: string) => {
  if (dir === "uptrend") return <TrendingUp className="h-3 w-3 text-bullish" />;
  if (dir === "downtrend") return <TrendingDown className="h-3 w-3 text-bearish" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
};

const macdLabel = (c: "bullish" | "bearish" | null) => {
  if (c === "bullish") return <span className="text-bullish">Bull X</span>;
  if (c === "bearish") return <span className="text-bearish">Bear X</span>;
  return <span className="text-muted-foreground/50">—</span>;
};

export function MTFConfluence() {
  const { confluence, isLoading, insufficientData } = useMultiTimeframeAnalysis();

  if (isLoading) {
    return (
      <GlassCard accent="neutral" delay={0.1}>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-muted-foreground/40" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Multi-Timeframe
            </span>
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 shimmer rounded-lg" />
            ))}
          </div>
        </div>
      </GlassCard>
    );
  }

  if (!confluence || insufficientData) {
    return (
      <GlassCard accent="neutral" delay={0.1}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-3.5 w-3.5 text-muted-foreground/40" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Multi-Timeframe
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/50 text-center py-2">
            Insufficient candle data for MTF analysis
          </p>
        </div>
      </GlassCard>
    );
  }

  const { timeframes, alignment, alignmentScore, htfBias } = confluence;
  const isBullish = alignment === "aligned_bullish";
  const isBearish = alignment === "aligned_bearish";
  const isMixed = alignment === "mixed";

  const alignmentLabel = isBullish
    ? "HTF ALIGNED BULLISH"
    : isBearish
    ? "HTF ALIGNED BEARISH"
    : "MIXED SIGNALS";

  return (
    <GlassCard
      accent={isBullish ? "bullish" : isBearish ? "bearish" : "neutral"}
      delay={0.1}
    >
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-muted-foreground/40" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Multi-Timeframe
            </span>
          </div>
          <span
            className={cn(
              "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
              isBullish && "bg-bullish/15 text-bullish",
              isBearish && "bg-bearish/15 text-bearish",
              isMixed && "bg-neutral-accent/15 text-neutral-accent"
            )}
          >
            {alignmentLabel}
          </span>
        </div>

        {/* Alignment gauge */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isBullish && "bg-bullish",
                isBearish && "bg-bearish",
                isMixed && "bg-neutral-accent"
              )}
              style={{ width: `${alignmentScore}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">
            {alignmentScore}%
          </span>
        </div>

        {/* Timeframe rows */}
        <div className="space-y-1.5">
          {timeframes.map((tf) => {
            const biasColor =
              tf.bias > 10 ? "text-bullish" : tf.bias < -10 ? "text-bearish" : "text-muted-foreground";
            return (
              <div
                key={tf.timeframe}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--surface-2)]"
              >
                <span className="text-[10px] font-bold w-6 text-muted-foreground/60">
                  {tf.label}
                </span>
                {trendIcon(tf.trendDirection)}
                <span className={cn("text-[10px] font-mono font-bold w-10 text-right", biasColor)}>
                  {tf.bias > 0 ? "+" : ""}{Math.round(tf.bias)}
                </span>
                <div className="h-3 w-px bg-border/30" />
                <span className={cn(
                  "text-[9px] font-mono",
                  tf.rsi > 70 ? "text-bearish" : tf.rsi < 30 ? "text-bullish" : "text-muted-foreground/60"
                )}>
                  RSI {Math.round(tf.rsi)}
                </span>
                <div className="h-3 w-px bg-border/30" />
                <span className="text-[9px] font-mono">
                  {macdLabel(tf.macdCrossover)}
                </span>
              </div>
            );
          })}
        </div>

        {/* HTF bias + confidence impact */}
        <div className="flex items-center justify-between text-[9px] text-muted-foreground/50 pt-1 border-t border-border/30">
          <span>
            HTF Bias:{" "}
            <span className={cn("font-bold", htfBias > 0 ? "text-bullish" : htfBias < 0 ? "text-bearish" : "")}>
              {htfBias > 0 ? "+" : ""}{Math.round(htfBias)}
            </span>
          </span>
          <span>
            Confidence impact:{" "}
            <span className="font-bold">
              {confluence.confidenceModifier > 1 ? "+" : ""}
              {Math.round((confluence.confidenceModifier - 1) * 100)}%
            </span>
          </span>
        </div>
      </div>
    </GlassCard>
  );
}
