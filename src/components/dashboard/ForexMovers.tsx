"use client";

import { useMovers } from "@/lib/hooks/useMovers";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Convert Polygon ticker "C:EURUSD" → display name "EUR/USD" */
function formatTicker(ticker: string): string {
  const raw = ticker.replace("C:", "").replace("X:", "");
  if (raw.length === 6) {
    return `${raw.slice(0, 3)}/${raw.slice(3)}`;
  }
  return raw;
}

export function ForexMovers({ className }: { className?: string }) {
  const { gainers, losers, isLoading } = useMovers();

  if (isLoading || (gainers.length === 0 && losers.length === 0)) return null;

  const topGainers = gainers.slice(0, 5);
  const topLosers = losers.slice(0, 5);

  return (
    <div
      className={cn(
        "flex items-center gap-2 sm:gap-3 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/65 shrink-0 pl-0.5">
        Forex movers
      </span>

      {/* Gainers */}
      <div className="flex items-center gap-1.5">
        {topGainers.map((m) => (
          <div
            key={m.ticker}
            className="flex min-h-[28px] items-center gap-1 rounded-lg border border-bullish/30 bg-bullish/10 px-2 py-1 text-[11px] font-mono shadow-sm shrink-0 dark:border-bullish/20 dark:bg-bullish/[0.08]"
          >
            <TrendingUp className="h-2.5 w-2.5 shrink-0 text-bullish" />
            <span className="font-medium text-foreground">{formatTicker(m.ticker)}</span>
            <span className="font-bold tabular-nums text-bullish">+{m.changePercent.toFixed(2)}%</span>
          </div>
        ))}
      </div>

      <div className="h-4 w-px shrink-0 bg-border/40" aria-hidden />

      {/* Losers */}
      <div className="flex items-center gap-1.5">
        {topLosers.map((m) => (
          <div
            key={m.ticker}
            className="flex min-h-[28px] items-center gap-1 rounded-lg border border-bearish/30 bg-bearish/10 px-2 py-1 text-[11px] font-mono shadow-sm shrink-0 dark:border-bearish/20 dark:bg-bearish/[0.08]"
          >
            <TrendingDown className="h-2.5 w-2.5 shrink-0 text-bearish" />
            <span className="font-medium text-foreground">{formatTicker(m.ticker)}</span>
            <span className="font-bold tabular-nums text-bearish">{m.changePercent.toFixed(2)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
