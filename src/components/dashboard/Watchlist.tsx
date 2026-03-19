"use client";

import { INSTRUMENTS } from "@/lib/utils/constants";
import { useMarketStore } from "@/lib/store/market-store";
import { useRates } from "@/lib/hooks/useMarketData";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { getChangeClass } from "@/lib/utils/formatters";

const CATEGORIES = [
  { key: "forex", label: "Forex" },
  { key: "commodity", label: "Commodities" },
  { key: "crypto", label: "Crypto" },
  { key: "index", label: "Indices" },
] as const;

export function Watchlist() {
  const selectedInstrument = useMarketStore((s) => s.selectedInstrument);
  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument);
  const realtimeQuotes = useMarketStore((s) => s.realtimeQuotes);
  const { data: ratesData } = useRates();
  const quotes = ratesData?.quotes || {};

  return (
    <aside className="w-56 shrink-0 sticky top-12 h-[calc(100vh-3rem)] overflow-y-auto bg-background/60 backdrop-blur-xl border-r border-border/20">
      <div className="py-3">
        {CATEGORIES.map((cat, catIdx) => {
          const instruments = INSTRUMENTS.filter((i) => i.category === cat.key);
          return (
            <div key={cat.key}>
              {catIdx > 0 && <div className="h-px bg-border/20 mx-3 my-1.5" />}
              <div className="px-4 py-1.5">
                <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  {cat.label}
                </span>
              </div>
              {instruments.map((inst) => {
                const isActive = selectedInstrument.id === inst.id;
                const wsQuote = realtimeQuotes[inst.id];
                const quote = quotes[inst.id];
                const displayPrice = wsQuote?.price || quote?.mid || 0;
                const changePercent = quote?.changePercent || 0;

                return (
                  <button
                    key={inst.id}
                    onClick={() => setSelectedInstrument(inst)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-2 text-left transition-colors cursor-pointer",
                      isActive
                        ? "bg-[var(--surface-2)] border-l-2 border-l-neutral-accent"
                        : "hover:bg-[var(--surface-1)] border-l-2 border-l-transparent"
                    )}
                  >
                    <span className={cn(
                      "text-xs font-semibold",
                      isActive ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {inst.symbol}
                    </span>
                    <div className="flex flex-col items-end">
                      {displayPrice > 0 ? (
                        <>
                          <span className="font-mono text-[11px] text-foreground">
                            <AnimatedNumber
                              value={displayPrice}
                              format={(n) => n.toFixed(Math.min(inst.decimalPlaces, 4))}
                              className="text-[11px]"
                            />
                          </span>
                          {changePercent !== 0 && (
                            <span className={cn("font-mono text-[9px]", getChangeClass(changePercent))}>
                              {changePercent > 0 ? "+" : ""}{changePercent.toFixed(2)}%
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/30">--</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
