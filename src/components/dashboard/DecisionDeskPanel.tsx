"use client";

import { ChevronDown, Layers, Shield, ShieldOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { BiasResult } from "@/lib/types/bias";
import { describeHeadlineVsDeskTension } from "@/lib/calculations/decision-context";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useDecisionEngine } from "@/lib/hooks/useDecisionEngine";

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

function snapshotHint(timestamp: number | undefined): string | null {
  if (!timestamp || timestamp <= 1_600_000_000_000) return null;
  const asOf = formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  return `Model snapshot ${asOf}. Scores fuse fundamentals with intraday technicals from the same batch as this view.`;
}

export function hasDecisionDeskExpandedContent(bias: DeskBias): boolean {
  return !!(
    bias.decisionRationale ||
    bias.tacticalBias !== undefined ||
    bias.structuralBias !== undefined ||
    bias.mtfAlignmentPercent !== undefined ||
    (bias.tradeSetup?.checklist && bias.tradeSetup.checklist.length > 0)
  );
}

/** Legs, MTF %, checklist — for merged “Full context” on instrument cards or inside desk details. */
export function DecisionDeskExpandedSections({
  bias,
  omitRationale = false,
}: {
  bias: DeskBias;
  /** When the rationale is already shown above (full analysis panel), skip repeating it here. */
  omitRationale?: boolean;
}) {
  const hasDetails =
    bias.tacticalBias !== undefined ||
    bias.structuralBias !== undefined ||
    bias.mtfAlignmentPercent !== undefined ||
    (bias.tradeSetup?.checklist && bias.tradeSetup.checklist.length > 0);

  if ((!bias.decisionRationale || omitRationale) && !hasDetails) return null;

  return (
    <div className="space-y-3">
      {bias.decisionRationale && !omitRationale ? (
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground/90 uppercase tracking-wider mb-1">Desk rationale</p>
          <p className="text-sm text-foreground/80 leading-relaxed">{bias.decisionRationale}</p>
        </div>
      ) : null}

      {hasDetails ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground/90 uppercase tracking-wider">Technical legs & checklist</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11px] text-muted-foreground">
            {bias.tacticalBias !== undefined && (
              <Tooltip>
                <TooltipTrigger
                  render={<span />}
                  className="cursor-help border-b border-dotted border-muted-foreground/25"
                >
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
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                  Tactical row: fundamentals plus 15m timeframe technicals only (not the full blended headline).
                </TooltipContent>
              </Tooltip>
            )}
            {bias.structuralBias !== undefined && (
              <Tooltip>
                <TooltipTrigger
                  render={<span />}
                  className="cursor-help border-b border-dotted border-muted-foreground/25"
                >
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
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                  Structural row: fundamentals plus 1h timeframe technicals only.
                </TooltipContent>
              </Tooltip>
            )}
            {bias.mtfAlignmentPercent !== undefined && (
              <Tooltip>
                <TooltipTrigger
                  render={<span />}
                  className="cursor-help border-b border-dotted border-muted-foreground/25"
                >
                  MTF model: {bias.mtfAlignmentPercent}%
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                  Weighted 15m–1d alignment from the same batch-scores run as technical totals; matches the EMA row when
                  that row uses the batch snapshot.
                </TooltipContent>
              </Tooltip>
            )}
          </div>
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
      ) : null}
    </div>
  );
}

type PanelMode = "full" | "card";

