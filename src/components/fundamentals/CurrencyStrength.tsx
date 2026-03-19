"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/common/GlassCard";
import { cn } from "@/lib/utils";
import { MAJOR_CURRENCIES, INSTRUMENTS } from "@/lib/utils/constants";
import { useMarketStore } from "@/lib/store/market-store";
import type { BiasResult } from "@/lib/types/bias";

function computeCurrencyStrengths(
  biasResults: Record<string, BiasResult>,
  currencies: readonly string[]
): { currency: string; strength: number }[] {
  return currencies
    .map((currency) => {
      let totalBias = 0;
      let count = 0;

      for (const inst of INSTRUMENTS) {
        if (inst.category !== "forex") continue;
        const bias = biasResults[inst.id];
        if (!bias) continue;

        const isBase = inst.alphavantageSymbol === currency;
        const isQuote = inst.alphavantageToSymbol === currency;

        if (isBase) {
          totalBias += bias.overallBias;
          count++;
        } else if (isQuote) {
          totalBias -= bias.overallBias;
          count++;
        }
      }

      const avgBias = count > 0 ? totalBias / count : 0;
      const strength = Math.max(0, Math.min(100, 50 + avgBias / 2));
      return { currency, strength };
    })
    .sort((a, b) => b.strength - a.strength);
}

export function CurrencyStrength() {
  const allBiasResults = useMarketStore((s) => s.allBiasResults);
  const biasTimeframe = "intraday" as const;
  const currentResults = allBiasResults[biasTimeframe];

  const strengths = useMemo(
    () => computeCurrencyStrengths(currentResults, MAJOR_CURRENCIES),
    [currentResults]
  );

  const hasData = Object.keys(currentResults).length > 0;

  return (
    <GlassCard delay={0.3}>
      <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
        Currency Strength
      </h3>

      {!hasData ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 shimmer rounded" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {strengths.map((item) => {
            const color = item.strength > 60 ? "bg-bullish" : item.strength < 40 ? "bg-bearish" : "bg-neutral-accent";
            const textColor = item.strength > 60 ? "text-bullish" : item.strength < 40 ? "text-bearish" : "text-neutral-accent";

            return (
              <div key={item.currency} className="flex items-center gap-3">
                <span className="text-xs font-mono font-medium w-8 text-foreground">{item.currency}</span>
                <div className="flex-1 h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", color)}
                    style={{ width: `${item.strength}%`, opacity: 0.7 }}
                  />
                </div>
                <span className={cn("text-xs font-mono w-8 text-right", textColor)}>
                  {item.strength.toFixed(0)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
