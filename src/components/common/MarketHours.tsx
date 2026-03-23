"use client";

import { useEffect, useState } from "react";
import { TRADING_SESSIONS } from "@/lib/utils/constants";
import { isSessionActive, getTimeUntil, isForexMarketOpen } from "@/lib/calculations/session-scoring";
import { GlassCard } from "./GlassCard";
import { cn } from "@/lib/utils";

/** Compact market hours strip for the overview page */
export function MarketHoursStrip() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const hourUTC = now.getUTCHours();
  const minUTC = now.getUTCMinutes();

  const marketOpen = isForexMarketOpen(now);
  const sessions = Object.entries(TRADING_SESSIONS).map(([key, session]) => {
    const active = marketOpen && isSessionActive(session, hourUTC, now);
    const timeLeft = active
      ? getTimeUntil(session.closeHourUTC, hourUTC, minUTC)
      : getTimeUntil(session.openHourUTC, hourUTC, minUTC);
    return { key, ...session, active, timeLeft };
  });

  return (
    <div className="border-b border-border/50 bg-[var(--surface-0)] px-6 py-2">
      <div className="max-w-[1400px] mx-auto flex items-center justify-center gap-6 overflow-x-auto scrollbar-none">
        <span className="text-[12px] font-mono text-muted-foreground/60 shrink-0">
          {now.toUTCString().slice(17, 25)} UTC
        </span>
        {!marketOpen && (
          <span className="text-[13px] font-medium text-muted-foreground/50">Markets Closed — Weekend</span>
        )}
        {sessions.map((session) => (
          <div key={session.key} className={cn("flex items-center gap-2 shrink-0", !marketOpen && "opacity-30")}>
            <span
              className={cn("h-2 w-2 rounded-full shrink-0", session.active && "pulse-dot")}
              style={{ backgroundColor: session.color, opacity: session.active ? 1 : 0.2 }}
            />
            <span className={cn(
              "text-[13px]",
              session.active ? "text-foreground font-medium" : "text-muted-foreground/60"
            )}>
              {session.name}
            </span>
            {marketOpen && (
              <span className={cn(
                "text-[12px] font-mono",
                session.active ? "text-foreground/70" : "text-muted-foreground/40"
              )}>
                {session.active ? session.timeLeft : `in ${session.timeLeft}`}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Full market hours card for standalone use */
export function MarketHours() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hourUTC = now.getUTCHours();
  const minUTC = now.getUTCMinutes();

  const marketOpen = isForexMarketOpen(now);
  const sessions = Object.entries(TRADING_SESSIONS).map(([key, session]) => {
    const active = marketOpen && isSessionActive(session, hourUTC, now);
    const timeLeft = active
      ? getTimeUntil(session.closeHourUTC, hourUTC, minUTC)
      : getTimeUntil(session.openHourUTC, hourUTC, minUTC);
    return { key, ...session, active, timeLeft };
  });

  return (
    <GlassCard delay={0.1}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Market Hours</h3>
        <span className="text-[12px] text-muted-foreground font-mono">
          {now.toUTCString().slice(17, 25)} UTC
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {sessions.map((session) => (
          <div
            key={session.key}
            className={cn(
              "rounded-lg p-3 transition-colors border",
              session.active ? "bg-[var(--surface-2)]" : "bg-transparent border-transparent"
            )}
            style={{
              borderColor: session.active ? session.color + "40" : undefined,
            }}
          >
            <div className="flex items-center gap-1.5 mb-2">
              <span
                className={cn("h-2 w-2 rounded-full", session.active && "pulse-dot")}
                style={{ backgroundColor: session.color, opacity: session.active ? 1 : 0.3 }}
              />
              <span className={cn("text-xs font-semibold", session.active ? "text-foreground" : "text-muted-foreground")}>
                {session.name}
              </span>
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className={cn(session.active ? "text-foreground font-medium" : "text-muted-foreground")}>
                {session.active ? "Closes in" : "Opens in"}
              </span>
              <span className={cn("font-mono font-medium", session.active ? "text-foreground" : "text-muted-foreground/70")}>
                {session.timeLeft}
              </span>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
