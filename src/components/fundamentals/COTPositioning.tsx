"use client";

import { useCOTData } from "@/lib/hooks/useMarketData";
import { useMarketStore } from "@/lib/store/market-store";
import { INSTRUMENT_COT_MAP } from "@/lib/types/cot";
import type { COTPosition } from "@/lib/types/cot";
import { GlassCard } from "@/components/common/GlassCard";
import { cn } from "@/lib/utils";
import { Users, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";

function PositionBar({ percentLong }: { percentLong: number }) {
  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-[11px] font-mono text-bullish w-8 text-right">{percentLong}%</span>
      <div className="flex-1 h-2 rounded-full bg-[var(--surface-3)] overflow-hidden flex">
        <div
          className="h-full bg-bullish/70 rounded-l-full transition-all duration-500"
          style={{ width: `${percentLong}%` }}
        />
        <div
          className="h-full bg-bearish/70 rounded-r-full transition-all duration-500"
          style={{ width: `${100 - percentLong}%` }}
        />
      </div>
      <span className="text-[11px] font-mono text-bearish w-8">{100 - percentLong}%</span>
    </div>
  );
}

function formatContracts(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function CurrencyRow({ position, isRelevant }: { position: COTPosition; isRelevant: boolean }) {
  const isNetLong = position.netSpeculative > 0;
  const changePositive = position.netSpecChange > 0;

  return (
    <div className={cn(
      "rounded-lg p-3 border transition-colors",
      isRelevant ? "border-neutral-accent/20 bg-neutral-accent/5" : "border-transparent bg-[var(--surface-1)]"
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground">{position.currency}</span>
          <span className={cn(
            "flex items-center gap-0.5 text-[12px] font-semibold",
            isNetLong ? "text-bullish" : "text-bearish"
          )}>
            {isNetLong ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isNetLong ? "Net Long" : "Net Short"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-mono text-muted-foreground">
            {formatContracts(position.netSpeculative)}
          </span>
          {position.netSpecChange !== 0 && (
            <span className={cn(
              "flex items-center gap-0.5 text-[11px] font-mono",
              changePositive ? "text-bullish" : "text-bearish"
            )}>
              {changePositive ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
              {formatContracts(Math.abs(position.netSpecChange))}
            </span>
          )}
        </div>
      </div>
      <PositionBar percentLong={position.percentLong} />
    </div>
  );
}

export function COTPositioning() {
  const { data, isLoading } = useCOTData();
  const instrument = useMarketStore((s) => s.selectedInstrument);
  const cotMapping = INSTRUMENT_COT_MAP[instrument.id];

  if (isLoading) {
    return (
      <GlassCard delay={0.1}>
        <div className="space-y-3">
          <div className="h-4 w-1/3 shimmer rounded" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 shimmer rounded-lg" />
          ))}
        </div>
      </GlassCard>
    );
  }

  const positions = data?.positions || [];
  if (positions.length === 0) {
    return (
      <GlassCard delay={0.1}>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-neutral-accent" />
          <h3 className="text-xs font-semibold text-foreground">COT Positioning</h3>
        </div>
        <p className="text-[12px] text-muted-foreground/50 text-center py-4">
          No COT data available — CFTC reports update weekly (Tuesdays)
        </p>
      </GlassCard>
    );
  }

  // Get COT signal for current instrument
  const relevantPosition = cotMapping
    ? positions.find((p) => p.currency === cotMapping.currency)
    : null;

  let cotSignal = "";
  let cotColor = "";
  if (relevantPosition && cotMapping) {
    const effectiveNet = cotMapping.invert
      ? -relevantPosition.netSpeculative
      : relevantPosition.netSpeculative;
    const effectiveChange = cotMapping.invert
      ? -relevantPosition.netSpecChange
      : relevantPosition.netSpecChange;

    if (effectiveNet > 0 && effectiveChange > 0) {
      cotSignal = "Specs adding longs — bullish";
      cotColor = "text-bullish";
    } else if (effectiveNet > 0 && effectiveChange < 0) {
      cotSignal = "Specs trimming longs — caution";
      cotColor = "text-amber-500";
    } else if (effectiveNet < 0 && effectiveChange < 0) {
      cotSignal = "Specs adding shorts — bearish";
      cotColor = "text-bearish";
    } else if (effectiveNet < 0 && effectiveChange > 0) {
      cotSignal = "Specs covering shorts — caution";
      cotColor = "text-amber-500";
    }
  }

  return (
    <GlassCard delay={0.1}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-neutral-accent" />
          <h3 className="text-xs font-semibold text-foreground">COT Positioning</h3>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground/50">
          {data?.lastUpdated ? `Report: ${data.lastUpdated}` : ""}
        </span>
      </div>

      {/* Signal for current instrument */}
      {cotSignal && (
        <div className="rounded-lg bg-[var(--surface-2)] px-3 py-2 mb-3 border border-border/30">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-muted-foreground">{instrument.symbol}:</span>
            <span className={cn("text-[12px] font-semibold", cotColor)}>{cotSignal}</span>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {positions.map((pos) => (
          <CurrencyRow
            key={pos.currency}
            position={pos}
            isRelevant={pos.currency === cotMapping?.currency}
          />
        ))}
      </div>
    </GlassCard>
  );
}
