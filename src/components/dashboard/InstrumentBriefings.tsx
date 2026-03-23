"use client";

import { useRouter } from "next/navigation";
import { useMarketStore } from "@/lib/store/market-store";
import { useRates } from "@/lib/hooks/useMarketData";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { getBiasColor } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import { SessionBadge } from "@/components/common/SessionIndicator";
import type { BiasResult, BiasDirection } from "@/lib/types/bias";
import type { LLMAnalysisResult } from "@/lib/types/llm";
import type { Instrument, PriceQuote } from "@/lib/types/market";
import {
  DollarSign,
  Bitcoin,
  BarChart3,
  Gem,
  Activity,
  Brain,
  ArrowRight,
  Star,
  Pin,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

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

function ScoreBar({ label, score, icon: Icon }: { label: string; score: number; icon: typeof BarChart3 }) {
  const isBullish = score > 50;
  return (
    <div className="flex-1 space-y-1">
      <div className="flex items-center gap-1 text-[10px]">
        <Icon className="h-3 w-3 text-muted-foreground/50" />
        <span className="font-mono text-muted-foreground">{label}:{Math.round(score)}</span>
      </div>
      <div className="h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", isBullish ? "bg-bullish" : "bg-bearish")}
          style={{ width: `${Math.round(score)}%` }}
        />
      </div>
    </div>
  );
}

