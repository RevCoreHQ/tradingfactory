"use client";

import { useEffect, useState } from "react";
import { TRADING_SESSIONS } from "@/lib/utils/constants";
import { isSessionActive } from "@/lib/calculations/session-scoring";
import { cn } from "@/lib/utils";

export function SessionClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hourUTC = now.getUTCHours();
  const minuteUTC = now.getUTCMinutes();
  const currentPosition = ((hourUTC * 60 + minuteUTC) / 1440) * 100;

  const activeSessions = Object.entries(TRADING_SESSIONS).filter(([, session]) =>
    isSessionActive(session, hourUTC)
  );

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-medium">Trading Sessions</span>
        <span className="text-xs font-mono text-muted-foreground">
          {now.toUTCString().slice(17, 25)} UTC
        </span>
      </div>

      {/* Timeline bar */}
      <div className="relative h-8 rounded-lg bg-[var(--surface-2)] overflow-hidden">
        {/* Session blocks */}
        {Object.entries(TRADING_SESSIONS).map(([key, session]) => {
          const startPercent = (session.openHourUTC / 24) * 100;
          let widthPercent: number;
          if (session.openHourUTC < session.closeHourUTC) {
            widthPercent = ((session.closeHourUTC - session.openHourUTC) / 24) * 100;
          } else {
            widthPercent = ((24 - session.openHourUTC + session.closeHourUTC) / 24) * 100;
          }

          const isActive = isSessionActive(session, hourUTC);

          if (session.openHourUTC < session.closeHourUTC) {
            return (
              <div
                key={key}
                className={cn("absolute top-0 h-full transition-opacity duration-500", isActive ? "opacity-40" : "opacity-15")}
                style={{
                  left: `${startPercent}%`,
                  width: `${widthPercent}%`,
                  backgroundColor: session.color,
                }}
              />
            );
          }

          // Wraps around - two segments
          return (
            <div key={key}>
              <div
                className={cn("absolute top-0 h-full transition-opacity duration-500", isActive ? "opacity-40" : "opacity-15")}
                style={{
                  left: `${startPercent}%`,
                  width: `${((24 - session.openHourUTC) / 24) * 100}%`,
                  backgroundColor: session.color,
                }}
              />
              <div
                className={cn("absolute top-0 h-full transition-opacity duration-500", isActive ? "opacity-40" : "opacity-15")}
                style={{
                  left: "0%",
                  width: `${(session.closeHourUTC / 24) * 100}%`,
                  backgroundColor: session.color,
                }}
              />
            </div>
          );
        })}

        {/* Current time marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)] z-10 pulse-dot"
          style={{ left: `${currentPosition}%` }}
        />

        {/* Hour markers */}
        {[0, 6, 12, 18].map((hour) => (
          <div
            key={hour}
            className="absolute top-0 h-full w-px bg-[var(--surface-3)]"
            style={{ left: `${(hour / 24) * 100}%` }}
          >
            <span className="absolute -bottom-4 -translate-x-1/2 text-[12px] text-muted-foreground">
              {hour.toString().padStart(2, "0")}
            </span>
          </div>
        ))}
      </div>

      {/* Active sessions label */}
      <div className="flex gap-3 mt-5">
        {Object.entries(TRADING_SESSIONS).map(([key, session]) => {
          const isActive = isSessionActive(session, hourUTC);
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className={cn("h-2 w-2 rounded-full", isActive && "pulse-dot")}
                style={{ backgroundColor: session.color, opacity: isActive ? 1 : 0.3 }}
              />
              <span className={cn("text-xs", isActive ? "text-foreground" : "text-muted-foreground/50")}>
                {session.name}
              </span>
            </div>
          );
        })}
        {activeSessions.length > 1 && (
          <span className="text-xs text-yellow-500/80 ml-auto">
            Overlap Active
          </span>
        )}
      </div>
    </div>
  );
}
