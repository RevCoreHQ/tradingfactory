"use client";

import { useEffect, useState } from "react";
import { useSessionRelevance } from "@/lib/hooks/useSessionRelevance";
import { GlassCard } from "./GlassCard";
import { Clock, Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { TRADING_SESSIONS } from "@/lib/utils/constants";
import { getSessionUTCHours, isSessionActive } from "@/lib/calculations/session-scoring";

/** Format ms as hh:mm:ss countdown */
function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Compact badge for conviction cards */
export function SessionBadge({ instrumentId }: { instrumentId: string }) {
  const { relevance } = useSessionRelevance(instrumentId);
  if (!relevance) return null;

  return (
    <div className="flex items-center gap-1">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          relevance.isOptimalNow && "pulse-dot"
        )}
        style={{
          backgroundColor: relevance.isOverlap
            ? "var(--bullish)"
            : relevance.isOptimalNow
            ? "var(--amber)"
            : "var(--muted-foreground)",
          opacity: relevance.isOptimalNow ? 1 : 0.5,
        }}
      />
      <span className={cn(
        "text-[11px]",
        relevance.isOverlap ? "text-bullish font-medium" : relevance.isOptimalNow ? "text-[var(--amber)] font-medium" : "text-muted-foreground/60"
      )}>
        {relevance.isOverlap ? "Peak" : relevance.isOptimalNow ? "Active" : `in ${relevance.nextOptimalIn}`}
      </span>
    </div>
  );
}

/** Detailed session card for instrument page */
export function SessionCard({ instrumentId }: { instrumentId: string }) {
  const { relevance } = useSessionRelevance(instrumentId);
  const [countdownMs, setCountdownMs] = useState(0);

  // Live countdown timer — ticks every second
  useEffect(() => {
    if (!relevance) return;
    setCountdownMs(relevance.nextEventCountdownMs);

    const interval = setInterval(() => {
      setCountdownMs((prev) => Math.max(0, prev - 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [relevance?.nextEventCountdownMs, relevance]);

  if (!relevance) {
    return (
      <GlassCard delay={0.15}>
        <div className="flex items-center gap-1.5 mb-3">
          <Clock className="h-3.5 w-3.5 text-muted-foreground/40" />
          <h3 className="text-xs font-semibold text-muted-foreground">Session Window</h3>
        </div>
        <p className="text-[12px] text-muted-foreground/50">Loading session data...</p>
      </GlassCard>
    );
  }

  const scoreColor = relevance.sessionScore >= 75
    ? "text-bullish"
    : relevance.sessionScore >= 40
    ? "text-[var(--amber)]"
    : "text-muted-foreground";

  const scoreBg = relevance.sessionScore >= 75
    ? "bg-bullish/15"
    : relevance.sessionScore >= 40
    ? "bg-[var(--amber)]/15"
    : "bg-[var(--surface-2)]";

  // Status label and color
  let statusLabel: string;
  let statusColor: string;
  let StatusIcon = Clock;

  if (relevance.isOverlap) {
    statusLabel = "Peak Volume Window";
    statusColor = "text-bullish";
    StatusIcon = Zap;
  } else if (relevance.isOptimalNow) {
    const activeNames = relevance.activeSessions.map((k) => {
      const s = TRADING_SESSIONS[k];
      return s?.name || k;
    });
    statusLabel = `${activeNames.join(" + ")} Active`;
    statusColor = "text-[var(--amber)]";
    StatusIcon = TrendingUp;
  } else {
    statusLabel = "Waiting for Session";
    statusColor = "text-muted-foreground";
    StatusIcon = Clock;
  }

  return (
    <GlassCard delay={0.15}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
          <h3 className="text-xs font-semibold">Session Window</h3>
        </div>
        <div className={cn("px-2 py-0.5 rounded text-[12px] font-bold tabular", scoreBg, scoreColor)}>
          {relevance.sessionScore}
        </div>
      </div>

      {/* Optimal sessions — per-session active state */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {relevance.optimalSessions.map((sessionKey) => {
          const session = TRADING_SESSIONS[sessionKey];
          if (!session) return null;
          const now = new Date();
          const dstHours = getSessionUTCHours(sessionKey);
          const thisSessionActive = isSessionActive(dstHours, now.getUTCHours(), now);
          return (
            <div
              key={sessionKey}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-[12px] border",
                thisSessionActive
                  ? "border-bullish/30 bg-bullish/10"
                  : "border-border bg-[var(--surface-2)]"
              )}
            >
              <span
                className={cn("h-1.5 w-1.5 rounded-full shrink-0", thisSessionActive && "pulse-dot")}
                style={{ backgroundColor: session.color, opacity: thisSessionActive ? 1 : 0.4 }}
              />
              <span className={cn(thisSessionActive ? "text-foreground font-medium" : "text-muted-foreground")}>
                {session.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 text-[12px]">
        <StatusIcon className={cn("h-3 w-3", statusColor)} />
        <span className={cn("font-semibold", statusColor)}>{statusLabel}</span>
      </div>

      {/* Countdown row */}
      <div className="flex items-center justify-between mt-2 px-2 py-1.5 rounded-md bg-[var(--surface-2)] border border-border/30">
        <span className="text-[11px] text-muted-foreground">
          {relevance.nextEventLabel}
        </span>
        <span className="text-[13px] font-mono font-bold tabular text-foreground">
          {formatCountdown(countdownMs)}
        </span>
      </div>

      <p className="text-[11px] text-muted-foreground/50 mt-2">{relevance.reason}</p>
    </GlassCard>
  );
}
