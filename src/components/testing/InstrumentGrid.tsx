"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { BatchInstrumentResult } from "@/lib/types/backtest";
import { ChevronDown, ChevronUp, ArrowUpDown, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface InstrumentGridProps {
  results: BatchInstrumentResult[];
}

type SortKey = "symbol" | "category" | "trades" | "winRate" | "expectancy" | "profitFactor" | "maxDD" | "edge";

export function InstrumentGrid({ results }: InstrumentGridProps) {
  const [sortKey, setSortKey] = useState<SortKey>("expectancy");
  const [sortAsc, setSortAsc] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const sorted = [...results].sort((a, b) => {
    const aFinal = a.improvedResult ?? a.baselineResult;
    const bFinal = b.improvedResult ?? b.baselineResult;
    let cmp = 0;

    switch (sortKey) {
      case "symbol": cmp = a.symbol.localeCompare(b.symbol); break;
      case "category": cmp = a.category.localeCompare(b.category); break;
      case "trades": cmp = aFinal.stats.totalTrades - bFinal.stats.totalTrades; break;
      case "winRate": cmp = aFinal.stats.winRate - bFinal.stats.winRate; break;
      case "expectancy": cmp = aFinal.stats.expectancy - bFinal.stats.expectancy; break;
      case "profitFactor": cmp = aFinal.stats.profitFactor - bFinal.stats.profitFactor; break;
      case "maxDD": cmp = aFinal.stats.maxDrawdownPercent - bFinal.stats.maxDrawdownPercent; break;
      case "edge": cmp = (a.hasEdge ? 1 : 0) - (b.hasEdge ? 1 : 0); break;
    }

    return sortAsc ? cmp : -cmp;
  });

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: "symbol", label: "Symbol" },
    { key: "category", label: "Category" },
    { key: "trades", label: "Trades" },
    { key: "winRate", label: "Win Rate" },
    { key: "expectancy", label: "Expectancy" },
    { key: "profitFactor", label: "PF" },
    { key: "maxDD", label: "Max DD" },
    { key: "edge", label: "Edge" },
  ];

  return (
    <div className="glass-card rounded-2xl border border-border/30 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_0.7fr_0.6fr_0.7fr_0.8fr_0.5fr_0.7fr_0.5fr_2rem] gap-2 px-4 py-2.5 border-b border-border/20 bg-surface-2/30">
        {columns.map((col) => (
          <button
            key={col.key}
            onClick={() => handleSort(col.key)}
            className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider hover:text-foreground transition-colors text-left"
          >
            {col.label}
            {sortKey === col.key ? (
              sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-2.5 w-2.5 opacity-30" />
            )}
          </button>
        ))}
        <div /> {/* expand toggle column */}
      </div>

      {/* Rows */}
      {sorted.map((r) => {
        const finalStats = (r.improvedResult ?? r.baselineResult).stats;
        const isExpanded = expanded.has(r.instrumentId);
        const hasImprovement = r.improvement !== null;

        return (
          <div key={r.instrumentId} className="border-b border-border/10 last:border-0">
            <div
              onClick={() => toggleExpand(r.instrumentId)}
              className="grid grid-cols-[1fr_0.7fr_0.6fr_0.7fr_0.8fr_0.5fr_0.7fr_0.5fr_2rem] gap-2 px-4 py-3 hover:bg-surface-2/20 cursor-pointer transition-colors items-center"
            >
              <span className="text-[13px] font-bold text-foreground">{r.symbol}</span>
              <span className="text-[12px] text-muted-foreground capitalize">{r.category}</span>
              <span className="text-[13px] font-mono text-foreground">{finalStats.totalTrades}</span>
              <span className={cn(
                "text-[13px] font-mono",
                finalStats.winRate >= 0.5 ? "text-bullish" : "text-bearish"
              )}>
                {(finalStats.winRate * 100).toFixed(1)}%
              </span>
              <div className="flex items-center gap-1">
                <span className={cn(
                  "text-[13px] font-mono font-bold",
                  finalStats.expectancy > 0 ? "text-bullish" : "text-bearish"
                )}>
                  {finalStats.expectancy.toFixed(2)}R
                </span>
                {hasImprovement && r.improvement!.expectancyDelta > 0 && (
                  <span className="text-[10px] font-mono text-bullish bg-bullish/10 px-1 rounded">
                    +{(r.improvement!.expectancyDelta).toFixed(2)}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-[13px] font-mono",
                finalStats.profitFactor >= 1 ? "text-foreground" : "text-bearish"
              )}>
                {finalStats.profitFactor.toFixed(2)}
              </span>
              <span className={cn(
                "text-[13px] font-mono",
                finalStats.maxDrawdownPercent < 15 ? "text-foreground" : "text-bearish"
              )}>
                {finalStats.maxDrawdownPercent.toFixed(1)}%
              </span>
              <div>
                {r.hasEdge ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-bullish" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground/30" />
                )}
              </div>
              <ChevronDown className={cn(
                "h-3.5 w-3.5 text-muted-foreground/40 transition-transform",
                isExpanded && "rotate-180"
              )} />
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-1 space-y-3 bg-surface-2/10">
                {/* Before/After comparison */}
                {hasImprovement && (
                  <div className="grid grid-cols-4 gap-2">
                    <DeltaBadge
                      label="Win Rate"
                      delta={r.improvement!.winRateDelta}
                      format={(v) => `${(v * 100).toFixed(1)}%`}
                    />
                    <DeltaBadge
                      label="Expectancy"
                      delta={r.improvement!.expectancyDelta}
                      format={(v) => `${v.toFixed(2)}R`}
                    />
                    <DeltaBadge
                      label="Profit Factor"
                      delta={r.improvement!.profitFactorDelta}
                      format={(v) => v.toFixed(2)}
                    />
                    <DeltaBadge
                      label="Max DD"
                      delta={r.improvement!.maxDDDelta}
                      format={(v) => `${v.toFixed(1)}%`}
                      invertColor
                    />
                  </div>
                )}

                {/* Sweep Variants Table */}
                {r.sweepVariants.length > 0 && (
                  <div>
                    <h5 className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1.5">
                      Parameter Sweep ({r.sweepVariants.length} variants tested)
                    </h5>
                    <div className="rounded-lg border border-border/15 overflow-hidden">
                      <div className="grid grid-cols-[1.2fr_0.7fr_0.8fr_0.7fr_0.6fr_0.5fr] gap-1 px-3 py-1.5 bg-surface-2/30 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider">
                        <span>Variant</span>
                        <span>Trades</span>
                        <span>Win Rate</span>
                        <span>Expectancy</span>
                        <span>PF</span>
                        <span>Score</span>
                      </div>
                      {/* Baseline row */}
                      <div className="grid grid-cols-[1.2fr_0.7fr_0.8fr_0.7fr_0.6fr_0.5fr] gap-1 px-3 py-1 text-[11px] font-mono border-t border-border/10 bg-surface-2/10">
                        <span className="font-semibold text-muted-foreground">Baseline</span>
                        <span className="text-muted-foreground">{r.baselineResult.stats.totalTrades}</span>
                        <span className="text-muted-foreground">{(r.baselineResult.stats.winRate * 100).toFixed(1)}%</span>
                        <span className="text-muted-foreground">{r.baselineResult.stats.expectancy.toFixed(2)}R</span>
                        <span className="text-muted-foreground">{r.baselineResult.stats.profitFactor.toFixed(2)}</span>
                        <span className="text-muted-foreground/40">—</span>
                      </div>
                      {/* Variant rows sorted by score */}
                      {[...r.sweepVariants]
                        .sort((a, b) => b.score - a.score)
                        .map((v, vi) => {
                          const isBest = r.bestVariant?.label === v.label;
                          return (
                            <div
                              key={vi}
                              className={cn(
                                "grid grid-cols-[1.2fr_0.7fr_0.8fr_0.7fr_0.6fr_0.5fr] gap-1 px-3 py-1 text-[11px] font-mono border-t border-border/10",
                                isBest && "bg-bullish/5"
                              )}
                            >
                              <span className={cn("font-semibold", isBest ? "text-bullish" : "text-foreground")}>
                                {v.label} {isBest && "★"}
                              </span>
                              <span className="text-muted-foreground">{v.stats.totalTrades}</span>
                              <span className={v.stats.winRate >= r.baselineResult.stats.winRate ? "text-bullish" : "text-bearish"}>
                                {(v.stats.winRate * 100).toFixed(1)}%
                              </span>
                              <span className={v.stats.expectancy > r.baselineResult.stats.expectancy ? "text-bullish" : "text-bearish"}>
                                {v.stats.expectancy.toFixed(2)}R
                              </span>
                              <span className={v.stats.profitFactor >= r.baselineResult.stats.profitFactor ? "text-foreground" : "text-bearish"}>
                                {v.stats.profitFactor.toFixed(2)}
                              </span>
                              <span className="text-muted-foreground/60">{v.score.toFixed(2)}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Weaknesses */}
                {r.weaknesses.length > 0 && (
                  <div>
                    <h5 className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1.5">
                      Weaknesses ({r.weaknesses.length})
                    </h5>
                    <div className="space-y-1">
                      {r.weaknesses.slice(0, 3).map((w, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <AlertTriangle className={cn(
                            "h-3 w-3 mt-0.5 shrink-0",
                            w.severity === "critical" ? "text-bearish" : "text-amber-500"
                          )} />
                          <div>
                            <span className="text-[12px] font-semibold text-foreground">{w.area}</span>
                            <span className="text-[11px] text-muted-foreground/60 ml-1.5">{w.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {results.length === 0 && (
        <div className="px-4 py-8 text-center text-[13px] text-muted-foreground/40">
          No results yet. Run the Weekend Lab to see instrument data.
        </div>
      )}
    </div>
  );
}

function DeltaBadge({
  label,
  delta,
  format,
  invertColor = false,
}: {
  label: string;
  delta: number;
  format: (v: number) => string;
  invertColor?: boolean;
}) {
  const isPositive = invertColor ? delta < 0 : delta > 0;
  return (
    <div className={cn(
      "rounded-lg p-2 border text-center",
      isPositive ? "border-bullish/20 bg-bullish/5" : "border-bearish/20 bg-bearish/5"
    )}>
      <span className="text-[10px] font-bold text-muted-foreground/50 uppercase block">{label}</span>
      <span className={cn(
        "text-[13px] font-mono font-bold",
        isPositive ? "text-bullish" : "text-bearish"
      )}>
        {delta > 0 ? "+" : ""}{format(delta)}
      </span>
    </div>
  );
}
