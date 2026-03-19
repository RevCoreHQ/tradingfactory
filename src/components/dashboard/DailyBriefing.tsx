"use client";

import { useMarketStore } from "@/lib/store/market-store";
import { useTechnicalData } from "@/lib/hooks/useTechnicalData";
import { useBiasScore } from "@/lib/hooks/useBiasScore";
import { GlassCard } from "@/components/common/GlassCard";
import { getBiasLabel, getBiasTextClass, formatPrice } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

export function DailyBriefing() {
  const instrument = useMarketStore((s) => s.selectedInstrument);
  const biasTimeframe = "intraday" as const;
  const { biasResult } = useBiasScore();
  const { indicators } = useTechnicalData();

  if (!biasResult) return null;

  const parts: string[] = [];

  // Bias summary
  parts.push(
    `${instrument.symbol}: ${getBiasLabel(biasResult.direction)} bias (${biasResult.overallBias > 0 ? "+" : ""}${biasResult.overallBias.toFixed(0)}, ${biasResult.confidence.toFixed(0)}% confidence)`
  );

  // Price info
  if (indicators) {
    parts.push(
      `Price at ${formatPrice(indicators.currentPrice, instrument.decimalPlaces)}`
    );

    // RSI
    parts.push(`RSI ${indicators.rsi.signal} at ${indicators.rsi.value.toFixed(1)}`);

    // MACD
    if (indicators.macd.crossover) {
      parts.push(`MACD ${indicators.macd.crossover} crossover`);
    } else {
      parts.push(`MACD histogram ${indicators.macd.histogram > 0 ? "positive" : "negative"}`);
    }

    // Trend
    parts.push(`Trend: ${indicators.trend.direction} (${indicators.trend.pattern.replace("_", "/")})`);
  }

  // Fundamental/Technical breakdown
  parts.push(
    `Fundamental: ${biasResult.fundamentalScore.total.toFixed(0)}/100, Technical: ${biasResult.technicalScore.total.toFixed(0)}/100`
  );


  return (
    <GlassCard className="relative overflow-hidden" delay={0}>
      <div className="flex items-start gap-3">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">Daily Briefing</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className={cn("font-semibold", getBiasTextClass(biasResult.direction))}>
              {instrument.symbol}
            </span>
            {" — "}
            {parts.join(". ")}.
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
