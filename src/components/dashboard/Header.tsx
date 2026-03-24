"use client";

import { useMarketStore } from "@/lib/store/market-store";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AlertsBell } from "@/components/alerts/AlertsPanel";
import { SetupNotificationsBadge } from "./SetupNotifications";
import { DataFeedStatus } from "./DataFeedStatus";

interface HeaderProps {
  mode?: "overview" | "desk" | "analysis" | "journal" | "brain" | "testing";
}

export function Header({ mode = "analysis" }: HeaderProps) {
  const wsConnected = useMarketStore((s) => s.wsConnected);

  return (
    <header className="h-12 sticky top-0 z-50 bg-background/60 backdrop-blur-2xl backdrop-saturate-150 border-b border-border/20 shadow-[0_1px_2px_oklch(0_0_0/0.03)] dark:bg-background/50 dark:border-border/15 dark:shadow-[0_1px_4px_oklch(0_0_0/0.4),inset_0_1px_0_oklch(1_0_0/0.03)]">
      <div className="h-full px-3 md:px-8 flex items-center justify-between gap-2">
        {/* Left: Logo */}
        <Link href="/" className="flex items-baseline gap-1.5 shrink-0">
          <span className="text-sm font-bold tracking-tight text-gradient-teal">Trading</span>
          <span className="text-sm font-light tracking-tight text-muted-foreground/80 hidden sm:inline">Factory</span>
        </Link>

        {/* Center: Segmented control */}
        <div className="flex items-center gap-0.5 bg-[var(--surface-1)] rounded-full p-0.5 border border-border/30 overflow-x-auto no-scrollbar">
          <Link
            href="/"
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
              mode === "overview"
                ? "bg-background text-foreground shadow-[0_1px_3px_oklch(0_0_0/0.08)] dark:shadow-[0_1px_5px_oklch(0_0_0/0.3),inset_0_1px_0_oklch(1_0_0/0.05)]"
                : "text-muted-foreground hover:text-foreground/80 transition-all duration-200"
            )}
          >
            Overview
          </Link>
          <Link
            href="/desk"
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
              mode === "desk"
                ? "bg-background text-foreground shadow-[0_1px_3px_oklch(0_0_0/0.08)] dark:shadow-[0_1px_5px_oklch(0_0_0/0.3),inset_0_1px_0_oklch(1_0_0/0.05)]"
                : "text-muted-foreground hover:text-foreground/80 transition-all duration-200"
            )}
          >
            Desk
          </Link>
          <Link
            href="/instrument"
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
              mode === "analysis"
                ? "bg-background text-foreground shadow-[0_1px_3px_oklch(0_0_0/0.08)] dark:shadow-[0_1px_5px_oklch(0_0_0/0.3),inset_0_1px_0_oklch(1_0_0/0.05)]"
                : "text-muted-foreground hover:text-foreground/80 transition-all duration-200"
            )}
          >
            Analysis
          </Link>
          <Link
            href="/journal"
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
              mode === "journal"
                ? "bg-background text-foreground shadow-[0_1px_3px_oklch(0_0_0/0.08)] dark:shadow-[0_1px_5px_oklch(0_0_0/0.3),inset_0_1px_0_oklch(1_0_0/0.05)]"
                : "text-muted-foreground hover:text-foreground/80 transition-all duration-200"
            )}
          >
            Journal
          </Link>
          <Link
            href="/brain"
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
              mode === "brain"
                ? "bg-background text-foreground shadow-[0_1px_3px_oklch(0_0_0/0.08)] dark:shadow-[0_1px_5px_oklch(0_0_0/0.3),inset_0_1px_0_oklch(1_0_0/0.05)]"
                : "text-muted-foreground hover:text-foreground/80 transition-all duration-200"
            )}
          >
            Brain
          </Link>
          <Link
            href="/testing"
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
              mode === "testing"
                ? "bg-background text-foreground shadow-[0_1px_3px_oklch(0_0_0/0.08)] dark:shadow-[0_1px_5px_oklch(0_0_0/0.3),inset_0_1px_0_oklch(1_0_0/0.05)]"
                : "text-muted-foreground hover:text-foreground/80 transition-all duration-200"
            )}
          >
            Testing
          </Link>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 px-1 md:px-2 mr-0.5 md:mr-1">
            <span className={cn(
              "h-1.5 w-1.5 rounded-full pulse-dot",
              wsConnected ? "bg-bullish" : "bg-amber-500"
            )} />
            <span className={cn(
              "text-[12px] font-medium hidden sm:inline",
              wsConnected ? "text-bullish" : "text-amber-500"
            )}>
              {wsConnected ? "Live" : "Polling"}
            </span>
          </div>

          <div className="hidden md:block">
            <DataFeedStatus />
          </div>

          <SetupNotificationsBadge />

          <AlertsBell />

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
