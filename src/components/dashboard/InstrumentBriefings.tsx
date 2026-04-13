"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMarketStore } from "@/lib/store/market-store";
import { useRates } from "@/lib/hooks/useMarketData";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { getBiasColor } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import { SessionBadge } from "@/components/common/SessionIndicator";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { BiasResult } from "@/lib/types/bias";
import type { LLMAnalysisResult } from "@/lib/types/llm";
import type { Instrument, PriceQuote } from "@/lib/types/market";
import type { MTFTrendSummary } from "@/lib/types/mtf";
import { useMTFEmaTrend } from "@/lib/hooks/useMTFEmaTrend";
import {
  DollarSign,
  Bitcoin,
  BarChart3,
  Gem,
  Activity,
  ArrowRight,
  Star,
  Pin,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Sparkles,
  ChevronRight,
  Info,
  StickyNote,
} from "lucide-react";
import {
  DecisionDeskPanel,
  DecisionDeskExpandedSections,
  hasDecisionDeskExpandedContent,
} from "@/components/dashboard/DecisionDeskPanel";
import { sanitizeCatalysts } from "@/lib/calculations/llm-sanitize";
import {
  buildDeskWatchNote,
  deskRefDivergenceNote,
  deskSetupReferencePrice,
} from "@/lib/calculations/desk-watch-note";
import { formatPrice } from "@/lib/utils/formatters";
import { InstrumentPriceDisplay } from "@/components/common/InstrumentPriceDisplay";
import { computeTradeFilter } from "@/lib/calculations/trade-filter";
import { TradeFilterBar } from "@/components/dashboard/TradeFilterBar";

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
  mtfTrend: MTFTrendSummary | null;
}

/** Short on-card thesis; full text lives under “Full context”. */
function firstSentences(text: string, maxSentences: number): string {
  const parts = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (parts.length <= maxSentences) return text.trim();
  return parts.slice(0, maxSentences).join(" ").trim();
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

function BiasDot({ score }: { score: number }) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full shrink-0",
        score > 55 ? "bg-bullish" : score < 45 ? "bg-bearish" : "bg-muted-foreground/40"
      )}
    />
  );
}

function scoreArrow(score: number): string {
  if (score > 55) return "↑";
  if (score < 45) return "↓";
  return "–";
}

function scoreToneLabel(total: number): "bullish" | "bearish" | "neutral" {
  if (total > 55) return "bullish";
  if (total < 45) return "bearish";
  return "neutral";
}

function describeFundamentals(fund: BiasResult["fundamentalScore"]): string {
  const dir = (s: number) => s > 60 ? "supportive" : s < 40 ? "negative" : "mixed";
  const parts: string[] = [];

  const newsDir = dir(fund.newsSentiment);
  const sentDir = dir(fund.marketSentiment);
  if (newsDir === sentDir && newsDir !== "mixed") {
    parts.push(`News flow and market sentiment are both ${newsDir}`);
  } else {
    if (newsDir !== "mixed") parts.push(`News sentiment is ${newsDir}`);
    if (sentDir !== "mixed") parts.push(`market sentiment is ${sentDir}`);
    if (newsDir === "mixed" && sentDir === "mixed") parts.push("News and sentiment are mixed with no clear direction");
  }

  const cbDir = dir(fund.centralBankPolicy);
  if (cbDir !== "mixed") parts.push(`central bank policy leans ${cbDir === "supportive" ? "dovish" : "hawkish"}`);

  const imDir = dir(fund.intermarketCorrelation);
  if (imDir !== "mixed") parts.push(`cross-market flows are ${imDir}`);

  return parts.join(", ") + ".";
}

