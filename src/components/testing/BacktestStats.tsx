"use client";

import { cn } from "@/lib/utils";
import type { BacktestStats as BacktestStatsType } from "@/lib/types/backtest";

interface Props {
  stats: BacktestStatsType;
}

function StatCard({ label, value, suffix, positive, format }: {
  label: string;
  value: number;
  suffix?: string;
  positive?: boolean;
  format?: "percent" | "decimal" | "ratio" | "integer";
}) {
  const fmt = format ?? "decimal";
  let display: string;
  if (fmt === "percent") display = `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  else if (fmt === "ratio") display = value === Infinity ? "∞" : value.toFixed(2);
  else if (fmt === "integer") display = Math.round(value).toString();
  else display = value.toFixed(2);

  const isPositive = positive ?? value > 0;

  return (
    <div className="section-card p-4">
      <div className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-2">
        {label}
      </div>
      <div className={cn(
        "text-2xl font-black font-mono tracking-tight",
        isPositive ? "text-bullish" : value < 0 ? "text-bearish" : "text-foreground"
      )}>
        {display}{suffix && <span className="text-sm font-medium text-muted-foreground/40 ml-0.5">{suffix}</span>}
      </div>
    </div>
  );
}

export function BacktestStats({ stats }: Props) {
  return (
    <div className="space-y-4">
      {/* Primary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Win Rate"
          value={stats.winRate * 100}
          format="percent"
          positive={stats.winRate >= 0.5}
        />
        <StatCard
          label="Expectancy"
          value={stats.expectancy}
          suffix="R"
          format="decimal"
        />
        <StatCard
          label="Profit Factor"
          value={stats.profitFactor}
          format="ratio"
          positive={stats.profitFactor > 1}
        />
        <StatCard
          label="Sharpe Ratio"
          value={stats.sharpeRatio}
          format="decimal"
        />
        <StatCard
          label="Max Drawdown"
          value={-stats.maxDrawdownPercent}
          format="percent"
          positive={stats.maxDrawdownPercent < 10}
        />
        <StatCard
          label="Total Return"
          value={stats.totalReturnPercent}
          format="percent"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <div className="section-card px-3 py-2">
          <div className="text-[10px] font-bold text-muted-foreground/50 uppercase">Trades</div>
          <div className="text-sm font-bold text-foreground">{stats.totalTrades}</div>
        </div>
        <div className="section-card px-3 py-2">
          <div className="text-[10px] font-bold text-muted-foreground/50 uppercase">W/L/BE</div>
          <div className="text-sm font-bold">
            <span className="text-bullish">{stats.wins}</span>
            <span className="text-muted-foreground/30"> / </span>
            <span className="text-bearish">{stats.losses}</span>
            <span className="text-muted-foreground/30"> / </span>
            <span className="text-muted-foreground">{stats.breakevens}</span>
          </div>
        </div>
        <div className="section-card px-3 py-2">
          <div className="text-[10px] font-bold text-muted-foreground/50 uppercase">Avg Win R</div>
          <div className="text-sm font-bold text-bullish">{stats.avgWinR.toFixed(2)}</div>
        </div>
        <div className="section-card px-3 py-2">
          <div className="text-[10px] font-bold text-muted-foreground/50 uppercase">Avg Loss R</div>
          <div className="text-sm font-bold text-bearish">-{stats.avgLossR.toFixed(2)}</div>
        </div>
        <div className="section-card px-3 py-2">
          <div className="text-[10px] font-bold text-muted-foreground/50 uppercase">Recovery</div>
          <div className="text-sm font-bold text-foreground">{stats.recoveryFactor.toFixed(1)}x</div>
        </div>
        <div className="section-card px-3 py-2">
          <div className="text-[10px] font-bold text-muted-foreground/50 uppercase">Avg Bars</div>
          <div className="text-sm font-bold text-foreground">{stats.avgBarsInTrade.toFixed(1)}</div>
        </div>
      </div>
    </div>
  );
}
