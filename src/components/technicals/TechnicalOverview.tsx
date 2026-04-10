"use client";

import { useTechnicalData } from "@/lib/hooks/useTechnicalData";
import { useMarketStore } from "@/lib/store/market-store";
import { GlassCard } from "@/components/common/GlassCard";
import { IndicatorCard } from "./IndicatorCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { CardSkeleton } from "@/components/common/Skeletons";
import { cn } from "@/lib/utils";

export function TechnicalOverview() {
  const { indicators, isLoading } = useTechnicalData();
  const instrument = useMarketStore((s) => s.selectedInstrument);

  if (isLoading || !indicators) {
    return (
      <div className="space-y-3">
        <CardSkeleton lines={2} />
        <div className="grid grid-cols-2 gap-3">
          <CardSkeleton lines={3} />
          <CardSkeleton lines={3} />
        </div>
      </div>
    );
  }

  const { rsi, macd, bollingerBands, atr, stochasticRsi, trend, movingAverages, pivotPoints } = indicators;

  // Count bullish/bearish MAs
  const bullishMAs = movingAverages.filter((m) => m.trend === "below_price").length;
  const totalMAs = movingAverages.length;
  const maSignal = bullishMAs > totalMAs / 2 ? "bullish" : bullishMAs < totalMAs / 2 ? "bearish" : "neutral";

  return (
    <GlassCard delay={0.1}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Technical Analysis — {instrument.symbol}</h3>
        <StatusBadge
          variant={trend.direction === "uptrend" ? "bullish" : trend.direction === "downtrend" ? "bearish" : "neutral"}
          pulse
        >
          {trend.direction}
        </StatusBadge>
      </div>

      {/* Moving Averages Summary */}
      <div className="rounded-lg bg-[var(--surface-2)] p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">Moving Averages</span>
          <StatusBadge variant={maSignal}>{bullishMAs}/{totalMAs} bullish</StatusBadge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
          {movingAverages.map((ma) => (
            <div key={`${ma.type}-${ma.period}`} className="flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">{ma.type} {ma.period}</span>
              <span className={cn("font-mono", ma.trend === "below_price" ? "text-bullish" : "text-bearish")}>
                {ma.value.toFixed(instrument.decimalPlaces)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Indicator Grid */}
      <div className="grid grid-cols-2 gap-2">
        <IndicatorCard
          name="RSI (14)"
          value={rsi.value}
          format={(n) => n.toFixed(1)}
          signal={rsi.signal === "oversold" ? "bullish" : rsi.signal === "overbought" ? "bearish" : "neutral"}
          description={rsi.signal === "overbought" ? "Overbought territory" : rsi.signal === "oversold" ? "Oversold territory" : "Neutral zone"}
        />

        <IndicatorCard
          name="MACD"
          value={macd.histogram}
          format={(n) => n.toFixed(5)}
          signal={macd.crossover === "bullish" ? "bullish" : macd.crossover === "bearish" ? "bearish" : macd.histogram > 0 ? "bullish" : "bearish"}
          description={macd.crossover ? `${macd.crossover} crossover` : `Histogram ${macd.histogram > 0 ? "positive" : "negative"}`}
        />

        <IndicatorCard
          name="Stochastic RSI"
          value={stochasticRsi.k}
          format={(n) => n.toFixed(1)}
          signal={stochasticRsi.signal === "oversold" ? "bullish" : stochasticRsi.signal === "overbought" ? "bearish" : "neutral"}
          description={`K: ${stochasticRsi.k.toFixed(1)}, ${stochasticRsi.signal}`}
        />

        <IndicatorCard
          name="ATR (14)"
          value={atr.value}
          format={(n) => n.toFixed(instrument.decimalPlaces)}
          signal="neutral"
          description={`Volatility: ${atr.normalized.toFixed(2)}% of price`}
        />

        <IndicatorCard
          name="Bollinger %B"
          value={bollingerBands.percentB * 100}
          format={(n) => `${n.toFixed(1)}%`}
          signal={bollingerBands.percentB > 0.8 ? "bullish" : bollingerBands.percentB < 0.2 ? "bearish" : "neutral"}
          description={`Width: ${(bollingerBands.width * 100).toFixed(2)}%`}
          detail={`Upper: ${bollingerBands.upper.toFixed(instrument.decimalPlaces)} | Lower: ${bollingerBands.lower.toFixed(instrument.decimalPlaces)}`}
        />

        <IndicatorCard
          name="Trend Strength"
          value={trend.strength}
          format={(n) => `${n.toFixed(0)}/100`}
          signal={trend.direction === "uptrend" ? "bullish" : trend.direction === "downtrend" ? "bearish" : "neutral"}
          description={`Pattern: ${trend.pattern.replace("_", " + ")}`}
        />
      </div>

      {/* Pivot Points */}
      {pivotPoints.length > 0 && (
        <div className="mt-3 rounded-lg bg-[var(--surface-2)] p-3">
          <span className="text-xs font-medium text-muted-foreground">Daily Pivots</span>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 mt-2 text-[12px] text-center">
            {(() => {
              const dp = pivotPoints.find((p) => p.type === "daily");
              if (!dp) return null;
              const levels = [
                { label: "S3", value: dp.s3, color: "text-bearish" },
                { label: "S2", value: dp.s2, color: "text-bearish" },
                { label: "S1", value: dp.s1, color: "text-bearish" },
                { label: "PP", value: dp.pivot, color: "text-neutral-accent" },
                { label: "R1", value: dp.r1, color: "text-bullish" },
                { label: "R2", value: dp.r2, color: "text-bullish" },
                { label: "R3", value: dp.r3, color: "text-bullish" },
              ];
              return levels.map((l) => (
                <div key={l.label}>
                  <div className="text-muted-foreground">{l.label}</div>
                  <div className={cn("font-mono", l.color)}>
                    {l.value.toFixed(instrument.decimalPlaces > 3 ? 4 : instrument.decimalPlaces)}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
    </GlassCard>
  );
}
