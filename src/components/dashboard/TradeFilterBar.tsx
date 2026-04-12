"use client";

import type { BiasResult } from "@/lib/types/bias";
import { computeTradeFilter } from "@/lib/calculations/trade-filter";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Ban, Clock, Scale, ShieldCheck, AlertTriangle } from "lucide-react";

export function TradeFilterBar({
  bias,
  className,
  compact = false,
}: {
  bias: BiasResult;
  className?: string;
  /** Slightly smaller padding/text for dense cards */
  compact?: boolean;
}) {
  const filter = computeTradeFilter(bias);

  const Icon =
    filter.verdict === "no_trade"
      ? Ban
      : filter.verdict === "wait"
        ? Clock
        : filter.verdict === "lean"
          ? Scale
          : ShieldCheck;

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5 sm:px-4 sm:py-3",
        filter.verdict === "no_trade" &&
          "border-bearish/35 bg-bearish/[0.07] dark:bg-bearish/[0.09]",
        filter.verdict === "wait" &&
          "border-[var(--amber)]/40 bg-[var(--amber)]/[0.06] dark:bg-[var(--amber)]/[0.08]",
        filter.verdict === "lean" &&
          "border-neutral-accent/35 bg-neutral-accent/[0.06] dark:bg-neutral-accent/[0.08]",
        filter.verdict === "consider" && "border-bullish/30 bg-bullish/[0.06] dark:bg-bullish/[0.08]",
        className
      )}
    >
      <div className={cn("flex items-start gap-2.5", compact && "gap-2")}>
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
            filter.verdict === "no_trade" && "bg-bearish/15 text-bearish",
            filter.verdict === "wait" && "bg-[var(--amber)]/15 text-[var(--amber)]",
            filter.verdict === "lean" && "bg-neutral-accent/15 text-neutral-accent",
            filter.verdict === "consider" && "bg-bullish/15 text-bullish",
            compact && "h-7 w-7"
          )}
        >
          <Icon className={cn("h-4 w-4", compact && "h-3.5 w-3.5")} />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "font-semibold tracking-tight text-foreground",
                compact ? "text-sm" : "text-sm sm:text-base"
              )}
            >
              {filter.title}
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase",
                filter.verdict === "no_trade" && "bg-bearish/15 text-bearish",
                filter.verdict === "wait" && "bg-[var(--amber)]/15 text-[var(--amber)]",
                filter.verdict === "lean" && "bg-neutral-accent/15 text-neutral-accent",
                filter.verdict === "consider" && "bg-bullish/15 text-bullish"
              )}
            >
              {filter.verdict.replace("_", " ")}
            </span>
            {filter.reasons.length > 0 && (
              <Tooltip>
                <TooltipTrigger
                  render={<button type="button" />}
                  className="inline-flex items-center gap-0.5 rounded text-[10px] font-medium text-muted-foreground hover:text-foreground"
                >
                  <AlertTriangle className="h-3 w-3" />
                  Why
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed">
                  <ul className="list-disc space-y-1 pl-4">
                    {filter.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className={cn("text-muted-foreground leading-snug", compact ? "text-[11px]" : "text-xs sm:text-sm")}>
            {filter.subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}

export function useTradeFilter(bias: BiasResult) {
  return computeTradeFilter(bias);
}
