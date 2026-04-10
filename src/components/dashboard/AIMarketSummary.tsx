"use client";

import { useState, useRef, useEffect } from "react";

import { useMarketSummary } from "@/lib/hooks/useMarketSummary";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  AlertTriangle,
  Zap,
  RefreshCw,
  ChevronDown,
  ListChecks,
  Ban,
} from "lucide-react";
import { GlowingEffect } from "@/components/ui/glowing-effect";

const LIST_CAP = 3;

function splitHeadlineBody(overview: string): { headline: string; body: string } {
  const idx = overview.search(/[.!?]\s/);
  if (idx >= 0) {
    return { headline: overview.slice(0, idx + 1), body: overview.slice(idx + 2) };
  }
  return { headline: overview, body: "" };
}

const MOOD_MAP: Record<string, string> = {
  bullish: "Optimistic",
  bearish: "Cautious",
  neutral: "Neutral",
};

function MoodBadge({
  current,
  previous,
  outlook,
}: {
  current: string;
  previous: string | null;
  outlook: "bullish" | "bearish" | "neutral";
}) {
  return (
    <span
      title={`Global outlook: ${outlook}`}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[12px] font-semibold",
        outlook === "bullish" && "bg-bullish/10 text-bullish",
        outlook === "bearish" && "bg-bearish/10 text-bearish",
        outlook === "neutral" && "bg-neutral-accent/10 text-neutral-accent"
      )}
    >
      {previous && previous !== current ? (
        <>
          <span className="opacity-50">{previous}</span>
          <span className="opacity-30">&rarr;</span>
          <span>{current}</span>
        </>
      ) : (
        current
      )}
    </span>
  );
}

function OutlookBadge({ outlook }: { outlook: "bullish" | "bearish" | "neutral" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-bold uppercase tracking-wider",
        outlook === "bullish" && "bg-bullish/15 text-bullish glow-bullish",
        outlook === "bearish" && "bg-bearish/15 text-bearish glow-bearish",
        outlook === "neutral" && "bg-neutral-accent/15 text-neutral-accent glow-primary"
      )}
    >
      {outlook}
    </span>
  );
}

function TruncatedBullets({
  items,
  variant,
}: {
  items: string[];
  variant: "risk" | "opp";
}) {
  const dot =
    variant === "risk"
      ? "before:bg-bearish/40"
      : "before:bg-bullish/40";
  const shown = items.slice(0, LIST_CAP);
  const rest = items.slice(LIST_CAP);

  const row = (text: string, i: number) => (
    <p
      key={`${variant}-${i}`}
      className={cn(
        "text-[13px] text-foreground/70 leading-snug pl-3 relative before:absolute before:left-0 before:top-[6px] before:h-1 before:w-1 before:rounded-full",
        dot
      )}
    >
      {text}
    </p>
  );

  return (
    <>
      {shown.map((t, i) => row(t, i))}
      {rest.length > 0 && (
        <details className="group/more mt-1">
          <summary
            className={cn(
              "flex min-h-9 cursor-pointer list-none touch-manipulation items-center gap-1 py-1 text-[11px] font-medium text-muted-foreground/80 hover:text-muted-foreground",
              "[&::-webkit-details-marker]:hidden"
            )}
          >
            <ChevronDown className="h-3 w-3 shrink-0 transition-transform group-open/more:rotate-180" />
            {rest.length} more
          </summary>
          <div className="mt-1.5 space-y-1.5 border-l border-border/30 pl-2 ml-0.5">
            {rest.map((t, i) => row(t, LIST_CAP + i))}
          </div>
        </details>
      )}
    </>
  );
}

