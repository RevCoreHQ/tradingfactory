"use client";

import { useState, useRef, useEffect } from "react";

import { useMarketSummary } from "@/lib/hooks/useMarketSummary";
import { cn } from "@/lib/utils";
import { Sparkles, AlertTriangle, Zap, RefreshCw } from "lucide-react";
import { GlowingEffect } from "@/components/ui/glowing-effect";

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
    <div className="mt-5 pt-4 border-t border-border/50">
      <div className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
        Sector Breakdown
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const timeSince = summary.timestamp
    ? `${Math.round((Date.now() - summary.timestamp) / 60_000)}m ago`
    : "";

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
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-mono text-muted-foreground/60 hidden sm:inline">
            {dateStr}
          </span>
          <MoodBadge
            current={currentMood}
            previous={previousMood}
            outlook={summary.outlook}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-muted-foreground/40 px-1.5 py-0.5 bg-[var(--surface-2)] rounded hidden sm:inline">
            AI Analysis
          </span>
          {timeSince && (
            <span className="text-[11px] font-mono text-muted-foreground/40">
              {timeSince}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-md hover:bg-[var(--surface-2)] text-muted-foreground/40 hover:text-muted-foreground transition-colors disabled:opacity-40"
            title="Refresh summary"
          >
            <RefreshCw
              className={cn("h-3 w-3", isRefreshing && "animate-spin")}
            />
          </button>
        </div>
      </div>

      {/* Headline */}
      <h3 className="text-sm font-bold text-foreground leading-snug mb-2">
        {headline}
      </h3>

      {/* Body */}
      {body && (
        <p className="text-xs text-foreground/75 leading-relaxed mb-4">
          {body}
        </p>
      )}

      {/* Outlook badge */}
      <div className="mb-4">
        <OutlookBadge outlook={summary.outlook} />
      </div>

      {/* Risks & Opportunities — compact inline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {summary.risks.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-2.5 w-2.5 text-bearish" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-bearish">
                Key Risks
              </span>
            </div>
            {summary.risks.map((risk, i) => (
              <p
                key={i}
                className="text-[13px] text-foreground/70 leading-snug pl-3 relative before:absolute before:left-0 before:top-[6px] before:h-1 before:w-1 before:rounded-full before:bg-bearish/40"
              >
                {risk}
              </p>
            ))}
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
            {summary.opportunities.map((opp, i) => (
              <p
                key={i}
                className="text-[13px] text-foreground/70 leading-snug pl-3 relative before:absolute before:left-0 before:top-[6px] before:h-1 before:w-1 before:rounded-full before:bg-bullish/40"
              >
                {opp}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Sector Outlook */}
      {summary.sectorOutlook && summary.sectorOutlook.length > 0 && (
        <SectorBreakdown sectors={summary.sectorOutlook} />
      )}
    </div>
  );
}
