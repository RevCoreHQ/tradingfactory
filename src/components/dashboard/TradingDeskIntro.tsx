"use client";

import { Brain, Sparkles } from "lucide-react";

/**
 * High-level orientation for the desk — mechanical truth vs advisory layer.
 */
export function TradingDeskIntro() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-[var(--surface-1)]/90 via-[var(--surface-1)]/50 to-transparent px-4 py-4 md:px-6 md:py-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      <div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-neutral-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-bullish/5 blur-2xl" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-accent/25 bg-neutral-accent/10 text-neutral-accent shadow-[0_0_20px_oklch(0.55_0.14_180/0.2)]">
          <Brain className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight text-foreground md:text-lg">
              Unified trading brain
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-neutral-accent/20 bg-neutral-accent/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-accent/90">
              <Sparkles className="h-3 w-3" />
              Live
            </span>
          </div>
          <p className="max-w-3xl text-[13px] leading-relaxed text-muted-foreground md:text-sm">
            The desk runs one mechanical pipeline — bias, MTF, structure, conviction tiers, and the
            trade filter — then layers Risk Auditor commentary for portfolio and event context. Nothing
            here reranks entries; it explains and warns. Use the{" "}
            <span className="font-medium text-foreground/80">?</span> beside each section to go deeper.
          </p>
        </div>
      </div>
    </div>
  );
}
