"use client";

import { useEffect, useState } from "react";
import { TRADING_SESSIONS } from "@/lib/utils/constants";
import { SessionClock } from "./SessionClock";
import { GlassCard } from "./GlassCard";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

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

function formatHourUTC(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

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

  const activeSessions = sessions.filter((s) => s.active);

  return (
    <GlassCard delay={0.1}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Clock className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <h3 className="text-sm font-semibold">Market Hours</h3>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {now.toUTCString().slice(17, 25)} UTC
        </span>
      </div>

      {/* Sessions Table */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
        {sessions.map((session) => (
          <div
            key={session.key}
            className={cn(
              "rounded-lg p-3 transition-all border",
              session.active ? "bg-white/5" : "bg-white/[0.02] border-transparent"
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
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Open</span>
                <span className="font-mono text-muted-foreground">{formatHourUTC(session.openHourUTC)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Close</span>
                <span className="font-mono text-muted-foreground">{formatHourUTC(session.closeHourUTC)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] pt-1 border-t border-white/5">
                <span className={cn(session.active ? "text-foreground font-medium" : "text-muted-foreground")}>
                  {session.active ? "Closes in" : "Opens in"}
                </span>
                <span className={cn("font-mono font-medium", session.active ? "text-foreground" : "text-muted-foreground/70")}>
                  {session.timeLeft}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Active sessions summary */}
      {activeSessions.length > 0 && (
        <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
          <span>Active:</span>
          {activeSessions.map((s, i) => (
            <span key={s.key}>
              <span className="font-medium text-foreground">{s.name}</span>
              {i < activeSessions.length - 1 && <span className="mx-1">+</span>}
            </span>
          ))}
          {activeSessions.length > 1 && (
            <span className="text-yellow-500/80 ml-auto text-[10px]">Overlap</span>
          )}
        </div>
      )}

      {/* Timeline */}
      <SessionClock />
    </GlassCard>
  );
}
