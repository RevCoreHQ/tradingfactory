"use client";

import { INSTRUMENTS } from "@/lib/utils/constants";
import { useMarketStore } from "@/lib/store/market-store";
import { useRates } from "@/lib/hooks/useMarketData";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { getChangeClass } from "@/lib/utils/formatters";
import { Activity } from "lucide-react";

export function Header() {
  const selectedInstrument = useMarketStore((s) => s.selectedInstrument);
  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument);
  const biasTimeframe = useMarketStore((s) => s.biasTimeframe);
  const setBiasTimeframe = useMarketStore((s) => s.setBiasTimeframe);
  const { data: ratesData } = useRates();
  const quotes = ratesData?.quotes || {};

  return (
    <header className="glass-card border-x-0 border-t-0 rounded-none px-4 py-3 sticky top-0 z-50">
      <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-neutral-accent to-neutral-accent/50 flex items-center justify-center">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold tracking-tight text-foreground">Trading Factory</h1>
            <p className="text-[10px] text-muted-foreground -mt-0.5">Professional Analysis</p>
          </div>
        </div>

        {/* Instrument Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {INSTRUMENTS.map((inst) => {
            const isActive = selectedInstrument.id === inst.id;
            const quote = quotes[inst.id];

            return (
              <button
                key={inst.id}
                onClick={() => setSelectedInstrument(inst)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer",
                  isActive
                    ? "bg-white/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                <span className="font-semibold">{inst.symbol}</span>
                {quote && quote.mid > 0 && (
                  <span className="font-mono text-[10px]">
                    <AnimatedNumber
                      value={quote.mid}
                      format={(n) => n.toFixed(Math.min(inst.decimalPlaces, 4))}
                      className="text-[10px]"
                    />
                    {quote.changePercent !== 0 && (
                      <span className={cn("ml-1", getChangeClass(quote.changePercent))}>
                        {quote.changePercent > 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Bias Timeframe Toggle */}
          <div className="flex items-center gap-0.5 bg-white/5 rounded-lg p-0.5">
            <button
              onClick={() => setBiasTimeframe("intraday")}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-medium transition-all",
                biasTimeframe === "intraday" ? "bg-white/10 text-foreground" : "text-muted-foreground"
              )}
            >
              Intraday
            </button>
            <button
              onClick={() => setBiasTimeframe("intraweek")}
              className={cn(
                "px-2.5 py-1 rounded-md text-[10px] font-medium transition-all",
                biasTimeframe === "intraweek" ? "bg-white/10 text-foreground" : "text-muted-foreground"
              )}
            >
              Intraweek
            </button>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-bullish pulse-dot" />
            <span className="text-[10px] text-muted-foreground hidden md:inline">Live</span>
          </div>
        </div>
      </div>
    </header>
  );
}
