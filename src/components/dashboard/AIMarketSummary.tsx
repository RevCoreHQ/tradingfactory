"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMarketSummary } from "@/lib/hooks/useMarketSummary";
import { cn } from "@/lib/utils";
import { Sparkles, AlertTriangle, Zap, ChevronDown, RefreshCw, Target, Ban } from "lucide-react";
import { GlowingEffect } from "@/components/ui/glowing-effect";

function OutlookBadge({ outlook }: { outlook: "bullish" | "bearish" | "neutral" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
        outlook === "bullish" && "bg-bullish/15 text-bullish glow-bullish",
        outlook === "bearish" && "bg-bearish/15 text-bearish glow-bearish",
        outlook === "neutral" && "bg-neutral-accent/15 text-neutral-accent glow-primary"
      )}
    >
      {outlook}
    </span>
  );
}

function SectorCard({ sector }: { sector: { sector: string; outlook: "bullish" | "bearish" | "neutral"; keyAssets: string[]; focusPairs?: string[]; avoidPairs?: string[] } }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className={cn(
        "bg-[var(--surface-2)] rounded-lg p-3 border border-border/30 text-left w-full transition-colors",
        "hover:border-border-bright cursor-pointer"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold capitalize text-foreground">
          {sector.sector}
        </span>
        <div className="flex items-center gap-1.5">
          <OutlookBadge outlook={sector.outlook} />
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-3 w-3 text-muted-foreground/30" />
          </motion.div>
        </div>
      </div>

      {/* Collapsed: show first asset truncated */}
      {!expanded && sector.keyAssets.length > 0 && (
        <p className="text-[10px] text-muted-foreground leading-snug truncate">
          {sector.keyAssets[0]}
        </p>
      )}

      {/* Expanded: show all assets with animation */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 pt-1">
              {sector.keyAssets.map((asset, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                  className="text-[10px] text-muted-foreground leading-snug"
                >
                  <span className="text-muted-foreground/30 mr-1.5">•</span>
                  {asset}
                </motion.p>
              ))}
              {sector.focusPairs && sector.focusPairs.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/30">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-bullish">Focus</span>
                  {sector.focusPairs.map((fp, j) => (
                    <p key={j} className="text-[10px] text-bullish/80 leading-snug pl-3">• {fp}</p>
                  ))}
                </div>
              )}
              {sector.avoidPairs && sector.avoidPairs.length > 0 && (
                <div className="mt-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Avoid</span>
                  {sector.avoidPairs.map((ap, j) => (
                    <p key={j} className="text-[10px] text-muted-foreground/60 leading-snug pl-3">• {ap}</p>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  );
}

function SectorBreakdown({ sectors }: { sectors: { sector: string; outlook: "bullish" | "bearish" | "neutral"; keyAssets: string[]; focusPairs?: string[]; avoidPairs?: string[] }[] }) {
  return (
    <div className="mt-5 pt-4 border-t border-border/50">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
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
  const { summary, isLoading, isRefreshing, apiError, refresh } = useMarketSummary();

  if (isLoading) {
    return (
      <div className="section-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-6 w-6 rounded-md flex items-center justify-center bg-neutral-accent/15">
            <Sparkles className="h-3.5 w-3.5 text-neutral-accent" />
          </div>
          <h3 className="text-xs font-semibold text-foreground">AI Market Summary</h3>
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
      <div className="section-card p-5">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 rounded-md flex items-center justify-center bg-neutral-accent/10">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <h3 className="text-xs font-semibold text-foreground">AI Market Summary</h3>
          <span className="text-[10px] text-muted-foreground/50 ml-auto">
            {apiError
              ? `AI error: ${apiError}`
              : "AI analysis unavailable — check API keys in Vercel settings"}
          </span>
        </div>
      </div>
    );
  }

  const timeSince = summary.timestamp
    ? `${Math.round((Date.now() - summary.timestamp) / 60_000)}m ago`
    : "";

  return (
    <div className="relative section-card p-5">
      <GlowingEffect
        spread={40}
        glow={true}
        disabled={false}
        proximity={64}
        inactiveZone={0.01}
        borderWidth={2}
      />
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="h-6 w-6 rounded-md flex items-center justify-center bg-neutral-accent/15">
          <Sparkles className="h-3.5 w-3.5 text-neutral-accent" />
        </div>
        <h3 className="text-xs font-semibold text-foreground">AI Market Summary</h3>
        <span className="text-[9px] font-mono text-muted-foreground/40 px-1.5 py-0.5 bg-[var(--surface-2)] rounded">
          {summary.provider === "gemini" ? "Gemini Flash" : summary.provider === "anthropic" ? "Claude Sonnet" : "GPT-4o Mini"}
        </span>
        <div className="flex items-center gap-2 ml-auto">
          {timeSince && (
            <span className="text-[9px] font-mono text-muted-foreground/40">
              {timeSince}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-md hover:bg-[var(--surface-2)] text-muted-foreground/40 hover:text-muted-foreground transition-colors disabled:opacity-40"
            title="Refresh AI summary"
          >
            <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Overview + Outlook */}
        <div className="lg:col-span-7">
          <p className="text-[13px] text-foreground/85 leading-relaxed mb-4">
            {summary.overview}
          </p>
          <OutlookBadge outlook={summary.outlook} />
        </div>

        {/* Risks + Opportunities */}
        <div className="lg:col-span-5 space-y-4">
          {summary.risks.length > 0 && (
            <div className="bg-bearish/5 rounded-lg p-3 border border-bearish/10">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="h-3 w-3 text-bearish" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-bearish">Key Risks</span>
              </div>
              <ul className="space-y-1.5">
                {summary.risks.map((risk, i) => (
                  <li key={i} className="text-[11px] text-foreground/70 leading-snug pl-3 relative before:absolute before:left-0 before:top-[6px] before:h-1.5 before:w-1.5 before:rounded-full before:bg-bearish/30">
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary.opportunities.length > 0 && (
            <div className="bg-bullish/5 rounded-lg p-3 border border-bullish/10">
              <div className="flex items-center gap-1.5 mb-2">
                <Zap className="h-3 w-3 text-bullish" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-bullish">Opportunities</span>
              </div>
              <ul className="space-y-1.5">
                {summary.opportunities.map((opp, i) => (
                  <li key={i} className="text-[11px] text-foreground/70 leading-snug pl-3 relative before:absolute before:left-0 before:top-[6px] before:h-1.5 before:w-1.5 before:rounded-full before:bg-bullish/30">
                    {opp}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Sector Outlook */}
      {summary.sectorOutlook && summary.sectorOutlook.length > 0 && (
        <SectorBreakdown sectors={summary.sectorOutlook} />
      )}

      {/* Focus Today / Sit Out */}
      {(summary.focusToday?.length || summary.sitOutToday?.length) ? (
        <div className="mt-5 pt-4 border-t border-border/50">
          {summary.focusToday && summary.focusToday.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-[10px] font-bold uppercase tracking-wider text-bullish flex items-center gap-1.5">
                <Target className="h-3 w-3" />
                Focus Today
              </div>
              {summary.focusToday.map((pair, i) => (
                <span key={i} className="text-[11px] font-medium text-foreground bg-bullish/10 px-2.5 py-1 rounded-md border border-bullish/20">
                  {pair}
                </span>
              ))}
            </div>
          )}

          {summary.sitOutToday && summary.sitOutToday.length > 0 && (
            <div className="flex items-center gap-3 flex-wrap mt-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Ban className="h-3 w-3" />
                Sit Out
              </div>
              {summary.sitOutToday.map((note, i) => (
                <span key={i} className="text-[11px] text-muted-foreground bg-[var(--surface-2)] px-2.5 py-1 rounded-md border border-border/30">
                  {note}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
