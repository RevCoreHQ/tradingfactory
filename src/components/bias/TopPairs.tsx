"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { useMarketStore } from "@/lib/store/market-store";
import { getBiasColor, getBiasLabel } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { BiasDirection } from "@/lib/types/bias";

function DirectionBadge({ direction }: { direction: BiasDirection }) {
  const label = getBiasLabel(direction);
  const isBullish = direction.includes("bullish");
  const isBearish = direction.includes("bearish");

  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider leading-none",
        isBullish && "bg-bullish/15 text-bullish",
        isBearish && "bg-bearish/15 text-bearish",
        !isBullish && !isBearish && "bg-neutral-accent/15 text-neutral-accent"
      )}
    >
      {label}
    </span>
  );
}

function ConvictionList({
  timeframeKey,
  label,
}: {
  timeframeKey: "intraday" | "intraweek";
  label: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const allBiasResults = useMarketStore((s) => s.allBiasResults);
  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument);
  const router = useRouter();

  const currentResults = allBiasResults[timeframeKey];

  const ranked = INSTRUMENTS
    .map((inst) => {
      const bias = currentResults[inst.id];
      return {
        instrument: inst,
        bias: bias?.overallBias || 0,
        direction: bias?.direction || ("neutral" as BiasDirection),
        confidence: bias?.confidence || 0,
        fundamentalTotal: bias?.fundamentalScore?.total || 50,
        technicalTotal: bias?.technicalScore?.total || 50,
      };
    })
    .sort((a, b) => Math.abs(b.bias) - Math.abs(a.bias));

  const hasAnyBias = ranked.some((r) => Math.abs(r.bias) > 2);
  const displayCount = expanded ? ranked.length : 5;
  const displayed = ranked.slice(0, displayCount);

  return (
    <div className="flex-1 min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-3">
        {label}
      </div>

      {!hasAnyBias ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          Calculating bias scores...
        </p>
      ) : (
        <div className="space-y-0.5">
          {displayed.map((item, idx) => {
            const absBias = Math.abs(item.bias);
            const color = getBiasColor(item.direction);
            const isBullish = item.bias > 0;
            const isTopPick = idx === 0;

            return (
              <button
                key={item.instrument.id}
                onClick={() => {
                  setSelectedInstrument(item.instrument);
                  router.push("/instrument");
                }}
                className={cn(
                  "flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg transition-colors cursor-pointer group",
                  isTopPick ? "bg-surface-2" : "hover:bg-surface-2"
                )}
                style={isTopPick ? { borderLeft: `3px solid ${color}` } : undefined}
              >
                {/* Rank */}
                <span className="text-[11px] text-muted-foreground/40 w-4 font-mono tabular">
                  {idx + 1}
                </span>

                {/* Symbol */}
                <span className={cn(
                  "font-bold shrink-0 w-[72px]",
                  isTopPick ? "text-sm" : "text-xs"
                )}>
                  {item.instrument.symbol}
                </span>

                {/* Direction badge */}
                <DirectionBadge direction={item.direction} />

                {/* Spacer */}
                <div className="flex-1" />

                {/* F/T mini scores */}
                <span className="text-[10px] font-mono text-muted-foreground hidden sm:block">
                  F:{Math.round(item.fundamentalTotal)} T:{Math.round(item.technicalTotal)}
                </span>

                {/* Conviction score */}
                <span
                  className={cn(
                    "font-mono font-bold tabular text-right w-12",
                    isTopPick ? "text-xl" : "text-sm"
                  )}
                  style={{ color }}
                >
                  {isBullish ? "+" : ""}{Math.round(item.bias)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {hasAnyBias && ranked.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-2 px-3"
        >
          {expanded ? (
            <>
              Show top 5 <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              Show all {ranked.length} <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

export function TopPairs() {
  return (
    <div className="panel rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Conviction Board
        </h3>
        <span className="text-[10px] font-mono text-muted-foreground">
          {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
        </span>
      </div>

      {/* Side-by-side on desktop, stacked on mobile */}
      <div className="flex flex-col lg:flex-row lg:gap-6 gap-6">
        <ConvictionList timeframeKey="intraday" label="Intraday" />
        <div className="hidden lg:block w-px bg-border self-stretch" />
        <ConvictionList timeframeKey="intraweek" label="Intraweek" />
      </div>
    </div>
  );
}
