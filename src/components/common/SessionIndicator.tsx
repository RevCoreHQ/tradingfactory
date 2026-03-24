"use client";

import { useSessionRelevance } from "@/lib/hooks/useSessionRelevance";
import { GlassCard } from "./GlassCard";
import { Clock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { TRADING_SESSIONS } from "@/lib/utils/constants";
import { getSessionUTCHours, isSessionActive } from "@/lib/calculations/session-scoring";

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
          backgroundColor: relevance.isOptimalNow
            ? "var(--bullish)"
            : relevance.sessionScore >= 40
            ? "var(--amber)"
            : "var(--muted-foreground)",
          opacity: relevance.isOptimalNow ? 1 : 0.5,
        }}
      />
      <span className={cn(
        "text-[11px]",
        relevance.isOptimalNow ? "text-bullish font-medium" : "text-muted-foreground/60"
      )}>
        {relevance.isOptimalNow ? "Active" : `in ${relevance.nextOptimalIn}`}
      </span>
    </div>
  );
}

/** Detailed session card for instrument page */
export function SessionCard({ instrumentId }: { instrumentId: string }) {
  const { relevance } = useSessionRelevance(instrumentId);
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
          // Check if THIS specific session is active (DST-aware)
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
        {relevance.isOptimalNow ? (
          <>
            <Zap className="h-3 w-3 text-bullish" />
            <span className="text-bullish font-semibold">Optimal Window Active</span>
          </>
        ) : (
          <>
            <Clock className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-muted-foreground">
              Next window in <span className="font-mono font-medium text-foreground">{relevance.nextOptimalIn}</span>
            </span>
          </>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground/50 mt-2">{relevance.reason}</p>
    </GlassCard>
  );
}
