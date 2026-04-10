"use client";

import { ChevronDown, Layers } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { BiasResult } from "@/lib/types/bias";
import { describeHeadlineVsDeskTension } from "@/lib/calculations/decision-context";

type DeskBias = Pick<
  BiasResult,
  | "overallBias"
  | "tacticalBias"
  | "structuralBias"
  | "tradeGuidance"
  | "tradeGuidanceSummary"
  | "eventGate"
  | "tradeSetup"
  | "timeframeAlignment"
  | "marketRegime"
  | "mtfAlignmentPercent"
  | "timestamp"
  | "decisionRationale"
>;

export function DecisionDeskPanel({ bias }: { bias: DeskBias }) {
  const hasContent =
    bias.tacticalBias !== undefined ||
    bias.structuralBias !== undefined ||
    !!bias.tradeGuidanceSummary ||
    !!bias.eventGate ||
    (bias.tradeSetup?.checklist && bias.tradeSetup.checklist.length > 0);

  if (!hasContent) return null;

  const asOf =
    bias.timestamp && bias.timestamp > 1_600_000_000_000
      ? formatDistanceToNow(new Date(bias.timestamp), { addSuffix: true })
      : null;

  const tension = describeHeadlineVsDeskTension(bias as BiasResult);
  const hasDetails =
    bias.tacticalBias !== undefined ||
    bias.structuralBias !== undefined ||
    bias.mtfAlignmentPercent !== undefined ||
    (bias.tradeSetup?.checklist && bias.tradeSetup.checklist.length > 0);

  return (
    <div className="mb-3 space-y-2 rounded-lg border border-[var(--glass-border)] bg-white/25 px-3 py-2.5 dark:bg-white/[0.04]">
      {asOf ? (
        <p className="text-[10px] text-muted-foreground/55">
          Model snapshot {asOf}
          <span className="opacity-70"> · batch + fundamentals fused on this page load</span>
        </p>
      ) : null}
      {bias.decisionRationale ? (
        <p className="text-[11px] leading-snug text-muted-foreground/80">
          <span className="font-semibold text-muted-foreground/90">Why: </span>
          {bias.decisionRationale}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Layers className="h-3.5 w-3.5 text-muted-foreground/60" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Decision desk
        </span>
        {bias.tradeSetup?.confluenceTier && (
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-mono text-[10px] font-bold",
              bias.tradeSetup.confluenceTier === "A" && "bg-bullish/15 text-bullish",
              bias.tradeSetup.confluenceTier === "B" && "bg-amber/15 text-amber",
              bias.tradeSetup.confluenceTier === "C" && "bg-muted text-muted-foreground"
            )}
          >
            {bias.tradeSetup.confluenceTier}-tier
          </span>
        )}
        {bias.timeframeAlignment && (
          <span className="rounded border border-border/40 px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">
            TF: {bias.timeframeAlignment}
          </span>
        )}
        {bias.marketRegime && (
          <span className="rounded border border-border/40 px-1.5 py-0.5 text-[10px] capitalize text-muted-foreground">
            Regime: {bias.marketRegime.replace(/_/g, " ")}
          </span>
        )}
      </div>
      {bias.tradeGuidanceSummary ? (
        <p className="text-[12px] leading-snug text-foreground/85">{bias.tradeGuidanceSummary}</p>
      ) : null}
      {bias.eventGate ? (
        <p
          className={cn(
            "text-[11px] leading-snug text-muted-foreground",
            bias.eventGate.hasMajorEventSoon && "font-medium text-amber"
          )}
        >
          {bias.eventGate.suggestion}
        </p>
      ) : null}
      {tension ? (
        <p className="text-[11px] leading-snug text-neutral-accent/90 border-l-2 border-neutral-accent/40 pl-2">
          {tension}
        </p>
      ) : null}

      {hasDetails ? (
        <details className="group rounded-md border border-border/25 bg-[var(--surface-1)]/40 open:bg-[var(--surface-1)]/60">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
            <span>15m/1h legs, MTF %, checklist</span>
          </summary>
          <div className="space-y-2 border-t border-border/20 px-2 pb-2 pt-1">
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
              {bias.tacticalBias !== undefined && (
                <span>
                  15m+fund:{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      bias.tacticalBias > 0 ? "text-bullish" : bias.tacticalBias < 0 ? "text-bearish" : ""
                    )}
                  >
                    {bias.tacticalBias > 0 ? "+" : ""}
                    {Math.round(bias.tacticalBias)}
                  </span>
                </span>
              )}
              {bias.structuralBias !== undefined && (
                <span>
                  1h+fund:{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      bias.structuralBias > 0 ? "text-bullish" : bias.structuralBias < 0 ? "text-bearish" : ""
                    )}
                  >
                    {bias.structuralBias > 0 ? "+" : ""}
                    {Math.round(bias.structuralBias)}
                  </span>
                </span>
              )}
              {bias.mtfAlignmentPercent !== undefined && (
                <span>MTF model: {bias.mtfAlignmentPercent}%</span>
              )}
            </div>
            {bias.mtfAlignmentPercent !== undefined ? (
              <p className="text-[10px] text-muted-foreground/55">
                MTF % is a weighted 15m–1d alignment score from the same batch-scores run as technical totals; it matches
                the EMA pill row when that row uses the batch snapshot (see note under EMA on the card).
              </p>
            ) : null}
            <p className="text-[10px] text-muted-foreground/55">
              Tactical/structural rows use fundamentals plus a single timeframe&apos;s technicals; the large headline bias
              blends both intraday technicals with fundamentals.
            </p>
            {bias.tradeSetup?.checklist && bias.tradeSetup.checklist.length > 0 ? (
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {bias.tradeSetup.checklist.map((c) => (
                  <li
                    key={c.id}
                    className={cn(
                      "flex items-start gap-1.5 text-[11px]",
                      c.pass ? "text-bullish/90" : "text-muted-foreground/55"
                    )}
                  >
                    <span className="shrink-0 font-mono">{c.pass ? "+" : "–"}</span>
                    {c.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