function InstrumentCard({ data }: { data: InstrumentCardData }) {
  const router = useRouter();
  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument);
  const favoriteIds = useMarketStore((s) => s.favoriteIds);
  const toggleFavorite = useMarketStore((s) => s.toggleFavorite);
  const pinnedIds = useMarketStore((s) => s.pinnedIds);
  const togglePin = useMarketStore((s) => s.togglePin);

  const { instrument, biasResult, llmResult, quote } = data;
  const CategoryIcon = categoryIcons[instrument.category] || DollarSign;
  const changePercent = quote?.changePercent || 0;
  const isBullish = biasResult.overallBias > 0;
  const isBearish = biasResult.overallBias < 0;
  const color = getBiasColor(biasResult.direction);
  const isFavorite = favoriteIds.includes(instrument.id);
  const isPinned = pinnedIds.includes(instrument.id);

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

  // Scores
  const fundScore = biasResult.fundamentalScore.total;
  const techScore = biasResult.technicalScore.total;
  const momentum = biasResult.technicalScore.momentum;
  const trend = biasResult.technicalScore.trendDirection;
  const dec = instrument.decimalPlaces;

  const handleDeepAnalysis = () => {
    setSelectedInstrument(instrument);
    router.push("/instrument");
  };

  return (
    <div
      className={cn(
        "section-card p-4 flex flex-col border-l-[3px] min-h-[280px]",
        isBullish && "border-l-bullish",
        isBearish && "border-l-bearish",
        !isBullish && !isBearish && "border-l-neutral-accent"
      )}
    >
      {/* A. Header: Symbol + Category + % Change */}
      <div className="flex items-center justify-between mb-0.5">
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
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-foreground">{instrument.symbol}</span>
            {isPinned && <Pin className="h-3 w-3 text-neutral-accent fill-neutral-accent rotate-45" />}
            <span className="text-[9px] text-muted-foreground/40">{instrument.displayName}</span>
          </div>
        </div>
        <span
          className={cn(
            "text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded",
            changePercent > 0 ? "bg-bullish/12 text-bullish" : changePercent < 0 ? "bg-bearish/12 text-bearish" : "bg-muted text-muted-foreground"
          )}
        >
          {changePercent > 0 ? "+" : ""}{changePercent.toFixed(2)}%
        </span>
      </div>
      <span className="text-[9px] text-muted-foreground/40 mb-2">
        {timeAgo(biasResult.timestamp)}
      </span>

      {/* B. Overall Bias Score */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl font-mono font-bold tabular" style={{ color }}>
          {isBullish ? "+" : ""}{Math.round(biasResult.overallBias)}
        </span>
        <div className="flex flex-col gap-1">
          <DirectionBadge direction={biasResult.direction} confidence={biasResult.confidence} />
          {biasResult.signalAgreement !== undefined && (
            <span className="text-[9px] text-muted-foreground/40">
              {Math.round(biasResult.signalAgreement * 100)}% signal agreement
            </span>
          )}
        </div>
      </div>

      {/* C. Fundamental vs Technical Bars */}
      <div className="flex gap-3 mb-3">
        <ScoreBar label="F" score={fundScore} icon={BarChart3} />
        <ScoreBar label="T" score={techScore} icon={Activity} />
      </div>

      {/* D. Momentum vs Trend (LTF/HTF proxy) */}
      <div className="flex items-center gap-2 mb-3">
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono",
          "bg-[var(--surface-2)]"
        )}>
          {momentum > 50
            ? <TrendingUp className="h-3 w-3 text-bullish" />
            : <TrendingDown className="h-3 w-3 text-bearish" />
          }
          <span className="text-muted-foreground/60">Momentum</span>
          <span className={cn("font-semibold", momentum > 50 ? "text-bullish" : "text-bearish")}>
            {Math.round(momentum)}
          </span>
        </div>
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono",
          "bg-[var(--surface-2)]"
        )}>
          {trend > 50
            ? <TrendingUp className="h-3 w-3 text-bullish" />
            : <TrendingDown className="h-3 w-3 text-bearish" />
          }
          <span className="text-muted-foreground/60">Trend</span>
          <span className={cn("font-semibold", trend > 50 ? "text-bullish" : "text-bearish")}>
            {Math.round(trend)}
          </span>
        </div>
      </div>

      {/* E. Key Data Row */}
      <div className="flex items-center gap-3 flex-wrap text-[9px] font-mono text-muted-foreground/50 border-t border-border/20 pt-2 mb-3">
        {llmResult?.keyLevels && llmResult.keyLevels.support > 0 && (
          <>
            <span className="text-bullish/60">S:{llmResult.keyLevels.support.toFixed(dec)}</span>
            <span className="text-bearish/60">R:{llmResult.keyLevels.resistance.toFixed(dec)}</span>
          </>
        )}
        {biasResult.adr && <span>ADR:{biasResult.adr.pips}p</span>}
        <SessionBadge instrumentId={instrument.id} />
        {llmResult?.riskAssessment && (
          <span
            className={cn(
              "font-bold uppercase px-1 py-0.5 rounded text-[8px]",
              llmResult.riskAssessment === "low" && "bg-bullish/15 text-bullish",
              llmResult.riskAssessment === "medium" && "bg-amber/15 text-[var(--amber)]",
              llmResult.riskAssessment === "high" && "bg-bearish/15 text-bearish"
            )}
          >
            {llmResult.riskAssessment} risk
          </span>
        )}
      </div>

      {/* F. AI Summary */}
      {summaryText && (
        <div className="mb-3">
          <div className="flex items-center gap-1 mb-1">
            <Brain className="h-3 w-3 text-neutral-accent/60" />
            <span className="text-[9px] font-semibold text-muted-foreground/40 uppercase tracking-wider">AI Analysis</span>
          </div>
          <p className="text-[11px] text-foreground/70 leading-relaxed line-clamp-2">
            {summaryText}
          </p>
        </div>
      )}

      {/* G. Action Buttons */}
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/30">
        <button
          onClick={handleDeepAnalysis}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-accent hover:text-foreground transition-colors"
        >
          Deep Analysis
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => togglePin(instrument.id)}
            className={cn(
              "flex items-center gap-1 text-[10px] transition-colors",
              isPinned ? "text-neutral-accent" : "text-muted-foreground/40 hover:text-muted-foreground"
            )}
          >
            <Pin className={cn("h-3.5 w-3.5", isPinned && "fill-neutral-accent rotate-45")} />
            {isPinned ? "Pinned" : "Pin"}
          </button>
          <button
            onClick={() => toggleFavorite(instrument.id)}
            className={cn(
              "flex items-center gap-1 text-[10px] transition-colors",
              isFavorite ? "text-[#FFD700]" : "text-muted-foreground/40 hover:text-muted-foreground"
            )}
          >
            <Star className={cn("h-3.5 w-3.5", isFavorite && "fill-[#FFD700]")} />
            {isFavorite ? "Tracked" : "Track"}
          </button>
        </div>
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
