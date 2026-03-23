"use client";

import { cn } from "@/lib/utils";
import type { AggregateStats, BatchInstrumentResult } from "@/lib/types/backtest";
import { TrendingUp, TrendingDown, Target, Shield, BarChart3, Trophy } from "lucide-react";

interface AggregateScorecardProps {
  stats: AggregateStats;
  results: BatchInstrumentResult[];
}

export function AggregateScorecard({ stats, results }: AggregateScorecardProps) {
  return (
    <div className="space-y-5">
      {/* Primary Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Instruments w/ Edge"
          value={`${stats.instrumentsWithEdge}/${stats.totalInstruments}`}
          icon={<Target className="h-3.5 w-3.5" />}
          accent={stats.instrumentsWithEdge > stats.totalInstruments / 2 ? "green" : "amber"}
        />
        <StatCard
          label="Overall Win Rate"
          value={`${(stats.overallWinRate * 100).toFixed(1)}%`}
          icon={<BarChart3 className="h-3.5 w-3.5" />}
          accent={stats.overallWinRate >= 0.5 ? "green" : "red"}
        />
        <StatCard
          label="Expectancy"
          value={`${stats.overallExpectancy.toFixed(2)}R`}
          icon={stats.overallExpectancy >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          accent={stats.overallExpectancy > 0 ? "green" : "red"}
        />
        <StatCard
          label="Avg Max DD"
          value={`${stats.avgMaxDrawdown.toFixed(1)}%`}
          icon={<Shield className="h-3.5 w-3.5" />}
          accent={stats.avgMaxDrawdown < 15 ? "green" : "red"}
        />
      </div>

      {/* Best / Worst + Category Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Best Instrument */}
        {stats.bestInstrument && (
          <div className="glass-card rounded-xl border border-bullish/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-3.5 w-3.5 text-bullish" />
              <span className="text-[12px] font-bold text-muted-foreground/60 uppercase tracking-wider">Best</span>
            </div>
            <span className="text-lg font-black text-foreground">{stats.bestInstrument.symbol}</span>
            <span className="ml-2 text-sm font-mono text-bullish">
              {stats.bestInstrument.expectancy.toFixed(2)}R
            </span>
          </div>
        )}

        {/* Worst Instrument */}
        {stats.worstInstrument && (
          <div className="glass-card rounded-xl border border-bearish/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-3.5 w-3.5 text-bearish" />
              <span className="text-[12px] font-bold text-muted-foreground/60 uppercase tracking-wider">Worst</span>
            </div>
            <span className="text-lg font-black text-foreground">{stats.worstInstrument.symbol}</span>
            <span className="ml-2 text-sm font-mono text-bearish">
              {stats.worstInstrument.expectancy.toFixed(2)}R
            </span>
          </div>
        )}

        {/* Total Trades */}
        <div className="glass-card rounded-xl border border-border/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[12px] font-bold text-muted-foreground/60 uppercase tracking-wider">Total Trades</span>
          </div>
          <span className="text-lg font-black text-foreground">{stats.totalTrades}</span>
          <span className="ml-2 text-sm font-mono text-muted-foreground/60">
            PF {stats.overallProfitFactor.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Heat Map Grid */}
      <div>
        <h4 className="text-[12px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-2">
          Instrument Heat Map
        </h4>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5">
          {results.map((r) => {
            const finalStats = (r.improvedResult ?? r.baselineResult).stats;
            const exp = finalStats.expectancy;
            return (
              <div
                key={r.instrumentId}
                className={cn(
                  "rounded-lg p-2 text-center border transition-all",
                  r.hasEdge
                    ? "border-bullish/20 bg-bullish/10"
                    : exp < -0.2
                      ? "border-bearish/20 bg-bearish/10"
                      : "border-border/20 bg-surface-2/30"
                )}
              >
                <span className="text-[12px] font-bold text-foreground block truncate">
                  {r.symbol}
                </span>
                <span
                  className={cn(
                    "text-[11px] font-mono block",
                    exp > 0 ? "text-bullish" : exp < 0 ? "text-bearish" : "text-muted-foreground"
                  )}
                >
                  {exp.toFixed(2)}R
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Breakdown */}
      {stats.byCategory.length > 0 && (
        <div>
          <h4 className="text-[12px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-2">
            By Category
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {stats.byCategory.map((cat) => (
              <div key={cat.category} className="glass-card rounded-lg border border-border/20 p-3">
                <span className="text-[12px] font-bold text-foreground capitalize block">
                  {cat.category}
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-[12px] font-mono text-muted-foreground">
                    {cat.instruments} inst
                  </span>
                  <span className={cn(
                    "text-[12px] font-mono",
                    cat.avgExpectancy > 0 ? "text-bullish" : "text-bearish"
                  )}>
                    {cat.avgExpectancy.toFixed(2)}R
                  </span>
                  <span className="text-[12px] font-mono text-muted-foreground/50">
                    {(cat.avgWinRate * 100).toFixed(0)}% WR
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: "green" | "red" | "amber";
}) {
  const colors = {
    green: "border-bullish/20 text-bullish",
    red: "border-bearish/20 text-bearish",
    amber: "border-amber-500/20 text-amber-500",
  };

  return (
    <div className={cn("glass-card rounded-xl border p-4", colors[accent].split(" ")[0])}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={colors[accent].split(" ")[1]}>{icon}</span>
        <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <span className="text-xl font-black text-foreground">{value}</span>
    </div>
  );
}
