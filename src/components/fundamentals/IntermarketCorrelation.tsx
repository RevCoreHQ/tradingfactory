"use client";

import { GlassCard } from "@/components/common/GlassCard";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { cn } from "@/lib/utils";

// Approximate correlations for display - will be calculated from real data
const MOCK_CORRELATIONS: Record<string, Record<string, number>> = {
  EUR_USD: { EUR_USD: 1, GBP_USD: 0.85, USD_JPY: -0.65, BTC_USD: 0.3, US100: 0.4, US30: 0.35 },
  GBP_USD: { EUR_USD: 0.85, GBP_USD: 1, USD_JPY: -0.55, BTC_USD: 0.25, US100: 0.35, US30: 0.3 },
  USD_JPY: { EUR_USD: -0.65, GBP_USD: -0.55, USD_JPY: 1, BTC_USD: -0.15, US100: 0.2, US30: 0.25 },
  BTC_USD: { EUR_USD: 0.3, GBP_USD: 0.25, USD_JPY: -0.15, BTC_USD: 1, US100: 0.65, US30: 0.5 },
  US100: { EUR_USD: 0.4, GBP_USD: 0.35, USD_JPY: 0.2, BTC_USD: 0.65, US100: 1, US30: 0.92 },
  US30: { EUR_USD: 0.35, GBP_USD: 0.3, USD_JPY: 0.25, BTC_USD: 0.5, US100: 0.92, US30: 1 },
};

function getCorrelationColor(value: number): string {
  if (value > 0.7) return "bg-bullish/60";
  if (value > 0.3) return "bg-bullish/30";
  if (value > -0.3) return "bg-white/10";
  if (value > -0.7) return "bg-bearish/30";
  return "bg-bearish/60";
}

function getCorrelationText(value: number): string {
  if (value > 0.7) return "text-bullish";
  if (value > 0.3) return "text-bullish/70";
  if (value > -0.3) return "text-muted-foreground";
  if (value > -0.7) return "text-bearish/70";
  return "text-bearish";
}

export function IntermarketCorrelation() {
  const symbols = INSTRUMENTS.map((i) => i.symbol.replace("/", ""));
  const ids = INSTRUMENTS.map((i) => i.id);

  return (
    <GlassCard delay={0.4}>
      <h3 className="text-sm font-semibold mb-3">Correlation Matrix</h3>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="p-1" />
              {symbols.map((sym) => (
                <th key={sym} className="p-1 text-[9px] font-mono text-muted-foreground text-center">
                  {sym.slice(0, 4)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ids.map((rowId, i) => (
              <tr key={rowId}>
                <td className="p-1 text-[9px] font-mono text-muted-foreground">
                  {symbols[i].slice(0, 4)}
                </td>
                {ids.map((colId) => {
                  const corr = MOCK_CORRELATIONS[rowId]?.[colId] || 0;
                  return (
                    <td key={colId} className="p-0.5">
                      <div
                        className={cn(
                          "w-8 h-8 rounded flex items-center justify-center text-[9px] font-mono transition-all",
                          getCorrelationColor(corr),
                          getCorrelationText(corr)
                        )}
                        title={`${INSTRUMENTS.find((i) => i.id === rowId)?.symbol} vs ${INSTRUMENTS.find((i) => i.id === colId)?.symbol}: ${corr.toFixed(2)}`}
                      >
                        {corr === 1 ? "1.0" : corr.toFixed(1)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-4 mt-3">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-bearish/60" />
          <span className="text-[9px] text-muted-foreground">Strong -</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-white/10" />
          <span className="text-[9px] text-muted-foreground">Neutral</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-bullish/60" />
          <span className="text-[9px] text-muted-foreground">Strong +</span>
        </div>
      </div>
    </GlassCard>
  );
}
