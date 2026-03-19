"use client";

import { useMarketStore } from "@/lib/store/market-store";
import { cn } from "@/lib/utils";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AlertsBell } from "@/components/alerts/AlertsPanel";

interface HeaderProps {
  mode?: "overview" | "analysis";
}

export function Header({ mode = "analysis" }: HeaderProps) {
  const journalOpen = useMarketStore((s) => s.journalOpen);
  const setJournalOpen = useMarketStore((s) => s.setJournalOpen);
  const wsConnected = useMarketStore((s) => s.wsConnected);

  return (
    <header className="h-12 sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/30">
      <div className="h-full px-8 flex items-center justify-between">
        {/* Left: Logo */}
        <Link href="/" className="flex items-baseline gap-1.5 shrink-0">
          <span className="text-sm font-bold tracking-tight text-foreground">Trading</span>
          <span className="text-sm font-light tracking-tight text-muted-foreground">Factory</span>
        </Link>

        {/* Center: Segmented control */}
        <div className="flex items-center gap-0.5 bg-[var(--surface-1)] rounded-full p-0.5 border border-border/30">
          <Link
            href="/"
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
              mode === "overview"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Overview
          </Link>
          <Link
            href="/instrument"
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
              mode === "analysis"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Analysis
          </Link>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 px-2 mr-1">
            <span className={cn(
              "h-1.5 w-1.5 rounded-full pulse-dot",
              wsConnected ? "bg-bullish" : "bg-amber-500"
            )} />
            <span className={cn(
              "text-[10px] font-medium",
              wsConnected ? "text-bullish" : "text-amber-500"
            )}>
              {wsConnected ? "Live" : "Polling"}
            </span>
          </div>

          <button
            onClick={() => setJournalOpen(!journalOpen)}
            className={cn(
              "p-2 rounded-full transition-colors",
              journalOpen
                ? "bg-neutral-accent/15 text-neutral-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-[var(--surface-2)]"
            )}
            aria-label="Trade journal"
          >
            <BookOpen className="h-4 w-4" />
          </button>

          <AlertsBell />

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
