"use client";

import type { PortfolioRisk } from "@/lib/types/signals";
import { cn } from "@/lib/utils";
import { Activity, Flame, TrendingUp, TrendingDown, Minus, Users } from "lucide-react";

interface AccountStatusBarProps {
  portfolioRisk: PortfolioRisk;
  openPositions: number;
  maxPositions: number;
}

export function AccountStatusBar({
  portfolioRisk,
  openPositions,
  maxPositions,
}: AccountStatusBarProps) {
  const {
    accountEquity,
    portfolioHeat,
    riskStatus = "CLEAR",
    dailyPnl = 0,
    dailyPnlPercent = 0,
    weeklyPnl = 0,
    weeklyPnlPercent = 0,
  } = portfolioRisk;

  const statusConfig = {
    CLEAR: { cls: "bg-bullish text-bullish-foreground", dot: "bg-bullish" },
    CAUTION: { cls: "bg-amber/80 text-black", dot: "bg-[var(--amber)] animate-pulse" },
    STOP: { cls: "bg-bearish text-bearish-foreground", dot: "bg-bearish animate-pulse" },
  };

  const sc = statusConfig[riskStatus];

  return (
    <div className="sticky top-0 z-30 border-b border-border/30 bg-background/80 backdrop-blur-md">
      <div className="max-w-[1400px] mx-auto px-8 py-2 flex items-center gap-6 text-[11px]">
        {/* Equity */}
        <div className="flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-muted-foreground/60 font-medium">Equity</span>
          <span className="font-semibold font-mono text-foreground">
            ${accountEquity.toLocaleString()}
          </span>
        </div>

        <Separator />

        {/* Daily P&L */}
        <div className="flex items-center gap-1.5">
          {dailyPnl >= 0 ? (
            <TrendingUp className="h-3 w-3 text-bullish" />
          ) : (
            <TrendingDown className="h-3 w-3 text-bearish" />
          )}
          <span className="text-muted-foreground/60 font-medium">Today</span>
          <span
            className={cn(
              "font-semibold font-mono",
              dailyPnl >= 0 ? "text-bullish" : "text-bearish"
            )}
          >
            {dailyPnl >= 0 ? "+" : ""}${Math.abs(dailyPnl).toFixed(0)}{" "}
            <span className="text-[10px] opacity-70">
              ({dailyPnlPercent >= 0 ? "+" : ""}{dailyPnlPercent.toFixed(2)}%)
            </span>
          </span>
        </div>

        <Separator />

        {/* Weekly P&L */}
        <div className="flex items-center gap-1.5 hidden md:flex">
          <span className="text-muted-foreground/60 font-medium">Week</span>
          <span
            className={cn(
              "font-semibold font-mono",
              weeklyPnl >= 0 ? "text-bullish" : "text-bearish"
            )}
          >
            {weeklyPnl >= 0 ? "+" : ""}${Math.abs(weeklyPnl).toFixed(0)}{" "}
            <span className="text-[10px] opacity-70">
              ({weeklyPnlPercent >= 0 ? "+" : ""}{weeklyPnlPercent.toFixed(2)}%)
            </span>
          </span>
        </div>

        <Separator className="hidden md:block" />

        {/* Portfolio Heat */}
        <div className="flex items-center gap-1.5">
          <Flame
            className={cn(
              "h-3 w-3",
              portfolioHeat >= 6
                ? "text-bearish"
                : portfolioHeat >= 3.6
                  ? "text-[var(--amber)]"
                  : "text-muted-foreground/50"
            )}
          />
          <span className="text-muted-foreground/60 font-medium">Heat</span>
          <span
            className={cn(
              "font-semibold font-mono",
              portfolioHeat >= 6
                ? "text-bearish"
                : portfolioHeat >= 3.6
                  ? "text-[var(--amber)]"
                  : "text-foreground"
            )}
          >
            {portfolioHeat.toFixed(1)}%
          </span>
        </div>

        <Separator />

        {/* Open Positions */}
        <div className="flex items-center gap-1.5">
          <Users className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-muted-foreground/60 font-medium">Positions</span>
          <span className="font-semibold font-mono text-foreground">
            {openPositions}/{maxPositions}
          </span>
        </div>

        {/* Risk Status - pushed to right */}
        <div className="ml-auto flex items-center gap-1.5">
          <span className={cn("h-2 w-2 rounded-full shrink-0", sc.dot)} />
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
              sc.cls
            )}
          >
            {riskStatus}
          </span>
        </div>
      </div>
    </div>
  );
}

function Separator({ className }: { className?: string }) {
  return (
    <div className={cn("h-3 w-px bg-border/40", className)} />
  );
}
