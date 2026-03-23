"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { BacktestTrade } from "@/lib/types/backtest";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  trades: BacktestTrade[];
}

type SortKey = "index" | "conviction" | "rMultiple" | "barsInTrade";

function OutcomeBadge({ outcome }: { outcome: BacktestTrade["outcome"] }) {
  const config: Record<string, { label: string; classes: string }> = {
    win: { label: "WIN", classes: "bg-bullish/15 text-bullish" },
    loss: { label: "LOSS", classes: "bg-bearish/15 text-bearish" },
    breakeven: { label: "BE", classes: "bg-amber-500/15 text-amber-700 dark:text-amber-500" },
    expired: { label: "EXP", classes: "bg-muted-foreground/15 text-muted-foreground" },
    still_open: { label: "OPEN", classes: "bg-neutral-accent/15 text-neutral-accent" },
  };
  const c = config[outcome] ?? config.expired;
  return (
    <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded", c.classes)}>
      {c.label}
    </span>
  );
}

export function TradeLog({ trades }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("index");
  const [sortAsc, setSortAsc] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    const list = [...trades];
    list.sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case "index": diff = a.signalBarIndex - b.signalBarIndex; break;
        case "conviction": diff = a.convictionScore - b.convictionScore; break;
        case "rMultiple": diff = a.rMultiple - b.rMultiple; break;
        case "barsInTrade": diff = a.barsInTrade - b.barsInTrade; break;
      }
      return sortAsc ? diff : -diff;
    });
    return list;
  }, [trades, sortKey, sortAsc]);

  const displayed = showAll ? sorted : sorted.slice(0, 50);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortIcon = sortAsc ? ChevronUp : ChevronDown;

  const fmtDate = (ts: number | null) => {
    if (!ts) return "—";
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="section-card">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
        <span className="text-xs font-semibold text-foreground">Trade Log</span>
        <span className="text-[11px] font-mono text-muted-foreground/40">
          {trades.length} trades
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/20">
              <th className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground/50 uppercase cursor-pointer" onClick={() => toggleSort("index")}>
                # {sortKey === "index" && <SortIcon className="inline h-3 w-3" />}
              </th>
              <th className="px-2 py-2 text-left text-[10px] font-bold text-muted-foreground/50 uppercase">Time</th>
              <th className="px-2 py-2 text-left text-[10px] font-bold text-muted-foreground/50 uppercase">Dir</th>
              <th className="px-2 py-2 text-left text-[10px] font-bold text-muted-foreground/50 uppercase cursor-pointer" onClick={() => toggleSort("conviction")}>
                Conv {sortKey === "conviction" && <SortIcon className="inline h-3 w-3" />}
              </th>
              <th className="px-2 py-2 text-right text-[10px] font-bold text-muted-foreground/50 uppercase">Entry</th>
              <th className="px-2 py-2 text-right text-[10px] font-bold text-muted-foreground/50 uppercase">Exit</th>
              <th className="px-2 py-2 text-center text-[10px] font-bold text-muted-foreground/50 uppercase">Outcome</th>
              <th className="px-2 py-2 text-right text-[10px] font-bold text-muted-foreground/50 uppercase cursor-pointer" onClick={() => toggleSort("rMultiple")}>
                R {sortKey === "rMultiple" && <SortIcon className="inline h-3 w-3" />}
              </th>
              <th className="px-2 py-2 text-right text-[10px] font-bold text-muted-foreground/50 uppercase cursor-pointer" onClick={() => toggleSort("barsInTrade")}>
                Bars {sortKey === "barsInTrade" && <SortIcon className="inline h-3 w-3" />}
              </th>
              <th className="px-2 py-2 text-left text-[10px] font-bold text-muted-foreground/50 uppercase">Systems</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((trade, idx) => (
              <tr key={trade.id} className="border-b border-border/5 hover:bg-[var(--surface-1)]/50 transition-colors">
                <td className="px-3 py-2 font-mono text-muted-foreground/50">{idx + 1}</td>
                <td className="px-2 py-2 font-mono text-muted-foreground/60">{fmtDate(trade.signalTimestamp)}</td>
                <td className="px-2 py-2">
                  <span className={cn("font-semibold uppercase text-[12px]", trade.direction === "bullish" ? "text-bullish" : "text-bearish")}>
                    {trade.direction === "bullish" ? "LONG" : "SHORT"}
                  </span>
                </td>
                <td className="px-2 py-2">
                  <span className="text-[12px] font-bold text-foreground">{trade.conviction}</span>
                  <span className="text-[11px] text-muted-foreground/40 ml-1">{trade.convictionScore}</span>
                </td>
                <td className="px-2 py-2 text-right font-mono">{trade.entryPrice?.toFixed(4) ?? "—"}</td>
                <td className="px-2 py-2 text-right font-mono">{trade.exitPrice?.toFixed(4) ?? "—"}</td>
                <td className="px-2 py-2 text-center"><OutcomeBadge outcome={trade.outcome} /></td>
                <td className={cn("px-2 py-2 text-right font-mono font-bold", trade.rMultiple > 0 ? "text-bullish" : trade.rMultiple < 0 ? "text-bearish" : "text-muted-foreground")}>
                  {trade.rMultiple > 0 ? "+" : ""}{trade.rMultiple.toFixed(2)}R
                </td>
                <td className="px-2 py-2 text-right font-mono text-muted-foreground/50">{trade.barsInTrade}</td>
                <td className="px-2 py-2 text-[11px] text-muted-foreground/40 max-w-32 truncate">
                  {trade.agreeingSystems.join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {trades.length > 50 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-2 text-[12px] text-neutral-accent hover:text-neutral-accent/80 font-medium transition-colors border-t border-border/20"
        >
          Show all {trades.length} trades
        </button>
      )}
    </div>
  );
}
