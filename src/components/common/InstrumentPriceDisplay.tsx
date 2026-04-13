"use client";

import { useMarketStore } from "@/lib/store/market-store";
import { useRates } from "@/lib/hooks/useMarketData";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { formatPrice, formatPercent } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import type { Instrument } from "@/lib/types/market";

interface InstrumentPriceDisplayProps {
  instrument: Instrument;
  className?: string;
  /** When both legs exist and differ, show bid and ask; otherwise animated mid */
  showBidAsk?: boolean;
  showChange?: boolean;
  size?: "sm" | "md";
}

export function InstrumentPriceDisplay({
  instrument,
  className,
  showBidAsk = true,
  showChange = true,
  size = "sm",
}: InstrumentPriceDisplayProps) {
  const realtimeQuotes = useMarketStore((s) => s.realtimeQuotes);
  const { data: ratesData } = useRates();
  const quote = ratesData?.quotes?.[instrument.id];
  const wsQuote = realtimeQuotes[instrument.id];
  const displayMid = wsQuote?.price || quote?.mid || 0;
  const bid = quote?.bid ?? 0;
  const ask = quote?.ask ?? 0;
  const changePercent = quote?.changePercent ?? 0;
  const textSm = size === "sm" ? "text-xs" : "text-sm";
  const mono = "font-mono tabular-nums";
  const spread =
    bid > 0 && ask > 0 ? Math.abs(ask - bid) : 0;
  const useSpread =
    showBidAsk && bid > 0 && ask > 0 && spread > instrument.pipSize * 0.25;

  if (!quote && !wsQuote) {
    return (
      <span className={cn(textSm, "text-muted-foreground/50", className)} title="Price loading">
        —
      </span>
    );
  }

  if (!useSpread && displayMid <= 0) {
    return (
      <span className={cn(textSm, "text-muted-foreground/50", className)} title="Price unavailable">
        —
      </span>
    );
  }

  return (
    <div className={cn("flex flex-col items-end gap-0.5", className)}>
      <div
        className={cn(
          "flex flex-wrap items-baseline justify-end gap-x-1.5 gap-y-0",
          mono,
          textSm,
          size === "md" && "text-base"
        )}
      >
        {useSpread ? (
          <>
            <span className="text-muted-foreground/55 text-[10px] font-sans font-medium uppercase tracking-wide">
              Bid
            </span>
            <span className={size === "md" ? "font-semibold text-foreground" : undefined}>
              {formatPrice(bid, instrument.decimalPlaces)}
            </span>
            <span className="text-muted-foreground/35 px-0.5">·</span>
            <span className="text-muted-foreground/55 text-[10px] font-sans font-medium uppercase tracking-wide">
              Ask
            </span>
            <span className={size === "md" ? "font-semibold text-foreground" : undefined}>
              {formatPrice(ask, instrument.decimalPlaces)}
            </span>
          </>
        ) : (
          <AnimatedNumber
            value={displayMid}
            format={(n) => formatPrice(n, instrument.decimalPlaces)}
            className={cn(size === "md" && "font-semibold text-foreground")}
          />
        )}
      </div>
      {showChange && quote && changePercent !== 0 ? (
        <span
          className={cn(
            "text-[11px] font-mono",
            changePercent > 0 ? "text-bullish" : "text-bearish"
          )}
        >
          {formatPercent(changePercent)}
        </span>
      ) : null}
    </div>
  );
}