function describeTechnicals(tech: BiasResult["technicalScore"]): string {
  const parts: string[] = [];

  if (tech.trendDirection > 65) parts.push("Price is in a clear uptrend");
  else if (tech.trendDirection < 35) parts.push("Price is in a clear downtrend");
  else parts.push("No clear trend direction");

  if (tech.momentum > 65) parts.push("with strong bullish momentum");
  else if (tech.momentum < 35) parts.push("with strong bearish momentum");
  else parts.push("momentum is flat");

  if (tech.volatility > 65) parts.push("Volatility is elevated — expect wide swings");
  else if (tech.volatility < 35) parts.push("Volatility is compressed — breakout potential");

  if (tech.supportResistance > 60) parts.push("Price is near support levels");
  else if (tech.supportResistance < 40) parts.push("Price is near resistance");

  return parts.join(". ") + ".";
}

function deriveRiskLevel(biasResult: BiasResult): "low" | "medium" | "high" {
  const agreement = biasResult.signalAgreement;
  const vol = biasResult.technicalScore.volatility;
  const fundDir = biasResult.fundamentalScore.total > 50;
  const techDir = biasResult.technicalScore.total > 50;
  const conflicting = fundDir !== techDir;
  if (conflicting || agreement < 0.3 || vol > 70) return "high";
  if (agreement > 0.7 && !conflicting && vol < 60) return "low";
  return "medium";
}

function deriveOutlook(biasResult: BiasResult): "bullish" | "bearish" | "neutral" {
  if (biasResult.overallBias > 10) return "bullish";
  if (biasResult.overallBias < -10) return "bearish";
  return "neutral";
}

function deriveCatalysts(signals: BiasResult["signals"]): string[] {
  return signals
    .filter((s) => s.strength > 0.3 && s.description)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 4)
    .map((s) => s.description);
}

function getRiskReasons(biasResult: BiasResult): string[] {
  const agreement = Math.round(biasResult.signalAgreement * 100);
  const fundBullish = biasResult.fundamentalScore.total > 50;
  const techBullish = biasResult.technicalScore.total > 50;
  const conflicting = fundBullish !== techBullish;
  const vol = biasResult.technicalScore.volatility;

  const reasons: string[] = [];
  if (conflicting) reasons.push("Fundamental & technical signals conflict");
  else reasons.push("Fundamental & technical signals aligned");

  if (agreement > 70) reasons.push(`High signal agreement (${agreement}%)`);
  else if (agreement < 40) reasons.push(`Low signal agreement (${agreement}%)`);
  else reasons.push(`Moderate signal agreement (${agreement}%)`);

  if (vol > 65) reasons.push("Elevated volatility");
  else if (vol < 35) reasons.push("Low volatility — potential squeeze");

  return reasons;
}

