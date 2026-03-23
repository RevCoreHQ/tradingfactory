"use client";

import { useState } from "react";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { useMarketStore } from "@/lib/store/market-store";
import { useRates } from "@/lib/hooks/useMarketData";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { getChangeClass } from "@/lib/utils/formatters";
import { Plus, X, Star } from "lucide-react";

const CATEGORIES = [
  { key: "forex", label: "Forex" },
  { key: "commodity", label: "Commodities" },
  { key: "crypto", label: "Crypto" },
  { key: "index", label: "Indices" },
] as const;

export function Watchlist() {
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const selectedInstrument = useMarketStore((s) => s.selectedInstrument);
  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument);
  const realtimeQuotes = useMarketStore((s) => s.realtimeQuotes);
  const watchlistIds = useMarketStore((s) => s.watchlistIds);
  const favoriteIds = useMarketStore((s) => s.favoriteIds);
  const addToWatchlist = useMarketStore((s) => s.addToWatchlist);
  const removeFromWatchlist = useMarketStore((s) => s.removeFromWatchlist);
  const toggleFavorite = useMarketStore((s) => s.toggleFavorite);
  const { data: ratesData } = useRates();
  const quotes = ratesData?.quotes || {};

  const watchlistInstruments = INSTRUMENTS.filter((i) => watchlistIds.includes(i.id));
  const availableToAdd = INSTRUMENTS.filter((i) => !watchlistIds.includes(i.id));

  const handleRemove = (id: string) => {
    // If removing the selected instrument, switch to the first remaining
    if (selectedInstrument.id === id) {
      const remaining = watchlistInstruments.filter((i) => i.id !== id);
      if (remaining.length > 0) setSelectedInstrument(remaining[0]);
    }
    removeFromWatchlist(id);
  };

  return (
    <aside className="w-56 shrink-0 sticky top-12 h-[calc(100vh-3rem)] overflow-y-auto bg-background/60 backdrop-blur-xl border-r border-border/20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/20">
        <span className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">
          Watchlist
        </span>
        <button
          onClick={() => setAddPanelOpen(!addPanelOpen)}
          className={cn(
            "p-1 rounded-full transition-colors",
            addPanelOpen
              ? "bg-neutral-accent/15 text-neutral-accent"
              : "text-muted-foreground/50 hover:text-foreground hover:bg-[var(--surface-2)]"
          )}
          aria-label="Add instrument"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Add panel */}
      {addPanelOpen && availableToAdd.length > 0 && (
        <div className="border-b border-border/20 bg-[var(--surface-1)] py-1.5">
          <div className="px-4 py-1">
            <span className="text-[11px] text-muted-foreground/50 uppercase tracking-widest">Add instrument</span>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {CATEGORIES.map((cat) => {
              const available = availableToAdd.filter((i) => i.category === cat.key);
              if (available.length === 0) return null;
              return (
                <div key={cat.key}>
                  <div className="px-4 py-0.5">
                    <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">{cat.label}</span>
                  </div>
                  {available.map((inst) => (
                    <button
                      key={inst.id}
                      onClick={() => {
                        addToWatchlist(inst.id);
                        if (availableToAdd.length <= 1) setAddPanelOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-4 py-1.5 text-left hover:bg-[var(--surface-2)] transition-colors"
                    >
                      <span className="text-xs text-muted-foreground">{inst.symbol}</span>
                      <Plus className="h-3 w-3 text-muted-foreground/40" />
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {addPanelOpen && availableToAdd.length === 0 && (
        <div className="border-b border-border/20 bg-[var(--surface-1)] px-4 py-3">
          <span className="text-[12px] text-muted-foreground/50">All instruments added</span>
        </div>
      )}

      {/* Instrument list */}
      <div className="py-1.5">
        {CATEGORIES.map((cat, catIdx) => {
          const instruments = watchlistInstruments.filter((i) => i.category === cat.key);
          if (instruments.length === 0) return null;
          return (
            <div key={cat.key}>
              {catIdx > 0 && instruments.length > 0 && <div className="h-px bg-border/20 mx-3 my-1.5" />}
              <div className="px-4 py-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  {cat.label}
                </span>
              </div>
              {instruments.map((inst) => {
                const isActive = selectedInstrument.id === inst.id;
                const isFavorite = favoriteIds.includes(inst.id);
                const wsQuote = realtimeQuotes[inst.id];
                const quote = quotes[inst.id];
                const displayPrice = wsQuote?.price || quote?.mid || 0;
                const changePercent = quote?.changePercent || 0;
                const canRemove = watchlistIds.length > 1;

                return (
                  <div
                    key={inst.id}
                    className={cn(
                      "group w-full flex items-center px-4 py-2 transition-colors",
                      isActive
                        ? "bg-[var(--surface-2)] border-l-2 border-l-neutral-accent"
                        : isFavorite
                          ? "bg-amber-500/[0.04] border-l-2 border-l-amber-500/40 hover:bg-amber-500/[0.07]"
                          : "hover:bg-[var(--surface-1)] border-l-2 border-l-transparent"
                    )}
                  >
                    {/* Star toggle */}
                    <button
                      onClick={() => toggleFavorite(inst.id)}
                      className={cn(
                        "mr-1.5 p-0.5 rounded transition-all shrink-0",
                        isFavorite
                          ? "text-amber-500 opacity-100"
                          : "text-muted-foreground/20 opacity-0 group-hover:opacity-100 hover:text-amber-500"
                      )}
                      aria-label={isFavorite ? `Unfavorite ${inst.symbol}` : `Favorite ${inst.symbol}`}
                    >
                      <Star className={cn("h-3 w-3", isFavorite && "fill-amber-500")} />
                    </button>

                    <button
                      onClick={() => setSelectedInstrument(inst)}
                      className="flex-1 flex items-center justify-between text-left cursor-pointer min-w-0"
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
                            <span className="font-mono text-[13px] text-foreground">
                              <AnimatedNumber
                                value={displayPrice}
                                format={(n) => n.toFixed(Math.min(inst.decimalPlaces, 4))}
                                className="text-[13px]"
                              />
                            </span>
                            {changePercent !== 0 && (
                              <span className={cn("font-mono text-[11px]", getChangeClass(changePercent))}>
                                {changePercent > 0 ? "+" : ""}{changePercent.toFixed(2)}%
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[12px] text-muted-foreground/30">--</span>
                        )}
                      </div>
                    </button>
                    {canRemove && (
                      <button
                        onClick={() => handleRemove(inst.id)}
                        className="ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-foreground hover:bg-[var(--surface-2)]"
                        aria-label={`Remove ${inst.symbol}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
