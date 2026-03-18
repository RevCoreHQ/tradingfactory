"use client";

import { useEffect, useState } from "react";
import { TRADING_SESSIONS } from "@/lib/utils/constants";
import { GlassCard } from "./GlassCard";
import { cn } from "@/lib/utils";

function isSessionActive(session: { openHourUTC: number; closeHourUTC: number }, hourUTC: number): boolean {
  if (session.openHourUTC < session.closeHourUTC) {
    return hourUTC >= session.openHourUTC && hourUTC < session.closeHourUTC;
  }
  return hourUTC >= session.openHourUTC || hourUTC < session.closeHourUTC;
}

function getTimeUntil(targetHourUTC: number, nowHourUTC: number, nowMinUTC: number): string {
  let hoursUntil = targetHourUTC - nowHourUTC;
  if (hoursUntil < 0) hoursUntil += 24;
  const minsUntil = hoursUntil * 60 - nowMinUTC;
  const h = Math.floor(minsUntil / 60);
  const m = minsUntil % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/** Compact market hours strip for the overview page */
export function MarketHoursStrip() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const hourUTC = now.getUTCHours();
  const minUTC = now.getUTCMinutes();

  const sessions = Object.entries(TRADING_SESSIONS).map(([key, session]) => {
    const active = isSessionActive(session, hourUTC);
    const timeLeft = active
      ? getTimeUntil(session.closeHourUTC, hourUTC, minUTC)
      : getTimeUntil(session.openHourUTC, hourUTC, minUTC);
    return { key, ...session, active, timeLeft };
  });

  return (
    <div className="border-b border-border bg-[var(--surface-0)] px-4 py-1.5">
      <div className="max-w-[1800px] mx-auto flex items-center gap-4 overflow-x-auto scrollbar-none">
        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
          {now.toUTCString().slice(17, 25)} UTC
        </span>
        <div className="w-px h-3 bg-border shrink-0" />
        {sessions.map((session) => (
          <div key={session.key} className="flex items-center gap-1.5 shrink-0">
            <span
              className={cn("h-1.5 w-1.5 rounded-full shrink-0", session.active && "pulse-dot")}
              style={{ backgroundColor: session.color, opacity: session.active ? 1 : 0.25 }}
            />
            <span className={cn(
              "text-[10px]",
              session.active ? "text-foreground font-medium" : "text-muted-foreground"
            )}>
              {session.name}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground/60">
              {session.active ? session.timeLeft : `in ${session.timeLeft}`}
            </span>
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

  const sessions = Object.entries(TRADING_SESSIONS).map(([key, session]) => {
    const active = isSessionActive(session, hourUTC);
    const timeLeft = active
      ? getTimeUntil(session.closeHourUTC, hourUTC, minUTC)
      : getTimeUntil(session.openHourUTC, hourUTC, minUTC);
    return { key, ...session, active, timeLeft };
  });

  return (
    <GlassCard delay={0.1}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Market Hours</h3>
        <span className="text-[10px] text-muted-foreground font-mono">
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
            <div className="flex items-center justify-between text-[10px]">
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
