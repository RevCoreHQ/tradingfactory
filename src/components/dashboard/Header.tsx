"use client";

import { INSTRUMENTS } from "@/lib/utils/constants";
import { useMarketStore } from "@/lib/store/market-store";
import { useRates } from "@/lib/hooks/useMarketData";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { getChangeClass } from "@/lib/utils/formatters";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AlertsBell } from "@/components/alerts/AlertsPanel";

interface HeaderProps {
  mode?: "overview" | "analysis";
}

export function Header({ mode = "analysis" }: HeaderProps) {
  const selectedInstrument = useMarketStore((s) => s.selectedInstrument);
  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument);
  const journalOpen = useMarketStore((s) => s.journalOpen);
  const setJournalOpen = useMarketStore((s) => s.setJournalOpen);
  const wsConnected = useMarketStore((s) => s.wsConnected);
  const realtimeQuotes = useMarketStore((s) => s.realtimeQuotes);
  const { data: ratesData } = useRates();
  const quotes = ratesData?.quotes || {};

  return (
    <header className="sticky top-0 z-50">
      {/* Primary bar */}
      <div className="h-12 bg-background/80 backdrop-blur-xl border-b border-border/30">
        <div className="max-w-[1800px] mx-auto h-full px-8 flex items-center justify-between">
          {/* Left: Logo */}
          <Link href="/" className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-sm font-bold tracking-tight text-foreground">Trading</span>
            <span className="text-sm font-light tracking-tight text-muted-foreground">Factory</span>
          </Link>

          {/* Center: Segmented control */}
          <div className="flex items-center gap-0.5 bg-[var(--surface-1)] rounded-full p-0.5 border border-border/30">
            <Link
              href="/"
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                mode === "overview"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Overview
            </Link>
            <Link
              href="/instrument"
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
                mode === "analysis"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Analysis
            </Link>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Live indicator */}
            <div className="flex items-center gap-1.5 px-2 mr-1">
              <span className={cn(
                "h-1.5 w-1.5 rounded-full pulse-dot",
                wsConnected ? "bg-bullish" : "bg-amber-500"
              )} />
              <span className={cn(
                "text-[10px] font-medium",
                wsConnected ? "text-bullish" : "text-amber-500"
              )}>
                {wsConnected ? "Live" : "Polling"}
              </span>
            </div>

            <button
              onClick={() => setJournalOpen(!journalOpen)}
              className={cn(
                "p-2 rounded-full transition-colors",
                journalOpen
                  ? "bg-neutral-accent/15 text-neutral-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-[var(--surface-2)]"
              )}
              aria-label="Trade journal"
            >
              <BookOpen className="h-4 w-4" />
            </button>

            <AlertsBell />

            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Sub-bar: Instrument tabs — analysis page only */}
      {mode === "analysis" && (
        <div className="h-10 bg-background/60 backdrop-blur-xl border-b border-border/20">
          <div className="max-w-[1800px] mx-auto h-full px-8 flex items-center overflow-x-auto scrollbar-none">
            {(["forex", "commodity", "crypto", "index"] as const).map((category, catIdx) => {
              const instruments = INSTRUMENTS.filter((i) => i.category === category);
              return (
                <div key={category} className="flex items-center gap-1">
                  {catIdx > 0 && (
                    <div className="w-px h-4 bg-border/30 mx-2 shrink-0" />
                  )}
                  {instruments.map((inst) => {
                    const isActive = selectedInstrument.id === inst.id;
                    const quote = quotes[inst.id];
                    const wsQuote = realtimeQuotes[inst.id];
                    const displayPrice = wsQuote?.price || quote?.mid || 0;

                    return (
                      <button
                        key={inst.id}
                        onClick={() => setSelectedInstrument(inst)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1 rounded-full text-xs transition-all whitespace-nowrap cursor-pointer",
                          isActive
                            ? "bg-[var(--surface-2)] text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-[var(--surface-1)]"
                        )}
                      >
                        <span className="font-semibold">{inst.symbol}</span>
                        {displayPrice > 0 && (
                          <span className="font-mono text-[10px]">
                            <AnimatedNumber
                              value={displayPrice}
                              format={(n) => n.toFixed(Math.min(inst.decimalPlaces, 4))}
                              className="text-[10px]"
                            />
                            {quote && quote.changePercent !== 0 && (
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
        </div>
      )}
    </header>
  );
}
