"use client";

import { useMovers } from "@/lib/hooks/useMovers";
import { TrendingUp, TrendingDown } from "lucide-react";

/** Convert Polygon ticker "C:EURUSD" → display name "EUR/USD" */
function formatTicker(ticker: string): string {
  const raw = ticker.replace("C:", "").replace("X:", "");
  if (raw.length === 6) {
    return `${raw.slice(0, 3)}/${raw.slice(3)}`;
  }
  return raw;
}

export function ForexMovers() {
  const { gainers, losers, isLoading } = useMovers();

  if (isLoading || (gainers.length === 0 && losers.length === 0)) return null;

  const topGainers = gainers.slice(0, 5);
  const topLosers = losers.slice(0, 5);

  return (
    <div className="flex items-center gap-2 py-2 overflow-x-auto scrollbar-hide">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40 shrink-0">
        Movers
      </span>

      {/* Gainers */}
      <div className="flex items-center gap-1.5">
        {topGainers.map((m) => (
          <div
            key={m.ticker}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono border shrink-0 border-bullish/25 bg-bullish/8"
          >
            <TrendingUp className="h-2.5 w-2.5 text-bullish" />
            <span className="font-medium text-foreground">
              {formatTicker(m.ticker)}
            </span>
            <span className="text-bullish font-bold">
              +{m.changePercent.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>

      <div className="h-3 w-px bg-border/30 shrink-0" />

      {/* Losers */}
      <div className="flex items-center gap-1.5">
        {topLosers.map((m) => (
          <div
            key={m.ticker}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono border shrink-0 border-bearish/25 bg-bearish/8"
          >
            <TrendingDown className="h-2.5 w-2.5 text-bearish" />
            <span className="font-medium text-foreground">
              {formatTicker(m.ticker)}
            </span>
            <span className="text-bearish font-bold">
              {m.changePercent.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