function InstrumentCard({ data }: { data: InstrumentCardData }) {
  const router = useRouter();
  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument);
  const favoriteIds = useMarketStore((s) => s.favoriteIds);
  const toggleFavorite = useMarketStore((s) => s.toggleFavorite);
  const pinnedIds = useMarketStore((s) => s.pinnedIds);
  const togglePin = useMarketStore((s) => s.togglePin);
  const { instrument, biasResult, llmResult, quote, mtfTrend } = data;
  const CategoryIcon = categoryIcons[instrument.category] || DollarSign;
  /** Headline badge and bars must match `direction` (±10 thresholds), not raw score sign — avoids Bearish + neutral desk note. */
  const dirIsBullish = biasResult.direction.includes("bullish");
  const dirIsBearish = biasResult.direction.includes("bearish");
  const color = getBiasColor(biasResult.direction);
  const isFavorite = favoriteIds.includes(instrument.id);
  const isPinned = pinnedIds.includes(instrument.id);
  const confidence = biasResult.confidence;

  // AI summary with contradiction check
  const llmSummary = llmResult?.summary || null;
  const summaryContradictsDirection =
    llmSummary &&
    ((dirIsBullish && /\bbearish\b/i.test(llmSummary) && !/\bbullish\b/i.test(llmSummary)) ||
     (dirIsBearish && /\bbullish\b/i.test(llmSummary) && !/\bbearish\b/i.test(llmSummary)));

  // Generate deterministic summary from scores when LLM hasn't returned yet
  const fundTotal = biasResult.fundamentalScore.total;
  const techTotal = biasResult.technicalScore.total;
  const fundLabel = scoreToneLabel(fundTotal);
  const techLabel = scoreToneLabel(techTotal);
  const headlineBull = biasResult.overallBias > 10;
  const headlineBear = biasResult.overallBias < -10;
  const headlineNeu = !headlineBull && !headlineBear;
  const dirWord = headlineBull ? "bullish" : headlineBear ? "bearish" : "neutral";

  const narrativeDiverges =
    (headlineBull && (techLabel === "bearish" || fundLabel === "bearish")) ||
    (headlineBear && (techLabel === "bullish" || fundLabel === "bullish")) ||
    (fundLabel !== "neutral" && techLabel !== "neutral" && fundLabel !== techLabel);

  const bothAlignSame =
    !narrativeDiverges && fundLabel === techLabel && fundLabel !== "neutral";

  const agreementNote = biasResult.signalAgreement > 0.7
    ? "Multiple signals are aligned, supporting higher conviction."
    : biasResult.signalAgreement < 0.4
    ? "Signals are mixed — exercise caution and wait for confirmation."
    : "Signal alignment is moderate.";

  const deterministicSummary = (() => {
    if (headlineNeu) {
      return `${instrument.symbol} reads neutral overall (fundamentals ${fundLabel}, technicals ${techLabel}). ${agreementNote}`;
    }
    if (narrativeDiverges) {
      return `${instrument.symbol} shows a ${dirWord} headline score, but fundamentals (${fundLabel}) and technicals (${techLabel}) do not fully agree. ${agreementNote}`;
    }
    if (bothAlignSame) {
      return `${instrument.symbol} is showing ${fundLabel} conditions across both fundamentals and technicals. ${agreementNote}`;
    }
    const fundPhrase = fundLabel === "neutral" ? "mixed to neutral fundamentals" : `${fundLabel} fundamentals`;
    const techPhrase = techLabel === "neutral" ? "mixed to neutral technicals" : `${techLabel} technicals`;
    return `${instrument.symbol} leans ${dirWord} with ${fundPhrase} and ${techPhrase}. ${agreementNote}`;
  })();

  const summaryText =
    (summaryContradictsDirection ? null : llmSummary) ||
    biasResult.fundamentalReason ||
    biasResult.technicalReason ||
    deterministicSummary;

  const tradeFilter = useMemo(() => computeTradeFilter(biasResult), [biasResult]);
  const analysisPreviewSentences =
    tradeFilter.verdict === "no_trade" || tradeFilter.verdict === "wait" ? 1 : 2;

  // Scores
  const fund = biasResult.fundamentalScore;
  const tech = biasResult.technicalScore;
  const fundScore = fund.total;
  const techScore = tech.total;
  const momentum = tech.momentum;
  const trend = tech.trendDirection;

  const handleDeepDive = () => {
    setSelectedInstrument(instrument);
    router.push("/instrument");
  };

  // Sub-score data for tooltips
  const fundSubScores = [
    { label: "News Sentiment", score: fund.newsSentiment },
    { label: "Economic Data", score: fund.economicData },
    { label: "Central Bank", score: fund.centralBankPolicy },
    { label: "Market Sentiment", score: fund.marketSentiment },
    { label: "Intermarket", score: fund.intermarketCorrelation },
  ];
  const techSubScores = [
    { label: "Trend Direction", score: tech.trendDirection },
    { label: "Momentum", score: tech.momentum },
    { label: "Volatility", score: tech.volatility },
    { label: "Volume (VWAP)", score: tech.volumeAnalysis },
    { label: "Support/Resistance", score: tech.supportResistance },
  ];

  return (
    <div className="section-card spotlight p-3 sm:p-5 flex flex-col min-h-[320px]" onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--spotlight-x", `${e.clientX - r.left}px`); e.currentTarget.style.setProperty("--spotlight-y", `${e.clientY - r.top}px`); }}>
      {/* Header: Symbol + Category | % Change + Direction */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-6 w-6 rounded-md flex items-center justify-center",
              instrument.category === "forex" && "bg-neutral-accent/10",
              instrument.category === "crypto" && "bg-amber/10",
              instrument.category === "index" && "bg-bullish/10",
              instrument.category === "commodity" && "bg-bearish/10"
            )}
          >
            <CategoryIcon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold text-foreground">{instrument.symbol}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <InstrumentPriceDisplay
            instrument={instrument}
            showBidAsk={false}
            className="items-end"
          />
          <div className="flex flex-col items-end gap-0">
            <span
              className={cn(
                "px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide",
                dirIsBullish && "bg-bullish/15 text-bullish",
                dirIsBearish && "bg-bearish/15 text-bearish",
                !dirIsBullish && !dirIsBearish && "bg-neutral-accent/15 text-neutral-accent"
              )}
            >
              {biasResult.direction === "strong_bullish"
                ? "Strong bull"
                : biasResult.direction === "strong_bearish"
                  ? "Strong bear"
                  : dirIsBullish
                    ? "Bullish"
                    : dirIsBearish
                      ? "Bearish"
                      : "Neutral"}
            </span>
          </div>
        </div>
      </div>

      {/* Sub-header: display name + provider + timestamp */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground/40">{instrument.displayName}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground/40">
          <Clock className="h-3 w-3" />
          <span>{timeAgo(biasResult.timestamp)}</span>
        </div>
      </div>

      <TradeFilterBar bias={biasResult} compact className="mb-4" />

      {/* Confidence Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <Tooltip>
            <TooltipTrigger
              render={<span />}
              className="text-sm text-muted-foreground border-b border-dotted border-muted-foreground/30 cursor-help"
            >
              Model confidence
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
              How aligned fundamentals, technicals, and directional signals are with the headline bias — not win
              probability or position size.
            </TooltipContent>
          </Tooltip>
          <span className="text-sm font-semibold text-foreground">{Math.round(confidence)}%</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              dirIsBullish ? "bg-bullish" : dirIsBearish ? "bg-bearish" : "bg-neutral-accent"
            )}
            style={{ width: `${Math.round(confidence)}%` }}
          />
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground/65">
          Trade conviction:{" "}
          <span className="font-medium text-foreground/85 capitalize">
            {llmResult?.conviction ||
              (!dirIsBullish && !dirIsBearish
                ? confidence > 55
                  ? "medium"
                  : "low"
                : confidence > 70
                  ? "high"
                  : confidence > 45
                    ? "medium"
                    : "low")}
          </span>
          <Tooltip>
            <TooltipTrigger
              render={<span />}
              className="ml-1 border-b border-dotted border-muted-foreground/25 cursor-help text-muted-foreground/55"
            >
              (sizing)
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
              Suggested emphasis for new risk — from confidence, agreement, and fund/tech alignment — separate from the
              headline direction.
            </TooltipContent>
          </Tooltip>
        </p>
      </div>

      {/* Overall Bias Score */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl font-mono font-bold tabular" style={{ color }}>
          {biasResult.overallBias > 0 ? "+" : ""}{Math.round(biasResult.overallBias)}
        </span>
        <div className="flex flex-col gap-0.5">
          {biasResult.signalAgreement !== undefined && (
            <Tooltip>
              <TooltipTrigger
                render={<span />}
                className="text-xs text-muted-foreground/50 border-b border-dotted border-muted-foreground/20 cursor-help w-fit"
              >
                {Math.round(biasResult.signalAgreement * 100)}% signal agreement
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                Share of bullish vs bearish model signals (excluding neutral) that match the headline
                bias direction. Mixed or duplicate timeframe inputs can land near 50%.
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {biasResult.technicalBasis ? (
        <p className="text-[10px] text-muted-foreground/55 mb-2 leading-snug">
          Technical basis: {biasResult.technicalBasis}
        </p>
      ) : null}

      <DecisionDeskPanel bias={biasResult} mode="card" />

      {(() => {
        const livePriceForDesk =
          quote != null && quote.mid > 0
            ? quote.mid
            : quote != null && quote.bid > 0 && quote.ask > 0
              ? (quote.bid + quote.ask) / 2
              : undefined;
        const deskNote = buildDeskWatchNote(biasResult, instrument.decimalPlaces, {
          livePrice: livePriceForDesk,
        });
        if (!deskNote) return null;
        const planningOnly = !tradeFilter.emphasizeLevels;
        const deskRef = deskSetupReferencePrice(biasResult);
        const atrEstimate =
          biasResult.adr != null
            ? biasResult.adr.pips * instrument.pipSize
            : biasResult.tradeSetup
              ? Math.abs(biasResult.tradeSetup.entryZone[1] - biasResult.tradeSetup.entryZone[0]) / 0.25
              : undefined;
        const divergenceNote = deskRefDivergenceNote({
          livePrice: livePriceForDesk,
          deskRef,
          atrEstimate,
        });
        const hasLiveQuote =
          quote != null && (quote.mid > 0 || (quote.bid > 0 && quote.ask > 0));
        return (
          <div
            className={cn(
              "mb-3 rounded-lg border px-3 py-2.5",
              planningOnly
                ? "border-border/30 bg-muted/20 opacity-95"
                : "border-border/25 bg-[var(--surface-2)]/35"
            )}
          >
            {planningOnly ? (
              <p className="text-[10px] text-muted-foreground/80 mb-2 leading-snug">
                Trade filter says stand aside or wait — ATR levels below are for planning only, not a prompt to
                initiate.
              </p>
            ) : null}
            {hasLiveQuote || deskRef != null ? (
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-2 text-[11px] font-mono tabular-nums text-foreground/90">
                {hasLiveQuote && quote ? (
                  <span>
                    <span className="text-[10px] font-sans font-medium uppercase tracking-wide text-muted-foreground/70 mr-1.5">
                      Live
                    </span>
                    {quote.bid > 0 && quote.ask > 0 ? (
                      <>
                        <span className="text-muted-foreground/55 font-sans text-[10px] mr-0.5">Bid</span>
                        {formatPrice(quote.bid, instrument.decimalPlaces)}
                        <span className="text-muted-foreground/40 mx-1">·</span>
                        <span className="text-muted-foreground/55 font-sans text-[10px] mr-0.5">Ask</span>
                        {formatPrice(quote.ask, instrument.decimalPlaces)}
                      </>
                    ) : (
                      <>
                        <span className="text-muted-foreground/55 font-sans text-[10px] mr-0.5">Mid</span>
                        {formatPrice(quote.mid, instrument.decimalPlaces)}
                      </>
                    )}
                  </span>
                ) : null}
                {deskRef != null ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={<span />}
                      className="inline-flex items-baseline gap-1 border-b border-dotted border-muted-foreground/25 cursor-help"
                    >
                      <span className="text-[10px] font-sans font-medium uppercase tracking-wide text-muted-foreground/70">
                        Desk ref
                      </span>
                      <span>{formatPrice(deskRef, instrument.decimalPlaces)}</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                      Last close from the technicals batch used to anchor mechanical levels (not the live quote).
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            ) : null}
            {divergenceNote ? (
              <p className="text-[10px] text-amber-600/90 dark:text-amber-400/90 mb-2 leading-snug">
                {divergenceNote}
              </p>
            ) : null}
            <div className="flex items-center gap-1.5 mb-2">
              <StickyNote className="h-3.5 w-3.5 text-neutral-accent shrink-0" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Desk note — what to watch
              </span>
              <Tooltip>
                <TooltipTrigger
                  render={<span />}
                  className="ml-auto text-[10px] text-muted-foreground/50 border-b border-dotted border-muted-foreground/25 cursor-help"
                >
                  {deskNote.zoneBasisLabel}
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                  {deskNote.footnote}
                </TooltipContent>
              </Tooltip>
            </div>
            <ul className="space-y-1.5 text-[12px] text-foreground/85 leading-snug list-none">
              {deskNote.lines.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground/50 shrink-0 select-none" aria-hidden>
                    •
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-muted-foreground/70 mt-2 leading-snug border-t border-border/20 pt-2">
              {deskNote.referenceHint}
            </p>
          </div>
        );
      })()}

      {/* Fundamental vs Technical + Momentum/Trend */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Tooltip>
          <TooltipTrigger render={<div />} className="bg-[var(--surface-2)]/50 rounded-lg px-3 py-2 cursor-default border border-border/10">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground/60">Fundamental</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={cn("text-lg font-mono font-bold", fundScore > 50 ? "text-bullish" : "text-bearish")}>
                {Math.round(fundScore)}
              </span>
              <div className="w-16 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                <div
                  className={cn("h-full rounded-full", fundScore > 50 ? "bg-bullish" : "bg-bearish")}
                  style={{ width: `${Math.round(fundScore)}%` }}
                />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="flex flex-col gap-0.5 py-0.5 font-mono text-[11px]">
              {fundSubScores.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-4">
                  <span className="opacity-70">{s.label}</span>
                  <span>{Math.round(s.score)} {scoreArrow(s.score)}</span>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<div />} className="bg-[var(--surface-2)]/50 rounded-lg px-3 py-2 cursor-default border border-border/10">
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground/60">Technical</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={cn("text-lg font-mono font-bold", techScore > 50 ? "text-bullish" : "text-bearish")}>
                {Math.round(techScore)}
              </span>
              <div className="w-16 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
                <div
                  className={cn("h-full rounded-full", techScore > 50 ? "bg-bullish" : "bg-bearish")}
                  style={{ width: `${Math.round(techScore)}%` }}
                />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="flex flex-col gap-0.5 py-0.5 font-mono text-[11px]">
              {techSubScores.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-4">
                  <span className="opacity-70">{s.label}</span>
                  <span>{Math.round(s.score)} {scoreArrow(s.score)}</span>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Momentum + Trend pills */}
      <div className="flex items-center gap-2 mb-3">
        <Tooltip>
          <TooltipTrigger className="flex items-center gap-1 bg-[var(--surface-2)]/50 px-2.5 py-1 rounded-md text-xs font-mono cursor-default border border-border/10">
            {momentum > 50
              ? <TrendingUp className="h-3 w-3 text-bullish" />
              : <TrendingDown className="h-3 w-3 text-bearish" />
            }
            <span className="text-muted-foreground/60">Mom</span>
            <span className={cn("font-semibold", momentum > 50 ? "text-bullish" : "text-bearish")}>
              {Math.round(momentum)}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div className="flex flex-col gap-0.5 py-0.5 text-[11px]">
              <span className="font-semibold">Momentum: {Math.round(momentum)}/100</span>
              <span className="opacity-70">RSI (40%) + MACD (40%) + StochRSI (20%)</span>
            </div>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger className="flex items-center gap-1 bg-[var(--surface-2)]/50 px-2.5 py-1 rounded-md text-xs font-mono cursor-default border border-border/10">
            {trend > 50
              ? <TrendingUp className="h-3 w-3 text-bullish" />
              : <TrendingDown className="h-3 w-3 text-bearish" />
            }
            <span className="text-muted-foreground/60">Trend</span>
            <span className={cn("font-semibold", trend > 50 ? "text-bullish" : "text-bearish")}>
              {Math.round(trend)}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div className="flex flex-col gap-0.5 py-0.5 text-[11px]">
              <span className="font-semibold">Trend: {Math.round(trend)}/100</span>
              <span className="opacity-70">Moving average alignment + trend pattern</span>
            </div>
          </TooltipContent>
        </Tooltip>
        <SessionBadge instrumentId={instrument.id} />
        {biasResult.adr ? (
          <Tooltip>
            <TooltipTrigger
              render={<button type="button" />}
              className="p-1 rounded-md text-muted-foreground/40 hover:text-muted-foreground border border-transparent hover:border-border/40"
              aria-label="Average daily range"
            >
              <Info className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              ADR: {biasResult.adr.pips} pips (average daily range — context for stops and volatility).
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      {/* MTF EMA Trend — prefers batch-scores snapshot so pills agree with mtfAlignmentPercent */}
      {mtfTrend && mtfTrend.trends.length > 0 && (
        <div className="mb-3 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger
                render={<span />}
                className="text-[10px] text-muted-foreground/50 font-medium mr-0.5 cursor-help border-b border-dotted border-muted-foreground/20"
              >
                EMA
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                Same batch snapshot as MTF alignment in the desk when available; otherwise live MTF data may differ
                slightly from batch totals.
              </TooltipContent>
            </Tooltip>
            {(["15m", "1h", "4h", "1d"] as const).map((tf) => {
              const t = mtfTrend.trends.find((tr) => tr.timeframe === tf);
              if (!t) return null;
              const dir = t.direction;
              return (
                <Tooltip key={tf}>
                  <TooltipTrigger className={cn(
                    "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 cursor-default",
                    dir === "bullish" && "bg-bullish/12 text-bullish",
                    dir === "bearish" && "bg-bearish/12 text-bearish",
                    dir === "neutral" && "bg-muted text-muted-foreground"
                  )}>
                    {dir === "bullish" ? <TrendingUp className="h-2.5 w-2.5" /> : dir === "bearish" ? <TrendingDown className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
                    {tf === "1d" ? "D" : tf.toUpperCase()}
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <div className="flex flex-col gap-0.5 py-0.5 text-[11px]">
                      <span className="font-semibold">{tf} EMA Stack: {dir}</span>
                      <span className="opacity-70">EMA9: {t.ema9.toFixed(instrument.decimalPlaces)}</span>
                      <span className="opacity-70">EMA21: {t.ema21.toFixed(instrument.decimalPlaces)}</span>
                      <span className="opacity-70">EMA50: {t.ema50.toFixed(instrument.decimalPlaces)}</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
            {mtfTrend.alignment === "full" && (
              <span className="text-[9px] font-bold uppercase text-muted-foreground/40 ml-1">Aligned</span>
            )}
          </div>
        </div>
      )}

      {/* Analysis — short thesis; full desk + narrative in one “Full context” block below */}
      {summaryText && (
        <div
          className={cn(
            "bg-[var(--surface-2)]/40 rounded-lg p-3 mb-3 flex-1 border border-border/15 transition-opacity",
            (tradeFilter.verdict === "no_trade" || tradeFilter.verdict === "wait") && "opacity-80"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-neutral-accent" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Analysis</span>
            </div>
            <div className="flex items-center gap-1.5">
              {(() => {
                const risk = llmResult?.riskAssessment || deriveRiskLevel(biasResult);
                return (
                  <Tooltip>
                    <TooltipTrigger
                      className={cn(
                        "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded cursor-default",
                        risk === "low" && "bg-bullish/15 text-bullish",
                        risk === "medium" && "bg-amber/15 text-[var(--amber)]",
                        risk === "high" && "bg-bearish/15 text-bearish"
                      )}
                    >
                      {risk} risk
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="flex flex-col gap-0.5 py-0.5 text-[11px]">
                        {getRiskReasons(biasResult).map((r, i) => (
                          <span key={i} className={i === 0 ? "font-semibold" : "opacity-70"}>{r}</span>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })()}
              {(() => {
                const conviction = llmResult?.conviction || (confidence > 70 ? "high" : confidence > 45 ? "medium" : "low");
                return (
                  <Tooltip>
                    <TooltipTrigger
                      className={cn(
                        "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded cursor-default",
                        conviction === "high" && "bg-bullish/15 text-bullish",
                        conviction === "medium" && "bg-amber/15 text-[var(--amber)]",
                        conviction === "low" && "bg-muted text-muted-foreground",
                      )}
                    >
                      {conviction} conviction
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="flex flex-col gap-0.5 py-0.5 text-[11px]">
                        <span className="font-semibold">Conviction: {conviction}</span>
                        <span className="opacity-70">Based on confidence ({Math.round(confidence)}%), signal agreement, and fundamental-technical alignment</span>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })()}
            </div>
          </div>

          {(tradeFilter.verdict === "no_trade" || tradeFilter.verdict === "wait") && (
            <p className="text-[10px] font-medium text-muted-foreground/90 mb-1.5 uppercase tracking-wide">
              Context — not a trade call
            </p>
          )}

          <p className="text-sm text-foreground/80 leading-relaxed">
            {firstSentences(summaryText, analysisPreviewSentences)}
          </p>
        </div>
      )}

      {(hasDecisionDeskExpandedContent(biasResult) || summaryText) && (
        <details className="group mb-4 rounded-lg border border-border/20 bg-[var(--surface-1)]/30 open:bg-[var(--surface-1)]/45">
          <summary className="cursor-pointer list-none px-3 py-2.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90 text-muted-foreground/60" />
            Full context — desk, fundamentals, technicals, catalysts
          </summary>
          <div className="space-y-3 border-t border-border/20 px-3 pb-3 pt-2 text-sm">
            {summaryText ? (
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Full summary</p>
                <p className="text-sm text-foreground/80 leading-relaxed">{summaryText}</p>
              </div>
            ) : null}
            <DecisionDeskExpandedSections bias={biasResult} />
            {(() => {
              const fundReason = llmResult?.fundamentalReason || describeFundamentals(fund);
              return (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <BiasDot score={fundScore} />
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Fundamentals</span>
                  </div>
                  <p className="text-sm text-foreground/75 leading-relaxed">{fundReason}</p>
                </div>
              );
            })()}
            {(() => {
              const techReason = llmResult?.technicalReason || describeTechnicals(tech);
              return (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <BiasDot score={techScore} />
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Technicals</span>
                  </div>
                  <p className="text-sm text-foreground/75 leading-relaxed">{techReason}</p>
                </div>
              );
            })()}
            {(() => {
              const raw =
                llmResult?.catalysts?.length ? llmResult.catalysts : deriveCatalysts(biasResult.signals);
              const catalysts = sanitizeCatalysts(raw) ?? raw;
              const outlook = llmResult?.outlook || deriveOutlook(biasResult);
              if (catalysts.length === 0) return null;
              return (
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={cn(
                        "inline-block h-1.5 w-1.5 rounded-full shrink-0",
                        outlook === "bullish" ? "bg-bullish" : outlook === "bearish" ? "bg-bearish" : "bg-muted-foreground/40"
                      )}
                    />
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Catalysts</span>
                  </div>
                  <ul className="space-y-0.5">
                    {catalysts.map((c, i) => (
                      <li key={i} className="text-sm text-foreground/75 leading-relaxed flex items-start gap-1.5">
                        <span className="text-neutral-accent mt-1.5 shrink-0">&bull;</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </div>
        </details>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3 mt-auto pt-3 border-t border-border/20">
        <button
          onClick={handleDeepDive}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium border border-border hover:border-border-bright bg-[var(--surface-1)] hover:bg-[var(--surface-2)] text-foreground transition-colors duration-200"
        >
          Deep Dive
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => togglePin(instrument.id)}
          className={cn(
            "p-2.5 rounded-lg border transition-colors",
            isPinned
              ? "border-neutral-accent/30 text-neutral-accent bg-neutral-accent/10"
              : "border-border text-muted-foreground/40 hover:text-muted-foreground hover:border-border-bright"
          )}
        >
          <Pin className={cn("h-4 w-4", isPinned && "fill-neutral-accent rotate-45")} />
        </button>
        <button
          onClick={() => toggleFavorite(instrument.id)}
          className={cn(
            "p-2.5 rounded-lg border transition-colors",
            isFavorite
              ? "border-[#FFD700]/30 text-[#FFD700] bg-[#FFD700]/10"
              : "border-border text-muted-foreground/40 hover:text-muted-foreground hover:border-border-bright"
          )}
        >
          <Star className={cn("h-4 w-4", isFavorite && "fill-[#FFD700]")} />
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
  const { trends: mtfTrends } = useMTFEmaTrend();
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
      mtfTrend: currentResults[inst.id]?.mtfEmaSummary ?? mtfTrends[inst.id] ?? null,
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
