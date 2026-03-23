"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMarketStore } from "@/lib/store/market-store";
import { useRates } from "@/lib/hooks/useMarketData";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { cn } from "@/lib/utils";
import type { BiasResult } from "@/lib/types/bias";
import type { LLMAnalysisResult } from "@/lib/types/llm";
import type { Instrument, PriceQuote } from "@/lib/types/market";
import {
  Pin,
  Clock,
  Sparkles,
} from "lucide-react";

interface InstrumentCardData {
  instrument: Instrument;
  biasResult: BiasResult;
  llmResult: LLMAnalysisResult | null;
  quote: PriceQuote | null;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function InstrumentCard({ data }: { data: InstrumentCardData }) {
  const router = useRouter();
  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument);
  const pinnedIds = useMarketStore((s) => s.pinnedIds);
  const togglePin = useMarketStore((s) => s.togglePin);
  const [expanded, setExpanded] = useState(false);

  const { instrument, biasResult, llmResult, quote } = data;
  const changePercent = quote?.changePercent || 0;
  const isBullish = biasResult.overallBias > 0;
  const isBearish = biasResult.overallBias < 0;
  const isPinned = pinnedIds.includes(instrument.id);
  const confidence = biasResult.confidence;
  const direction = isBullish ? "Bullish" : isBearish ? "Bearish" : "Neutral";

  // AI summary with contradiction check
  const llmSummary = llmResult?.summary || null;
  const summaryContradictsDirection =
    llmSummary &&
    ((isBullish && /\bbearish\b/i.test(llmSummary) && !/\bbullish\b/i.test(llmSummary)) ||
     (isBearish && /\bbullish\b/i.test(llmSummary) && !/\bbearish\b/i.test(llmSummary)));
  const summaryText =
    (summaryContradictsDirection ? null : llmSummary) ||
    biasResult.fundamentalReason ||
    biasResult.technicalReason ||
    null;

  const handleDeepDive = () => {
    setSelectedInstrument(instrument);
    router.push("/instrument");
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 flex flex-col min-h-[320px]">
      {/* Header: Symbol | Change + Direction */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-foreground">{instrument.symbol}</span>
          {isPinned && <Pin className="h-3 w-3 text-neutral-accent fill-neutral-accent rotate-45" />}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-mono font-semibold",
              changePercent > 0 ? "text-bullish" : changePercent < 0 ? "text-bearish" : "text-muted-foreground"
            )}
          >
            {changePercent > 0 ? "+" : ""}{changePercent.toFixed(2)}%
          </span>
          <span
            className={cn(
              "px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide",
              isBullish && "bg-bullish/15 text-bullish",
              isBearish && "bg-bearish/15 text-bearish",
              !isBullish && !isBearish && "bg-neutral-accent/15 text-neutral-accent"
            )}
          >
            {direction}
          </span>
        </div>
      </div>

      {/* Confidence Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm text-muted-foreground">Confidence</span>
          <span className="text-sm font-semibold text-foreground">{Math.round(confidence)}%</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isBullish ? "bg-bullish" : isBearish ? "bg-bearish" : "bg-neutral-accent"
            )}
            style={{ width: `${Math.round(confidence)}%` }}
          />
        </div>
      </div>

      {/* Last Update */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50 mb-4">
        <Clock className="h-3 w-3" />
        <span>Last update: {timeAgo(biasResult.timestamp)}</span>
      </div>

      {/* AI Analysis — inset container */}
      {summaryText && (
        <div className="bg-[var(--surface-0)] rounded-lg p-3 mb-4 flex-1">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-neutral-accent" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Analysis</span>
          </div>
          <p
            className={cn(
              "text-sm text-foreground/70 leading-relaxed",
              !expanded && "line-clamp-3"
            )}
          >
            {summaryText}
          </p>
          {summaryText.length > 120 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-neutral-accent hover:text-neutral-accent/80 mt-1.5 font-medium"
            >
              {expanded ? "Read less" : "Read more"}
            </button>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3 mt-auto pt-3">
        <button
          onClick={() => togglePin(instrument.id)}
          className={cn(
            "flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors",
            isPinned
              ? "border-neutral-accent/30 text-neutral-accent bg-neutral-accent/10"
              : "border-border text-muted-foreground hover:text-foreground hover:border-border-bright"
          )}
        >
          {isPinned ? "Pinned" : "Quick Overview"}
        </button>
        <button
          onClick={handleDeepDive}
          className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Deep Dive
        </button>
      </div>
    </div>
  );
}

export function InstrumentBriefings() {
  const allBiasResults = useMarketStore((s) => s.allBiasResults);
  const batchLLMResults = useMarketStore((s) => s.batchLLMResults);
  const pinnedIds = useMarketStore((s) => s.pinnedIds);
  const { data: ratesData } = useRates();
  const quotes = ratesData?.quotes || {};
  const currentResults = allBiasResults.intraday;

  const cards = INSTRUMENTS.reduce<InstrumentCardData[]>((acc, inst) => {
    const bias = currentResults[inst.id];
    if (!bias) return acc;
    acc.push({
      instrument: inst,
      biasResult: bias,
      llmResult: batchLLMResults?.[inst.id] || null,
      quote: quotes[inst.id] || null,
    });
    return acc;
  }, []).sort((a, b) => {
    // Pinned instruments always come first
    const aPinned = pinnedIds.includes(a.instrument.id) ? 1 : 0;
    const bPinned = pinnedIds.includes(b.instrument.id) ? 1 : 0;
    if (bPinned !== aPinned) return bPinned - aPinned;
    // Then sort by conviction (highest absolute bias first)
    return Math.abs(b.biasResult.overallBias) - Math.abs(a.biasResult.overallBias);
  });

  if (cards.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-72 shimmer rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card) => (
        <InstrumentCard key={card.instrument.id} data={card} />
      ))}
    </div>
  );
}
