"use client";

import { useMarketSummary } from "@/lib/hooks/useMarketSummary";
import { cn } from "@/lib/utils";
import { Sparkles, AlertTriangle, TrendingUp } from "lucide-react";

function OutlookBadge({ outlook }: { outlook: "bullish" | "bearish" | "neutral" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
        outlook === "bullish" && "bg-bullish/15 text-bullish",
        outlook === "bearish" && "bg-bearish/15 text-bearish",
        outlook === "neutral" && "bg-neutral-accent/15 text-neutral-accent"
      )}
    >
      {outlook}
    </span>
  );
}

export function AIMarketSummary() {
  const { summary, isLoading } = useMarketSummary();

  if (isLoading) {
    return (
      <div className="panel rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-neutral-accent" />
          <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            AI Market Summary
          </h3>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-3/4 shimmer rounded" />
          <div className="h-4 w-full shimmer rounded" />
          <div className="h-4 w-2/3 shimmer rounded" />
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="panel rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            AI Market Summary
          </h3>
          <span className="text-[10px] text-muted-foreground/50 ml-auto">Requires Gemini API key</span>
        </div>
      </div>
    );
  }

  const timeSince = summary.timestamp
    ? `${Math.round((Date.now() - summary.timestamp) / 60_000)}m ago`
    : "";

  return (
    <div className="panel rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-3.5 w-3.5 text-neutral-accent" />
        <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          AI Market Summary
        </h3>
        <span className="text-[9px] font-mono text-muted-foreground/40 ml-1">
          {summary.provider === "gemini" ? "Gemini Flash" : "GPT-4o Mini"}
        </span>
        {timeSince && (
          <span className="text-[9px] font-mono text-muted-foreground/40 ml-auto">
            {timeSince}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Overview */}
        <div className="lg:col-span-7">
          <p className="text-xs text-foreground/80 leading-relaxed mb-3">
            {summary.overview}
          </p>
          <OutlookBadge outlook={summary.outlook} />
        </div>

        {/* Risks + Opportunities */}
        <div className="lg:col-span-5 space-y-3">
          {summary.risks.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <AlertTriangle className="h-3 w-3 text-bearish" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-bearish">Risks</span>
              </div>
              <ul className="space-y-1">
                {summary.risks.map((risk, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground leading-snug pl-3 relative before:absolute before:left-0 before:top-[6px] before:h-1 before:w-1 before:rounded-full before:bg-bearish/40">
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.opportunities.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1.5">
                <TrendingUp className="h-3 w-3 text-bullish" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-bullish">Opportunities</span>
              </div>
              <ul className="space-y-1">
                {summary.opportunities.map((opp, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground leading-snug pl-3 relative before:absolute before:left-0 before:top-[6px] before:h-1 before:w-1 before:rounded-full before:bg-bullish/40">
                    {opp}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
