"use client";

import type { FundamentalScore, TechnicalScore, BiasSignal } from "@/lib/types/bias";
import { GlassCard } from "@/components/common/GlassCard";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { cn } from "@/lib/utils";

interface BiasBreakdownProps {
  fundamentalScore: FundamentalScore;
  technicalScore: TechnicalScore;
  signals: BiasSignal[];
}

function ScoreBar({ label, value, weight }: { label: string; value: number; weight: number }) {
  const color = value > 60 ? "bg-bullish" : value < 40 ? "bg-bearish" : "bg-neutral-accent";
  const textColor = value > 60 ? "text-bullish" : value < 40 ? "text-bearish" : "text-neutral-accent";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground/60 text-[10px]">{(weight * 100).toFixed(0)}%w</span>
          <span className={cn("font-mono font-medium", textColor)}>{value.toFixed(0)}</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${value}%`, opacity: 0.8 }}
        />
      </div>
    </div>
  );
}

export function BiasBreakdown({ fundamentalScore, technicalScore, signals }: BiasBreakdownProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Fundamental Score */}
      <GlassCard delay={0.1}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Fundamental Score</h3>
          <AnimatedNumber
            value={fundamentalScore.total}
            format={(n) => n.toFixed(0)}
            colorize
            className="text-lg font-bold"
          />
        </div>
        <div className="space-y-3">
          <ScoreBar label="News Sentiment" value={fundamentalScore.newsSentiment} weight={0.25} />
          <ScoreBar label="Economic Data" value={fundamentalScore.economicData} weight={0.25} />
          <ScoreBar label="Central Bank Policy" value={fundamentalScore.centralBankPolicy} weight={0.20} />
          <ScoreBar label="Market Sentiment" value={fundamentalScore.marketSentiment} weight={0.15} />
          <ScoreBar label="Intermarket" value={fundamentalScore.intermarketCorrelation} weight={0.15} />
        </div>
      </GlassCard>

      {/* Technical Score */}
      <GlassCard delay={0.2}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Technical Score</h3>
          <AnimatedNumber
            value={technicalScore.total}
            format={(n) => n.toFixed(0)}
            colorize
            className="text-lg font-bold"
          />
        </div>
        <div className="space-y-3">
          <ScoreBar label="Trend Direction" value={technicalScore.trendDirection} weight={0.30} />
          <ScoreBar label="Momentum" value={technicalScore.momentum} weight={0.30} />
          <ScoreBar label="Volatility" value={technicalScore.volatility} weight={0.15} />
          <ScoreBar label="Volume" value={technicalScore.volumeAnalysis} weight={0.10} />
          <ScoreBar label="Support / Resistance" value={technicalScore.supportResistance} weight={0.15} />
        </div>
      </GlassCard>

      {/* Signals */}
      {signals.length > 0 && (
        <GlassCard className="md:col-span-2" delay={0.3}>
          <h3 className="text-sm font-semibold text-foreground mb-3">Key Signals</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {signals.slice(0, 8).map((signal, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span
                  className={cn(
                    "mt-0.5 h-2 w-2 rounded-full shrink-0",
                    signal.signal === "bullish" ? "bg-bullish" : signal.signal === "bearish" ? "bg-bearish" : "bg-neutral-accent"
                  )}
                />
                <div>
                  <span className="font-medium text-foreground">{signal.source}</span>
                  <span className="text-muted-foreground ml-1">— {signal.description}</span>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
