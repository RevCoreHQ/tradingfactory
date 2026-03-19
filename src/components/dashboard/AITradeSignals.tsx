"use client";

import { useRouter } from "next/navigation";
import { useMarketStore } from "@/lib/store/market-store";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { getBiasColor, getBiasLabel } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import { ArrowRight, Zap } from "lucide-react";

export function AITradeSignals() {
  const router = useRouter();
  const batchLLMResults = useMarketStore((s) => s.batchLLMResults);
  const batchLLMReady = useMarketStore((s) => s.batchLLMReady);
  const batchLLMError = useMarketStore((s) => s.batchLLMError);
  const allBiasResults = useMarketStore((s) => s.allBiasResults);
  const biasTimeframe = "intraday" as const;
  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument);
  const currentResults = allBiasResults[biasTimeframe];

  if (!batchLLMResults) {
    return (
      <div className="section-card p-5 h-full">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-6 w-6 rounded-md flex items-center justify-center bg-neutral-accent/15">
            <Zap className="h-3.5 w-3.5 text-neutral-accent" />
          </div>
          <h3 className="text-xs font-semibold text-foreground">AI Trade Signals</h3>
        </div>
        {batchLLMReady ? (
          <p className="text-xs text-muted-foreground/60 text-center py-8">
            {batchLLMError
              ? `AI error: ${batchLLMError}`
              : "AI analysis unavailable — check API keys in Vercel settings"}
          </p>
        ) : (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-1/3 shimmer rounded" />
                <div className="h-3 w-full shimmer rounded" />
                <div className="h-2 w-2/3 shimmer rounded" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const ranked = INSTRUMENTS
    .map((inst) => {
      const llm = batchLLMResults[inst.id];
      const bias = currentResults[inst.id];
      if (!llm || !bias) return null;
      return { instrument: inst, llm, bias };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b!.llm.biasAdjustment) - Math.abs(a!.llm.biasAdjustment))
    .slice(0, 5) as { instrument: typeof INSTRUMENTS[number]; llm: typeof batchLLMResults[string]; bias: typeof currentResults[string] }[];

  return (
    <div className="section-card p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-6 w-6 rounded-md flex items-center justify-center bg-neutral-accent/15">
          <Zap className="h-3.5 w-3.5 text-neutral-accent" />
        </div>
        <h3 className="text-xs font-semibold text-foreground">AI Trade Signals</h3>
        <span className="text-[9px] font-mono text-muted-foreground/40 ml-auto">
          Top {ranked.length} by AI conviction
        </span>
      </div>

      <div className="space-y-3">
        {ranked.map(({ instrument, llm, bias }) => {
          const color = getBiasColor(bias.direction);
          const adj = llm.biasAdjustment;

          return (
            <button
              key={instrument.id}
              onClick={() => {
                setSelectedInstrument(instrument);
                router.push("/instrument");
              }}
              className={cn(
                "rounded-lg p-3 bg-[var(--surface-2)] border border-border/30 transition-colors cursor-pointer text-left w-full group hover:border-border-bright",
                adj > 0 ? "accent-bullish" : adj < 0 ? "accent-bearish" : "accent-neutral"
              )}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold text-foreground">{instrument.symbol}</span>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color }}
                >
                  {getBiasLabel(bias.direction)}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground ml-auto flex items-center gap-1">
                  AI: {adj > 0 ? "+" : ""}{adj.toFixed(0)}
                  <ArrowRight className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
              </div>

              {llm.summary && (
                <p className="text-[11px] text-muted-foreground leading-snug mb-2">
                  {llm.summary}
                </p>
              )}

              {llm.signals.length > 0 && (
                <div className="space-y-1">
                  {llm.signals.slice(0, 2).map((signal, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            signal.signal === "bullish" ? "bg-bullish" : signal.signal === "bearish" ? "bg-bearish" : "bg-neutral-accent"
                          )}
                          style={{ width: `${signal.strength}%`, opacity: 0.8 }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground/60 w-20 truncate text-right">
                        {signal.source.replace("LLM: ", "")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