function SectorCard({
  sector,
}: {
  sector: {
    sector: string;
    outlook: "bullish" | "bearish" | "neutral";
    keyAssets: string[];
    focusPairs?: string[];
    avoidPairs?: string[];
  };
}) {
  return (
    <div
      className={cn(
        "bg-[var(--surface-2)] rounded-lg p-3 border border-border/30 text-left w-full",
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold capitalize text-foreground">
          {sector.sector}
        </span>
        <OutlookBadge outlook={sector.outlook} />
      </div>

      <div className="space-y-1.5 pt-1">
        {sector.keyAssets.map((asset, i) => (
          <p
            key={i}
            className="text-[13px] text-muted-foreground leading-snug"
          >
            <span className="text-muted-foreground/30 mr-1.5">&bull;</span>
            {asset}
          </p>
        ))}
        {sector.focusPairs && sector.focusPairs.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/30">
            <span className="text-[11px] font-bold uppercase tracking-wider text-bullish">
              Focus
            </span>
            {sector.focusPairs.map((fp, j) => (
              <p
                key={j}
                className="text-[12px] text-bullish/80 leading-snug pl-3"
              >
                &bull; {fp}
              </p>
            ))}
          </div>
        )}
        {sector.avoidPairs && sector.avoidPairs.length > 0 && (
          <div className="mt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Avoid
            </span>
            {sector.avoidPairs.map((ap, j) => (
              <p
                key={j}
                className="text-[12px] text-muted-foreground/60 leading-snug pl-3"
              >
                &bull; {ap}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SectorBreakdown({
  sectors,
}: {
  sectors: {
    sector: string;
    outlook: "bullish" | "bearish" | "neutral";
    keyAssets: string[];
    focusPairs?: string[];
    avoidPairs?: string[];
  }[];
}) {
  return (
    <div className="pt-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {sectors.map((sector) => (
          <SectorCard key={sector.sector} sector={sector} />
        ))}
      </div>
    </div>
  );
}

export function AIMarketSummary() {
  const { summary, isLoading, isRefreshing, apiError, refresh } =
    useMarketSummary();
  const previousOutlookRef = useRef<string | null>(null);
  const [previousMood, setPreviousMood] = useState<string | null>(null);

  useEffect(() => {
    if (summary?.outlook) {
      if (
        previousOutlookRef.current &&
        previousOutlookRef.current !== summary.outlook
      ) {
        setPreviousMood(MOOD_MAP[previousOutlookRef.current] ?? null);
      }
      previousOutlookRef.current = summary.outlook;
    }
  }, [summary?.outlook]);

  if (isLoading) {
    return (
      <div className="section-card p-3 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-6 w-6 rounded-md flex items-center justify-center bg-neutral-accent/15">
            <Sparkles className="h-3.5 w-3.5 text-neutral-accent" />
          </div>
          <h3 className="text-xs font-semibold text-foreground">
            Market Summary
          </h3>
        </div>
        <div className="space-y-3">
          <div className="h-4 w-3/4 shimmer rounded" />
          <div className="h-4 w-full shimmer rounded" />
          <div className="h-4 w-2/3 shimmer rounded" />
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="section-card p-3 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded-md flex items-center justify-center bg-neutral-accent/10">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <h3 className="text-xs font-semibold text-foreground">
            Market Summary
          </h3>
          <span className="text-[12px] text-muted-foreground/50 ml-auto">
            {apiError
              ? `Error: ${apiError}`
              : "Analysis unavailable — check API keys in Vercel settings"}
          </span>
        </div>
      </div>
    );
  }

  const { headline, body } = splitHeadlineBody(summary.overview);
  const currentMood = MOOD_MAP[summary.outlook] ?? "Neutral";
  const focusToday = summary.focusToday ?? [];
  const sitOutToday = summary.sitOutToday ?? [];

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const timeSince = summary.timestamp
    ? `${Math.round((Date.now() - summary.timestamp) / 60_000)}m ago`
    : "";

  const sectorCount = summary.sectorOutlook?.length ?? 0;

  return (
    <div className="relative section-card p-3 sm:p-5">
      <GlowingEffect
        spread={40}
        glow={true}
        disabled={false}
        proximity={64}
        inactiveZone={0.01}
        borderWidth={2}
      />

      {/* Top bar: Date + Mood + Provider/Refresh */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-mono text-muted-foreground/60 sm:text-[13px] shrink-0">
            {dateStr}
          </span>
          <MoodBadge
            current={currentMood}
            previous={previousMood}
            outlook={summary.outlook}
          />
        </div>
        <div className="flex items-center gap-2">
          {timeSince && (
            <span className="text-[11px] font-mono text-muted-foreground/40">
              {timeSince}
            </span>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={isRefreshing}
            className="flex min-h-10 min-w-10 items-center justify-center rounded-md p-2 touch-manipulation hover:bg-[var(--surface-2)] text-muted-foreground/40 hover:text-muted-foreground transition-colors disabled:opacity-40 sm:min-h-0 sm:min-w-0 sm:p-1.5"
            title="Refresh summary"
            aria-label="Refresh market summary"
          >
            <RefreshCw
              className={cn("h-4 w-4 sm:h-3 sm:w-3", isRefreshing && "animate-spin")}
            />
          </button>
        </div>
      </div>

      {/* Hero thesis */}
      <h3 className="text-[15px] font-bold text-foreground leading-snug mb-3 sm:text-sm">
        {headline}
      </h3>

      {/* Scannable focus / sit-out (model-enriched in hook) */}
      {(focusToday.length > 0 || sitOutToday.length > 0) && (
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {focusToday.length > 0 && (
            <div className="rounded-lg border border-bullish/20 bg-bullish/5 px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <ListChecks className="h-3 w-3 text-bullish shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-bullish">
                  Focus today
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {focusToday.map((f) => (
                  <span
                    key={f}
                    className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-background/60 text-bullish border border-bullish/15"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
          {sitOutToday.length > 0 && (
            <div className="rounded-lg border border-border/40 bg-[var(--surface-2)]/40 px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Ban className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Sit out / caution
                </span>
              </div>
              <ul className="space-y-1">
                {sitOutToday.map((s) => (
                  <li
                    key={s}
                    className="text-[12px] text-muted-foreground/85 leading-snug pl-2 border-l-2 border-muted-foreground/20"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Rest of overview behind disclosure */}
      {body ? (
        <details className="group/ctx mb-4 rounded-md border border-border/25 bg-[var(--surface-1)]/30 open:bg-[var(--surface-1)]/50">
          <summary className="flex min-h-10 cursor-pointer list-none touch-manipulation items-center gap-1.5 px-2.5 py-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open/ctx:rotate-180" />
            More context
          </summary>
          <p className="text-xs text-foreground/75 leading-relaxed px-2.5 pb-2.5 pt-0">
            {body}
          </p>
        </details>
      ) : null}

      {/* Risks & Opportunities — capped with expand */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {summary.risks.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-2.5 w-2.5 text-bearish" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-bearish">
                Key risks
              </span>
            </div>
            <TruncatedBullets items={summary.risks} variant="risk" />
          </div>
        )}

        {summary.opportunities.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Zap className="h-2.5 w-2.5 text-bullish" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-bullish">
                Opportunities
              </span>
            </div>
            <TruncatedBullets items={summary.opportunities} variant="opp" />
          </div>
        )}
      </div>

      {/* Sectors — collapsed by default */}
      {summary.sectorOutlook && summary.sectorOutlook.length > 0 && (
        <details className="group/sectors mt-5 rounded-md border border-border/25 bg-[var(--surface-1)]/25 open:border-border/40">
          <summary className="flex min-h-11 cursor-pointer list-none touch-manipulation items-center gap-2 px-3 py-2.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open/sectors:rotate-180" />
            <span>
              Sector breakdown
              <span className="ml-1.5 font-mono text-[11px] font-normal text-muted-foreground/60">
                ({sectorCount})
              </span>
            </span>
          </summary>
          <div className="px-3 pb-3">
            <SectorBreakdown sectors={summary.sectorOutlook} />
          </div>
        </details>
      )}
    </div>
  );
}
