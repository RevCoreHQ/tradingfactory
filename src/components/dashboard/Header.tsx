"use client";

import { INSTRUMENTS } from "@/lib/utils/constants";
import { useMarketStore } from "@/lib/store/market-store";
import { useRates } from "@/lib/hooks/useMarketData";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { getChangeClass } from "@/lib/utils/formatters";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface HeaderProps {
  mode?: "overview" | "analysis";
}

export function Header({ mode = "analysis" }: HeaderProps) {
  const selectedInstrument = useMarketStore((s) => s.selectedInstrument);
  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument);
  const biasTimeframe = useMarketStore((s) => s.biasTimeframe);
  const setBiasTimeframe = useMarketStore((s) => s.setBiasTimeframe);
  const { data: ratesData } = useRates();
  const quotes = ratesData?.quotes || {};

  return (
    <header className="bg-[var(--surface-1)]/80 backdrop-blur-lg border-b border-border/50 px-6 py-3 sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
        {/* Logo + Nav */}
        <div className="flex items-center gap-4 shrink-0">
          <Link href="/" className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold tracking-tight text-foreground">Trading</span>
            <span className="text-sm font-light tracking-tight text-muted-foreground">Factory</span>
          </Link>

          <div className="h-5 w-px bg-border/50 hidden sm:block" />

          {mode === "analysis" && (
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-[var(--surface-2)] transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Overview
            </Link>
          )}

          {mode === "overview" && (
            <Link
              href="/instrument"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-[var(--surface-2)] transition-colors"
            >
              Analysis
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        {/* Instrument Tabs — only on analysis page */}
        {mode === "analysis" && (
          <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
            {(["forex", "commodity", "crypto", "index"] as const).map((category, catIdx) => {
              const instruments = INSTRUMENTS.filter((i) => i.category === category);
              return (
                <div key={category} className="flex items-center gap-0.5">
                  {catIdx > 0 && (
                    <div className="w-px h-4 bg-border/40 mx-1 shrink-0" />
                  )}
                  {instruments.map((inst) => {
                    const isActive = selectedInstrument.id === inst.id;
                    const quote = quotes[inst.id];

                    return (
                      <button
                        key={inst.id}
                        onClick={() => setSelectedInstrument(inst)}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap cursor-pointer",
                          isActive
                            ? "bg-[var(--surface-2)] text-foreground border border-border/50"
                            : "text-muted-foreground hover:text-foreground hover:bg-[var(--surface-2)]"
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
              );
            })}
          </div>
        )}

        {/* Right section */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Bias Timeframe Toggle */}
          <div className="flex items-center gap-0.5 bg-[var(--surface-2)] rounded-lg p-0.5 border border-border/30">
            <button
              onClick={() => setBiasTimeframe("intraday")}
              className={cn(
                "px-3 py-1.5 rounded-md text-[10px] font-medium transition-all",
                biasTimeframe === "intraday" ? "bg-[var(--surface-3)] text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Intraday
            </button>
            <button
              onClick={() => setBiasTimeframe("intraweek")}
              className={cn(
                "px-3 py-1.5 rounded-md text-[10px] font-medium transition-all",
                biasTimeframe === "intraweek" ? "bg-[var(--surface-3)] text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Intraweek
            </button>
          </div>

          <ThemeToggle />

          {/* Live indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bullish/8 border border-bullish/15">
            <span className="h-1.5 w-1.5 rounded-full bg-bullish pulse-dot" />
            <span className="text-[10px] text-bullish font-medium hidden md:inline">Live</span>
          </div>
        </div>
      </div>
    </header>
  );
}
