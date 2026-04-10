"use client";

import { useBiasAccuracy } from "@/lib/hooks/useBiasAccuracy";
import { GlassCard } from "@/components/common/GlassCard";
import { TrendingUp, TrendingDown, Flame, Target, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

/** Full accuracy card for instrument page */
export function BiasAccuracyCard({ instrumentId }: { instrumentId: string }) {
  const { instrumentStats, allHistory } = useBiasAccuracy(instrumentId);
  const history = allHistory[instrumentId] || [];

  // Only show entries with outcomes
  const recentWithOutcomes = history
    .filter((e) => e.outcome24h)
    .slice(-10)
    .reverse();

  if (!instrumentStats || instrumentStats.total === 0) {
    return (
      <GlassCard delay={0.5}>
        <h3 className="text-sm font-semibold mb-2">Prediction Accuracy</h3>
        <p className="text-xs text-muted-foreground">
          Accuracy tracking requires at least 24 hours of bias history with price data.
        </p>
      </GlassCard>
    );
  }

  const { winRate24h, winRate1w, streak, total, correct24h, correct1w } = instrumentStats;

  return (
    <GlassCard delay={0.5}>
      <h3 className="text-sm font-semibold mb-3">Prediction Accuracy</h3>

      {/* Win Rate Gauges */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <WinRateGauge label="24h" winRate={winRate24h} total={total} correct={correct24h} />
        <WinRateGauge label="1 Week" winRate={winRate1w} total={instrumentStats.total} correct={correct1w} />
      </div>

      {/* Streak */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <Flame className="h-3.5 w-3.5 text-[var(--amber)]" />
        <span className="text-[12px] text-muted-foreground">Streak</span>
        <span className={cn(
          "text-xs font-bold tabular",
          streak > 0 ? "text-bullish" : streak < 0 ? "text-bearish" : "text-muted-foreground"
        )}>
          {streak > 0 ? `+${streak} wins` : streak < 0 ? `${streak} losses` : "—"}
        </span>
      </div>

      {/* Recent Predictions */}
      {recentWithOutcomes.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-wider px-1">
            Recent Predictions
          </h4>
          <div className="space-y-1">
            {recentWithOutcomes.slice(0, 5).map((entry, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--surface-2)] text-[12px]"
              >
                <span className="text-muted-foreground/60 font-mono w-14 shrink-0">
                  {format(new Date(entry.timestamp), "MMM dd")}
                </span>
                <span className={cn(
                  "font-semibold w-10",
                  entry.direction.includes("bullish") ? "text-bullish" : entry.direction.includes("bearish") ? "text-bearish" : "text-muted-foreground"
                )}>
                  {entry.direction.includes("bullish") ? (
                    <TrendingUp className="h-3 w-3 inline" />
                  ) : entry.direction.includes("bearish") ? (
                    <TrendingDown className="h-3 w-3 inline" />
                  ) : "—"}
                </span>
                <span className="text-muted-foreground/60 font-mono flex-1">
                  {entry.bias > 0 ? "+" : ""}{entry.bias.toFixed(0)}
                </span>
                {entry.outcome24h ? (
                  entry.outcome24h.wasCorrect ? (
                    <CheckCircle className="h-3 w-3 text-bullish" />
                  ) : (
                    <XCircle className="h-3 w-3 text-bearish" />
                  )
                ) : (
                  <span className="h-3 w-3 rounded-full shimmer" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
}

/** Compact accuracy summary for homepage */
export function BiasAccuracySummary({
  variant = "default",
}: {
  variant?: "default" | "footer";
}) {
  const { stats } = useBiasAccuracy();

  if (!stats || stats.total === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center text-[12px]",
        variant === "footer"
          ? "w-full justify-center gap-x-3 gap-y-2 border-t border-border/40 bg-[var(--surface-2)]/40 px-3 py-2.5 sm:justify-start sm:gap-x-4 sm:px-4 dark:bg-white/[0.03]"
          : "gap-2 sm:gap-4 rounded-lg bg-[var(--surface-2)] px-3 py-2"
      )}
    >
      <div className="flex items-center gap-1.5">
        <Target className="h-3 w-3 text-neutral-accent" />
        <span className="text-muted-foreground">Bias Accuracy</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground/60">24h:</span>
        <span className={cn(
          "font-bold tabular",
          stats.winRate24h >= 60 ? "text-bullish" : stats.winRate24h >= 45 ? "text-[var(--amber)]" : "text-bearish"
        )}>
          {stats.winRate24h}%
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground/60">1W:</span>
        <span className={cn(
          "font-bold tabular",
          stats.winRate1w >= 60 ? "text-bullish" : stats.winRate1w >= 45 ? "text-[var(--amber)]" : "text-bearish"
        )}>
          {stats.winRate1w}%
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Flame className="h-3 w-3 text-[var(--amber)]" />
        <span className={cn(
          "font-bold tabular",
          stats.currentStreak > 0 ? "text-bullish" : stats.currentStreak < 0 ? "text-bearish" : "text-muted-foreground"
        )}>
          {stats.currentStreak > 0 ? `+${stats.currentStreak}` : stats.currentStreak}
        </span>
      </div>
    </div>
  );
}

function WinRateGauge({ label, winRate, total, correct }: { label: string; winRate: number; total: number; correct: number }) {
  const color = winRate >= 60 ? "text-bullish" : winRate >= 45 ? "text-[var(--amber)]" : "text-bearish";
  const bgColor = winRate >= 60 ? "bg-bullish/15" : winRate >= 45 ? "bg-[var(--amber)]/15" : "bg-bearish/15";

  return (
    <div className={cn("rounded-lg p-3 text-center", bgColor)}>
      <span className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-wider">{label}</span>
      <div className={cn("text-2xl font-bold tabular mt-1", color)}>
        {winRate}%
      </div>
      <span className="text-[11px] text-muted-foreground/60">{correct}/{total}</span>
    </div>
  );
}
