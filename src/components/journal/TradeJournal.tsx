"use client";

import { useMemo, useState } from "react";
import { useTradeJournal } from "@/lib/hooks/useTradeJournal";
import { INSTRUMENTS } from "@/lib/utils/constants";
import {
  calculateJournalStats,
  filterTradesForAnalytics,
  serializeJournalCsv,
  serializeJournalJson,
} from "@/lib/utils/journal-storage";
import type { JournalAnalyticsFilter } from "@/lib/types/journal";
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
  Download,
} from "lucide-react";

const DEFAULT_ANALYTICS: JournalAnalyticsFilter = {
  tier: "all",
  timeframeAlignment: "all",
  eventWindow: "all",
};

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function TradeJournal({ onClose }: { onClose: () => void }) {
  const { entries, deleteTrade } = useTradeJournal();
  const [filter, setFilter] = useState<"all" | "open" | "closed">("all");
  const [analyticsFilter, setAnalyticsFilter] = useState<JournalAnalyticsFilter>(DEFAULT_ANALYTICS);

  const fullStats = useMemo(() => calculateJournalStats(entries), [entries]);

  const statusFiltered = useMemo(() => {
    return entries.filter((e) => {
      if (filter === "open") return !e.exitPrice;
      if (filter === "closed") return !!e.exitPrice;
      return true;
    });
  }, [entries, filter]);

  const scopedEntries = useMemo(
    () => filterTradesForAnalytics(statusFiltered, analyticsFilter),
    [statusFiltered, analyticsFilter]
  );

  const stats = useMemo(() => calculateJournalStats(scopedEntries), [scopedEntries]);

  const filtered = useMemo(
    () => [...scopedEntries].sort((a, b) => b.entryTime - a.entryTime),
    [scopedEntries]
  );

  const analyticsActive =
    analyticsFilter.tier !== "all" ||
    analyticsFilter.timeframeAlignment !== "all" ||
    analyticsFilter.eventWindow !== "all";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-[var(--surface-0)] border-l border-border overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--surface-0)] border-b border-border px-4 py-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold shrink-0">Trade Journal</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Export full journal as JSON"
              onClick={() =>
                downloadTextFile(
                  `trade-journal-${format(new Date(), "yyyy-MM-dd")}.json`,
                  serializeJournalJson(entries),
                  "application/json"
                )
              }
              className="p-1.5 rounded hover:bg-[var(--surface-2)] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Export full journal as CSV"
              onClick={() =>
                downloadTextFile(
                  `trade-journal-${format(new Date(), "yyyy-MM-dd")}.csv`,
                  serializeJournalCsv(entries),
                  "text/csv;charset=utf-8"
                )
              }
              className="p-1.5 rounded hover:bg-[var(--surface-2)] text-muted-foreground hover:text-foreground transition-colors text-[10px] font-bold px-2"
            >
              CSV
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-[var(--surface-2)] transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="px-4 py-3 border-b border-border/50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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

          {analyticsActive && (
            <p className="mt-2 text-[10px] text-muted-foreground/60">
              Top row reflects status + analytics filters ({filtered.length} trades). Breakdowns below use the full journal.
            </p>
          )}

          {fullStats.closedTrades > 0 && (
            <div className="mt-3 space-y-3 border-t border-border/30 pt-2">
              <BreakdownRow title="Win rate by tier" data={fullStats.byTier} />
              <BreakdownRow title="Win rate by TF alignment" data={fullStats.byTfAlignment} />
              <BreakdownRow title="Win rate by event window" data={fullStats.byEventWindow} />
              {Object.keys(fullStats.bySetupType).length > 0 && (
                <BreakdownRow title="Win rate by setup" data={fullStats.bySetupType} />
              )}
            </div>
          )}
        </div>

        {/* Analytics filters (subset for list + top stats) */}
        <div className="px-4 py-2 border-b border-border/30 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Filter list &amp; summary</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground/70">
              Tier
              <select
                value={analyticsFilter.tier}
                onChange={(e) =>
                  setAnalyticsFilter((f) => ({
                    ...f,
                    tier: e.target.value as JournalAnalyticsFilter["tier"],
                  }))
                }
                className="rounded border border-border/50 bg-[var(--surface-1)] px-2 py-1 text-[12px] text-foreground"
              >
                <option value="all">All</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </label>
            <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground/70">
              TF at entry
              <select
                value={analyticsFilter.timeframeAlignment}
                onChange={(e) =>
                  setAnalyticsFilter((f) => ({
                    ...f,
                    timeframeAlignment: e.target.value as JournalAnalyticsFilter["timeframeAlignment"],
                  }))
                }
                className="rounded border border-border/50 bg-[var(--surface-1)] px-2 py-1 text-[12px] text-foreground"
              >
                <option value="all">All</option>
                <option value="aligned">Aligned</option>
                <option value="mixed">Mixed</option>
                <option value="counter">Counter</option>
                <option value="unspecified">Unspecified</option>
              </select>
            </label>
            <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground/70">
              Event (~90m)
              <select
                value={analyticsFilter.eventWindow}
                onChange={(e) =>
                  setAnalyticsFilter((f) => ({
                    ...f,
                    eventWindow: e.target.value as JournalAnalyticsFilter["eventWindow"],
                  }))
                }
                className="rounded border border-border/50 bg-[var(--surface-1)] px-2 py-1 text-[12px] text-foreground"
              >
                <option value="all">All</option>
                <option value="quiet">Quiet</option>
                <option value="caution">Caution</option>
                <option value="unspecified">Unspecified</option>
              </select>
            </label>
          </div>
          {analyticsActive && (
            <button
              type="button"
              onClick={() => setAnalyticsFilter(DEFAULT_ANALYTICS)}
              className="text-[11px] font-semibold text-neutral-accent hover:underline"
            >
              Clear filters
            </button>
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
              {f === "all" ? `All (${entries.length})` : f === "open" ? `Open (${fullStats.openTrades})` : `Closed (${fullStats.closedTrades})`}
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

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5 text-[11px] text-muted-foreground/40">
                    <span>Bias: {trade.biasAtEntry.overallBias > 0 ? "+" : ""}{Math.round(trade.biasAtEntry.overallBias)}</span>
                    <span>({trade.biasAtEntry.direction})</span>
                    <span>Conf: {Math.round(trade.biasAtEntry.confidence)}%</span>
                    {trade.setupType && (
                      <span className="rounded bg-[var(--surface-2)] px-1 capitalize text-[10px] text-muted-foreground/70">
                        {trade.setupType.replace(/_/g, " ")}
                      </span>
                    )}
                    {trade.biasAtEntry.confluenceTier && (
                      <span className="font-mono text-[10px]">{trade.biasAtEntry.confluenceTier}-tier</span>
                    )}
                    {trade.biasAtEntry.timeframeAlignment && (
                      <span className="text-[10px] capitalize opacity-80">TF {trade.biasAtEntry.timeframeAlignment}</span>
                    )}
                    {trade.biasAtEntry.eventWindowCaution === true && (
                      <span className="text-[10px] text-amber">Event caution</span>
                    )}
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

function BreakdownRow({
  title,
  data,
}: {
  title: string;
  data: Record<string, { trades: number; wins: number; winRate: number }>;
}) {
  const rows = Object.entries(data)
    .filter(([, v]) => v.trades > 0)
    .sort((a, b) => b[1].trades - a[1].trades);
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{title}</p>
      <div className="flex flex-wrap gap-2">
        {rows.map(([key, v]) => (
          <span key={key} className="rounded border border-border/40 px-2 py-0.5 text-[10px] text-muted-foreground">
            <span className="capitalize">{key.replace(/_/g, " ")}</span>:{" "}
            <span className={cn("font-mono font-semibold", v.winRate >= 50 ? "text-bullish" : "text-bearish")}>
              {v.winRate}%
            </span>
            <span className="opacity-60"> ({v.trades}t)</span>
          </span>
        ))}
      </div>
    </div>
  );
}
