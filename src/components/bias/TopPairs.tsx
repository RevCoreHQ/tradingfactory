"use client";

import { INSTRUMENTS } from "@/lib/utils/constants";
import { useMarketStore } from "@/lib/store/market-store";
import { GlassCard } from "@/components/common/GlassCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { getBiasLabel, getBiasColor } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

export function TopPairs() {
  const biasResults = useMarketStore((s) => s.biasResults);
  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument);

  // Sort instruments by absolute bias value (highest conviction first)
  const ranked = INSTRUMENTS
    .map((inst) => {
      const bias = biasResults[inst.id];
      return {
        instrument: inst,
        bias: bias?.overallBias || 0,
        direction: bias?.direction || "neutral",
        confidence: bias?.confidence || 0,
      };
    })
    .sort((a, b) => Math.abs(b.bias) - Math.abs(a.bias));

  const hasAnyBias = ranked.some((r) => Math.abs(r.bias) > 2);

  return (
    <GlassCard delay={0.2}>
      <div className="flex items-center gap-2 mb-3">
        <div className="h-7 w-7 rounded-lg bg-neutral-accent/20 flex items-center justify-center">
          <TrendingUp className="h-3.5 w-3.5 text-neutral-accent" />
        </div>
        <h3 className="text-sm font-semibold">Top Pairs by Conviction</h3>
      </div>

      {!hasAnyBias ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          Bias scores calculating... Add API keys for more accurate results.
        </p>
      ) : (
        <div className="space-y-1.5">
          {ranked.map((item, idx) => {
            const absBias = Math.abs(item.bias);
            const color = getBiasColor(item.direction);
            const isBullish = item.bias > 0;

            return (
              <button
                key={item.instrument.id}
                onClick={() => setSelectedInstrument(item.instrument)}
                className="flex items-center gap-2 w-full text-left rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-muted-foreground/50 w-4 font-mono">{idx + 1}</span>
                <span className="text-xs font-semibold w-16 shrink-0">{item.instrument.symbol}</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${absBias}%`,
                      backgroundColor: color,
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span
                  className="text-xs font-mono font-medium w-10 text-right"
                  style={{ color }}
                >
                  {isBullish ? "+" : ""}{Math.round(item.bias)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
