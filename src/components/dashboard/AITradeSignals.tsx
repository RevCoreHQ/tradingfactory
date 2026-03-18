"use client";

import { useMarketStore } from "@/lib/store/market-store";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { getBiasColor, getBiasLabel } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

export function AITradeSignals() {
  const batchLLMResults = useMarketStore((s) => s.batchLLMResults);
  const allBiasResults = useMarketStore((s) => s.allBiasResults);
  const biasTimeframe = useMarketStore((s) => s.biasTimeframe);
  const currentResults = allBiasResults[biasTimeframe];

  if (!batchLLMResults) {
    return (
      <div className="panel rounded-lg p-4 h-full">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            AI Trade Signals
          </h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-1/3 shimmer rounded" />
              <div className="h-3 w-full shimmer rounded" />
              <div className="h-2 w-2/3 shimmer rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Rank instruments by |biasAdjustment| from LLM
  const ranked = INSTRUMENTS
    .map((inst) => {
      const llm = batchLLMResults[inst.id];
      const bias = currentResults[inst.id];
      if (!llm || !bias) return null;
      return {
        instrument: inst,
        llm,
        bias,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b!.llm.biasAdjustment) - Math.abs(a!.llm.biasAdjustment))
    .slice(0, 5) as { instrument: typeof INSTRUMENTS[number]; llm: typeof batchLLMResults[string]; bias: typeof currentResults[string] }[];

  return (
    <div className="panel rounded-lg p-4 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-3.5 w-3.5 text-neutral-accent" />
        <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          AI Trade Signals
        </h3>
        <span className="text-[9px] font-mono text-muted-foreground/40 ml-auto">
          Top {ranked.length} by AI conviction
        </span>
      </div>

      <div className="space-y-3">
        {ranked.map(({ instrument, llm, bias }) => {
          const color = getBiasColor(bias.direction);
          const adj = llm.biasAdjustment;

          return (
            <div
              key={instrument.id}
              className={cn(
                "rounded-md p-3 bg-[var(--surface-2)]",
                adj > 0 ? "accent-bullish" : adj < 0 ? "accent-bearish" : "accent-neutral"
              )}
            >
              {/* Header row */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold text-foreground">{instrument.symbol}</span>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color }}
                >
                  {getBiasLabel(bias.direction)}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                  AI: {adj > 0 ? "+" : ""}{adj.toFixed(0)}
                </span>
              </div>

              {/* Summary */}
              {llm.summary && (
                <p className="text-[11px] text-muted-foreground leading-snug mb-2">
                  {llm.summary}
                </p>
              )}

              {/* Signal bars */}
              {llm.signals.length > 0 && (
                <div className="space-y-1">
                  {llm.signals.slice(0, 3).map((signal, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-[var(--surface-3)] overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            signal.signal === "bullish" ? "bg-bullish" : signal.signal === "bearish" ? "bg-bearish" : "bg-neutral-accent"
                          )}
                          style={{ width: `${signal.strength}%`, opacity: 0.7 }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground/60 w-24 truncate text-right">
                        {signal.source.replace("LLM: ", "")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
