"use client";

import { useState, useMemo } from "react";
import { useMarketStore } from "@/lib/store/market-store";
import { useAuth } from "@/lib/auth/auth-provider";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AlertsBell } from "@/components/alerts/AlertsPanel";
import { SetupNotificationsBadge } from "./SetupNotifications";
import { DataFeedStatus } from "./DataFeedStatus";
import { UserMenu } from "@/components/auth/UserMenu";
import { Menu, X } from "lucide-react";

interface HeaderProps {
  mode?: "overview" | "desk" | "analysis" | "journal" | "brain" | "testing";
}

const ALL_NAV_ITEMS: {
  href: string;
  label: string;
  mode: HeaderProps["mode"];
  adminOnly?: boolean;
}[] = [
  { href: "/", label: "Overview", mode: "overview" },
  { href: "/desk", label: "Desk", mode: "desk" },
  { href: "/instrument", label: "Analysis", mode: "analysis" },
  { href: "/journal", label: "Journal", mode: "journal" },
  { href: "/brain", label: "Brain", mode: "brain", adminOnly: true },
  { href: "/testing", label: "Testing", mode: "testing" },
];

export function Header({ mode = "analysis" }: HeaderProps) {
  const wsConnected = useMarketStore((s) => s.wsConnected);
  const { isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = useMemo(
    () => ALL_NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin]
  );

  return (
    <>
      <header className="h-12 sticky top-0 z-50 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[0_4px_24px_oklch(0_0_0/0.06)] backdrop-blur-2xl backdrop-saturate-150 dark:shadow-[0_4px_28px_oklch(0_0_0/0.35),inset_0_1px_0_oklch(1_0_0/0.06)]">
        <div className="h-full px-3 md:px-8 flex items-center justify-between gap-2">
          {/* Left: Logo */}
          <Link href="/" className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-sm font-bold tracking-tight text-gradient-teal">Trading</span>
            <span className="text-sm font-light tracking-tight text-muted-foreground/80">Factory</span>
          </Link>

          {/* Center: Segmented control — desktop only */}
          <div className="hidden md:flex items-center gap-0.5 rounded-full border border-[var(--glass-border)] bg-white/30 p-0.5 backdrop-blur-xl dark:bg-white/[0.04] shrink min-w-0">
            {navItems.map((item) => (
              <Link
                key={item.mode}
                href={item.href}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                  mode === item.mode
                    ? "bg-background/90 text-foreground shadow-sm dark:bg-white/[0.12] dark:text-foreground dark:shadow-[inset_0_1px_0_oklch(1_0_0/0.1)]"
                    : "text-muted-foreground hover:text-foreground/90 transition-all duration-200"
                )}
              >
                {item.label}
              </Link>
            ))}
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
                "text-[12px] font-medium hidden md:inline",
                wsConnected ? "text-bullish" : "text-amber-500"
              )}>
                {wsConnected ? "Live" : "Polling"}
              </span>
            </div>

            {isAdmin && (
              <div className="hidden md:block">
                <DataFeedStatus />
              </div>
            )}

            <SetupNotificationsBadge />

            <AlertsBell />

            <UserMenu />

            <ThemeToggle />

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center justify-center h-8 w-8 rounded-lg border border-transparent text-muted-foreground transition-colors hover:border-[var(--glass-border)] hover:bg-white/40 hover:text-foreground dark:hover:bg-white/[0.06]"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile nav dropdown */}
      {mobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="md:hidden fixed top-12 left-0 right-0 z-50 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[0_8px_30px_oklch(0_0_0/0.25)] backdrop-blur-2xl dark:shadow-[0_8px_32px_oklch(0_0_0/0.45)]">
            <nav className="px-4 py-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.mode}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all",
                    mode === item.mode
                      ? "border border-primary/25 bg-primary/15 text-primary backdrop-blur-md"
                      : "text-muted-foreground hover:bg-white/50 hover:text-foreground dark:hover:bg-white/[0.06]"
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/support"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-[var(--surface-1)] transition-all"
              >
                Support
              </Link>
            </nav>
          </div>
        </>
      )}
    </>
  );
}
