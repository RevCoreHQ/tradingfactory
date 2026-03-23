"use client";

import { useState } from "react";
import { useTradeJournal } from "@/lib/hooks/useTradeJournal";
import { GlassCard } from "@/components/common/GlassCard";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Trophy,
  BarChart3,
  X,
  Trash2,
} from "lucide-react";

export function TradeJournal({ onClose }: { onClose: () => void }) {
  const { entries, stats, deleteTrade } = useTradeJournal();
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");

  const filtered = entries
    .filter((e) => {
      if (filter === "open") return !e.exitPrice;
      if (filter === "closed") return !!e.exitPrice;
      return true;
    })
    .sort((a, b) => b.entryTime - a.entryTime);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-[var(--surface-0)] border-l border-border overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--surface-0)] border-b border-border px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">Trade Journal</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--surface-2)] transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Stats Strip */}
        <div className="px-4 py-3 border-b border-border/50">
          <div className="grid grid-cols-4 gap-2">
            <StatPill label="Trades" value={String(stats.totalTrades)} icon={<BarChart3 className="h-3 w-3" />} />
            <StatPill
              label="Win Rate"
              value={`${stats.winRate}%`}
              icon={<Trophy className="h-3 w-3" />}
              color={stats.winRate >= 55 ? "text-bullish" : stats.winRate >= 45 ? "text-[var(--amber)]" : "text-bearish"}
            />
            <StatPill label="Avg P&L" value={`${stats.avgPnlPips}p`} icon={<Target className="h-3 w-3" />} color={stats.avgPnlPips >= 0 ? "text-bullish" : "text-bearish"} />
            <StatPill
              label="Bias Align"
              value={`${stats.biasAlignmentRate}%`}
              icon={<BarChart3 className="h-3 w-3" />}
            />
          </div>

          {stats.closedTrades > 0 && (
            <div className="flex gap-3 mt-2 text-[11px]">
              <span className="text-muted-foreground/60">
                With bias: <span className={cn("font-bold", stats.biasAlignedWinRate >= 50 ? "text-bullish" : "text-bearish")}>{stats.biasAlignedWinRate}%</span> win
              </span>
              <span className="text-muted-foreground/60">
                Against: <span className={cn("font-bold", stats.biasContraryWinRate >= 50 ? "text-bullish" : "text-bearish")}>{stats.biasContraryWinRate}%</span> win
              </span>
            </div>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-border/30">
          {(["all", "open", "closed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-2 py-1 rounded text-[12px] font-semibold transition-colors",
                filter === f
                  ? "bg-neutral-accent/15 text-neutral-accent"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "all" ? `All (${entries.length})` : f === "open" ? `Open (${stats.openTrades})` : `Closed (${stats.closedTrades})`}
            </button>
          ))}
        </div>

        {/* Trade list */}
        <div className="px-4 py-2 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xs text-muted-foreground">No trades recorded yet.</p>
              <p className="text-[12px] text-muted-foreground/50 mt-1">
                Use &quot;Log Trade&quot; on any instrument to start tracking.
              </p>
            </div>
          ) : (
            filtered.map((trade) => {
              const inst = INSTRUMENTS.find((i) => i.id === trade.instrumentId);
              const isOpen = !trade.exitPrice;
              return (
                <div
                  key={trade.id}
                  className={cn(
                    "p-3 rounded-lg border",
                    isOpen
                      ? "border-neutral-accent/30 bg-neutral-accent/5"
                      : trade.outcome === "win"
                      ? "border-bullish/20 bg-bullish/5"
                      : trade.outcome === "loss"
                      ? "border-bearish/20 bg-bearish/5"
                      : "border-border bg-[var(--surface-1)]"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {trade.direction === "long" ? (
                        <TrendingUp className="h-3 w-3 text-bullish" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-bearish" />
                      )}
                      <span className="text-xs font-bold">{inst?.symbol || trade.instrumentId}</span>
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-1 py-0.5 rounded",
                        trade.direction === "long" ? "bg-bullish/15 text-bullish" : "bg-bearish/15 text-bearish"
                      )}>
                        {trade.direction}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {trade.outcome && (
                        <span className={cn(
                          "text-[11px] font-bold px-1.5 py-0.5 rounded",
                          trade.outcome === "win"
                            ? "bg-bullish/15 text-bullish"
                            : trade.outcome === "loss"
                            ? "bg-bearish/15 text-bearish"
                            : "bg-[var(--surface-2)] text-muted-foreground"
                        )}>
                          {trade.pnlPips !== undefined ? `${trade.pnlPips > 0 ? "+" : ""}${trade.pnlPips}p` : trade.outcome.toUpperCase()}
                        </span>
                      )}
                      {isOpen && (
                        <span className="text-[10px] font-bold text-neutral-accent bg-neutral-accent/15 px-1 py-0.5 rounded">
                          OPEN
                        </span>
                      )}
                      <button
                        onClick={() => deleteTrade(trade.id)}
                        className="p-0.5 rounded hover:bg-bearish/15 transition-colors"
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground/40 hover:text-bearish" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[12px] text-muted-foreground/60">
                    <span className="font-mono">@ {trade.entryPrice}</span>
                    {trade.exitPrice && <span className="font-mono">→ {trade.exitPrice}</span>}
                    <span>{format(new Date(trade.entryTime), "MMM dd HH:mm")}</span>
                  </div>

                  {trade.notes && (
                    <p className="text-[12px] text-muted-foreground/50 mt-1">{trade.notes}</p>
                  )}

                  <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground/40">
                    <span>Bias: {trade.biasAtEntry.overallBias > 0 ? "+" : ""}{Math.round(trade.biasAtEntry.overallBias)}</span>
                    <span>({trade.biasAtEntry.direction})</span>
                    <span>Conf: {Math.round(trade.biasAtEntry.confidence)}%</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color?: string }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground/50 mb-0.5">
        {icon}
        <span className="text-[10px] uppercase">{label}</span>
      </div>
      <span className={cn("text-sm font-bold tabular", color || "text-foreground")}>{value}</span>
    </div>
  );
}
