"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMarketStore } from "@/lib/store/market-store";
import { useRates } from "@/lib/hooks/useMarketData";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { cn } from "@/lib/utils";
import type { BiasResult, BiasDirection } from "@/lib/types/bias";
import type { LLMAnalysisResult } from "@/lib/types/llm";
import type { Instrument, PriceQuote } from "@/lib/types/market";
import { DollarSign, Bitcoin, BarChart3, Gem, ChevronDown, ChevronUp } from "lucide-react";

const categoryIcons: Record<string, typeof DollarSign> = {
  forex: DollarSign,
  crypto: Bitcoin,
  index: BarChart3,
  commodity: Gem,
};

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

function DirectionBadge({ direction, confidence }: { direction: BiasDirection; confidence: number }) {
  const isBullish = direction.includes("bullish");
  const isBearish = direction.includes("bearish");
  const label = isBullish ? "Bullish" : isBearish ? "Bearish" : "Neutral";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
        isBullish && "bg-bullish/15 text-bullish",
        isBearish && "bg-bearish/15 text-bearish",
        !isBullish && !isBearish && "bg-neutral-accent/15 text-neutral-accent"
      )}
    >
      {label}
      <span className="opacity-70">{confidence.toFixed(0)}%</span>
    </span>
  );
}

function InstrumentCard({ data }: { data: InstrumentCardData }) {
  const [expanded, setExpanded] = useState(false);
  const { instrument, biasResult, llmResult, quote } = data;

  const CategoryIcon = categoryIcons[instrument.category] || DollarSign;
  const changePercent = quote?.changePercent || 0;
  const isBullish = biasResult.overallBias > 0;
  const isBearish = biasResult.overallBias < 0;

  // AI summary: prefer LLM batch result, fallback to bias reasons
  // Safety: if LLM summary contradicts the final blended direction, discard it
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

  // Signals: prefer LLM signals, fallback to bias signals
  const allSignals = llmResult?.signals || biasResult.signals;
  const visibleSignals = expanded ? allSignals : allSignals.slice(0, 3);
  const hasMore = allSignals.length > 3;

  return (
    <div
      className={cn(
        "section-card p-4 flex flex-col border-l-[3px]",
        isBullish && "border-l-bullish",
        isBearish && "border-l-bearish",
        !isBullish && !isBearish && "border-l-neutral-accent"
      )}
    >
      {/* Header: Symbol + Category + % Change */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-5 w-5 rounded flex items-center justify-center",
              instrument.category === "forex" && "bg-neutral-accent/15",
              instrument.category === "crypto" && "bg-amber/15",
              instrument.category === "index" && "bg-bullish/15",
              instrument.category === "commodity" && "bg-bearish/15"
            )}
          >
            <CategoryIcon className="h-3 w-3 text-muted-foreground" />
          </div>
          <span className="text-xs font-bold text-foreground">
            {instrument.symbol}
          </span>
        </div>
        <span
          className={cn(
            "text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded",
            changePercent > 0
              ? "bg-bullish/12 text-bullish"
              : changePercent < 0
                ? "bg-bearish/12 text-bearish"
                : "bg-muted text-muted-foreground"
          )}
        >
          {changePercent > 0 ? "+" : ""}
          {changePercent.toFixed(2)}%
        </span>
      </div>

      {/* Last update */}
      <span className="text-[9px] text-muted-foreground/50 mb-2">
        Last update: {timeAgo(biasResult.timestamp)}
      </span>

      {/* Direction badge + confidence */}
      <div className="mb-3">
        <DirectionBadge
          direction={biasResult.direction}
          confidence={biasResult.confidence}
        />
      </div>

      {/* AI Summary */}
      {summaryText && (
        <p className="text-[11px] text-foreground/70 leading-relaxed mb-3 line-clamp-3">
          {summaryText}
        </p>
      )}

      {/* Key bullet points */}
      {visibleSignals.length > 0 && (
        <div className="space-y-1 mb-2">
          {visibleSignals.map((signal, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px]">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full mt-1 shrink-0",
                  signal.signal === "bullish"
                    ? "bg-bullish"
                    : signal.signal === "bearish"
                      ? "bg-bearish"
                      : "bg-muted-foreground/30"
                )}
              />
              <span className="text-muted-foreground/70 leading-snug">
                {signal.description}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Expanded: catalysts, key levels, risk */}
      <AnimatePresence>
        {expanded && llmResult && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2 space-y-2">
              {llmResult.catalysts && llmResult.catalysts.length > 0 && (
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Catalysts
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {llmResult.catalysts.map((c, i) => (
                      <span
                        key={i}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-muted-foreground/60"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {llmResult.keyLevels &&
                llmResult.keyLevels.support > 0 && (
                  <div className="flex gap-3 text-[10px] font-mono">
                    <span className="text-bullish/70">
                      S: {llmResult.keyLevels.support.toFixed(instrument.decimalPlaces)}
                    </span>
                    <span className="text-bearish/70">
                      R: {llmResult.keyLevels.resistance.toFixed(instrument.decimalPlaces)}
                    </span>
                  </div>
                )}

              {llmResult.riskAssessment && (
                <span
                  className={cn(
                    "inline-block text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                    llmResult.riskAssessment === "low" &&
                      "bg-bullish/15 text-bullish",
                    llmResult.riskAssessment === "medium" &&
                      "bg-amber/15 text-[var(--amber)]",
                    llmResult.riskAssessment === "high" &&
                      "bg-bearish/15 text-bearish"
                  )}
                >
                  {llmResult.riskAssessment} risk
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Overview / Deep Dive toggle */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] text-neutral-accent hover:text-foreground transition-colors mt-auto pt-2 border-t border-border/30"
        >
          {expanded ? (
            <>
              Quick Overview <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              Deep Dive <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

export function InstrumentBriefings() {
  const allBiasResults = useMarketStore((s) => s.allBiasResults);
  const batchLLMResults = useMarketStore((s) => s.batchLLMResults);
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
  }, []).sort((a, b) => Math.abs(b.biasResult.overallBias) - Math.abs(a.biasResult.overallBias));

  if (cards.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 shimmer rounded-lg" />
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
