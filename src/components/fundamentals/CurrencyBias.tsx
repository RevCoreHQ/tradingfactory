"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { MAJOR_CURRENCIES, INSTRUMENTS } from "@/lib/utils/constants";
import { useMarketStore } from "@/lib/store/market-store";
import { useBondYields } from "@/lib/hooks/useMarketData";
import { getBiasColor, getBiasDirection, getBiasLabel } from "@/lib/utils/formatters";
import type { BiasResult, BiasDirection } from "@/lib/types/bias";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface CurrencyBiasData {
  currency: string;
  avgBias: number;
  direction: BiasDirection;
  strength: number;
  contributingPairs: { symbol: string; bias: number }[];
}

function computeCurrencyBiases(
  biasResults: Record<string, BiasResult>
): CurrencyBiasData[] {
  return [...MAJOR_CURRENCIES]
    .map((currency) => {
      let totalBias = 0;
      let count = 0;
      const contributing: CurrencyBiasData["contributingPairs"] = [];

      for (const inst of INSTRUMENTS) {
        if (inst.category !== "forex") continue;
        const bias = biasResults[inst.id];
        if (!bias) continue;

        const isBase = inst.alphavantageSymbol === currency;
        const isQuote = inst.alphavantageToSymbol === currency;

        if (isBase) {
          totalBias += bias.overallBias;
          count++;
          contributing.push({ symbol: inst.symbol, bias: bias.overallBias });
        } else if (isQuote) {
          totalBias -= bias.overallBias;
          count++;
          contributing.push({ symbol: inst.symbol, bias: -bias.overallBias });
        }
      }

      const avgBias = count > 0 ? totalBias / count : 0;
      const direction = getBiasDirection(avgBias);
      const strength = Math.min(100, Math.abs(avgBias));

      return {
        currency,
        avgBias,
        direction,
        strength,
        contributingPairs: contributing.sort((a, b) => Math.abs(b.bias) - Math.abs(a.bias)),
      };
    })
    .sort((a, b) => b.avgBias - a.avgBias);
}

function DirectionIcon({ direction }: { direction: BiasDirection }) {
  if (direction.includes("bullish")) return <TrendingUp className="h-3 w-3 text-bullish" />;
  if (direction.includes("bearish")) return <TrendingDown className="h-3 w-3 text-bearish" />;
  return <Minus className="h-3 w-3 text-neutral-accent" />;
}

export function CurrencyBias() {
  const allBiasResults = useMarketStore((s) => s.allBiasResults);
  const biasTimeframe = useMarketStore((s) => s.biasTimeframe);
  const currentResults = allBiasResults[biasTimeframe];
  const { data: bondData } = useBondYields();
  const dxy = bondData?.dxy;

  const biases = useMemo(
    () => computeCurrencyBiases(currentResults),
    [currentResults]
  );

  const hasData = Object.keys(currentResults).length > 0;

  return (
    <div className="panel rounded-lg p-4">
      <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
        Currency Bias Index
      </h3>

      {/* DXY special row */}
      {dxy && dxy.value > 0 && (
        <div className="mb-3 p-2.5 rounded-lg bg-[var(--surface-2)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-mono">DXY</span>
            <span className="text-[10px] text-muted-foreground">US Dollar Index</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono font-bold text-foreground">
              {dxy.value.toFixed(2)}
            </span>
            <span
              className={cn(
                "text-[10px] font-mono",
                dxy.change > 0 ? "text-bullish" : dxy.change < 0 ? "text-bearish" : "text-muted-foreground"
              )}
            >
              {dxy.change > 0 ? "+" : ""}
              {dxy.change.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Currency grid */}
      {!hasData ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 shimmer rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {biases.map((item) => {
            const color = getBiasColor(item.direction);

            return (
              <div
                key={item.currency}
                className="bg-[var(--surface-2)] rounded-lg p-2.5"
                style={{ borderLeft: `3px solid ${color}` }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <DirectionIcon direction={item.direction} />
                    <span className="text-xs font-bold font-mono">{item.currency}</span>
                  </div>
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider"
                    style={{ color }}
                  >
                    {getBiasLabel(item.direction)}
                  </span>
                </div>

                <div className="text-center my-1">
                  <span className="text-lg font-mono font-bold" style={{ color }}>
                    {item.avgBias > 0 ? "+" : ""}
                    {item.avgBias.toFixed(0)}
                  </span>
                </div>

                {/* Strength bar */}
                <div className="h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden mb-1.5">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.abs(item.avgBias) + 50)}%`,
                      backgroundColor: color,
                      opacity: 0.6,
                    }}
                  />
                </div>

                {/* Contributing pairs */}
                <div className="space-y-0.5">
                  {item.contributingPairs.slice(0, 2).map((p) => (
                    <div
                      key={p.symbol}
                      className="text-[9px] text-muted-foreground/50 truncate font-mono"
                    >
                      {p.symbol}: {p.bias > 0 ? "+" : ""}
                      {p.bias.toFixed(0)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