export function DecisionDeskPanel({ bias, mode = "full" }: { bias: DeskBias; mode?: PanelMode }) {
  const hasDeskFields =
    bias.tacticalBias !== undefined ||
    bias.structuralBias !== undefined ||
    !!bias.tradeGuidanceSummary ||
    !!bias.eventGate ||
    (bias.tradeSetup?.checklist && bias.tradeSetup.checklist.length > 0);

  const hasContent = mode === "card" ? hasDeskFields : hasDeskFields || !!bias.decisionRationale;

  if (!hasContent) return null;

  const snap = snapshotHint(bias.timestamp);
  const tension = describeHeadlineVsDeskTension(bias as BiasResult);
  const hasDetails =
    bias.tacticalBias !== undefined ||
    bias.structuralBias !== undefined ||
    bias.mtfAlignmentPercent !== undefined ||
    (bias.tradeSetup?.checklist && bias.tradeSetup.checklist.length > 0);

  if (mode === "card") {
    return (
      <div className="mb-3 space-y-2 rounded-lg border border-[var(--glass-border)] bg-white/25 px-3 py-2.5 dark:bg-white/[0.04]">
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip>
            <TooltipTrigger
              render={<span className="inline-flex items-center gap-1.5 cursor-default" />}
            >
              <Layers className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 border-b border-dotted border-muted-foreground/30">
                Decision desk
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
              {snap ?? "Desk tier, timeframes, and regime — fused with the same score batch as this card."}
            </TooltipContent>
          </Tooltip>
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
      </div>
    );
  }

  return (
    <div className="mb-3 space-y-2 rounded-lg border border-[var(--glass-border)] bg-white/25 px-3 py-2.5 dark:bg-white/[0.04]">
      {bias.decisionRationale ? (
        <p className="text-[11px] leading-snug text-muted-foreground/80">
          <span className="font-semibold text-muted-foreground/90">Why: </span>
          {bias.decisionRationale}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex items-center gap-1.5 cursor-default" />}>
            <Layers className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 border-b border-dotted border-muted-foreground/30">
              Decision desk
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
            {snap ?? "Desk tier, timeframes, and regime from the blended model."}
          </TooltipContent>
        </Tooltip>
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
        <p className="text-[11px] leading-snug text-neutral-accent/90 border-l-2 border-neutral-accent/40 pl-2">{tension}</p>
      ) : null}

      {hasDetails ? (
        <details className="group rounded-md border border-border/25 bg-[var(--surface-1)]/40 open:bg-[var(--surface-1)]/60">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-2 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
            <span>15m/1h legs, MTF %, checklist</span>
          </summary>
          <div className="space-y-2 border-t border-border/20 px-2 pb-2 pt-2">
            <DecisionDeskExpandedSections bias={bias} omitRationale />
          </div>
        </details>
      ) : null}
    </div>
  );
}

// ── CommittedBiasIndicator ────────────────────────────────
// Shows the *persisted* bias from decision_engine (sticky, structural)
// alongside or below the existing DeskBias (live recompute).

export function CommittedBiasIndicator({ instrument }: { instrument: string }) {
  const { biasForInstrument, hasFlipBlocks } = useDecisionEngine({ refreshInterval: 60_000 });
  const committed = biasForInstrument(instrument);

  if (!committed) return null;

  const dir = committed.direction;
  const colorClass =
    dir === "bullish"
      ? "text-emerald-400"
      : dir === "bearish"
        ? "text-red-400"
        : "text-muted-foreground";

  return (
    <div className="flex items-center gap-2 rounded-md border border-border/30 bg-[var(--surface-1)]/40 px-2 py-1.5 text-[11px]">
      {hasFlipBlocks ? (
        <ShieldOff className="h-3 w-3 text-yellow-400 shrink-0" />
      ) : (
        <Shield className="h-3 w-3 text-muted-foreground/50 shrink-0" />
      )}
      <span className="text-muted-foreground/60">Committed bias</span>
      <span className={cn("font-semibold capitalize", colorClass)}>{dir}</span>
      <span className="text-muted-foreground/50">{committed.confidence.toFixed(0)}%</span>
      <span className={cn(
        "ml-auto text-muted-foreground/50 rounded px-1 py-0.5 bg-muted/40 text-[10px]",
        committed.regime === "choppy" && "text-yellow-400/70 bg-yellow-500/10"
      )}>
        {committed.regime}
      </span>
    </div>
  );
}
