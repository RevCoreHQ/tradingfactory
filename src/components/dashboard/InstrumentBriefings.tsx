"use client";

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
  Clock,
  Sparkles,
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
  const { instrument, biasResult, llmResult, quote } = data;
  const CategoryIcon = categoryIcons[instrument.category] || DollarSign;
  const changePercent = quote?.changePercent || 0;
  const isBullish = biasResult.overallBias > 0;
  const isBearish = biasResult.overallBias < 0;
  const color = getBiasColor(biasResult.direction);
  const isFavorite = favoriteIds.includes(instrument.id);
  const isPinned = pinnedIds.includes(instrument.id);
  const confidence = biasResult.confidence;

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
    <div className="section-card spotlight p-5 flex flex-col min-h-[320px]" onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--spotlight-x", `${e.clientX - r.left}px`); e.currentTarget.style.setProperty("--spotlight-y", `${e.clientY - r.top}px`); }}>
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
            {isPinned && <Pin className="h-3 w-3 text-neutral-accent fill-neutral-accent rotate-45" />}
          </div>
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
            {isBullish ? "Bullish" : isBearish ? "Bearish" : "Neutral"}
          </span>
        </div>
      </div>

      {/* Sub-header: display name + timestamp */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-muted-foreground/40">{instrument.displayName}</span>
        <div className="flex items-center gap-1 text-xs text-muted-foreground/40">
          <Clock className="h-3 w-3" />
          <span>{timeAgo(biasResult.timestamp)}</span>
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

      {/* Overall Bias Score */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl font-mono font-bold tabular" style={{ color }}>
          {isBullish ? "+" : ""}{Math.round(biasResult.overallBias)}
        </span>
        <div className="flex flex-col gap-0.5">
          {biasResult.signalAgreement !== undefined && (
            <span className="text-xs text-muted-foreground/50">
              {Math.round(biasResult.signalAgreement * 100)}% signal agreement
            </span>
          )}
        </div>
      </div>

      {/* Fundamental vs Technical + Momentum/Trend */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Tooltip>
          <TooltipTrigger render={<div />} className="bg-[var(--surface-0)] rounded-lg px-3 py-2 cursor-default">
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
          <TooltipTrigger render={<div />} className="bg-[var(--surface-0)] rounded-lg px-3 py-2 cursor-default">
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
          <TooltipTrigger className="flex items-center gap-1 bg-[var(--surface-0)] px-2.5 py-1 rounded-md text-xs font-mono cursor-default">
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
          <TooltipTrigger className="flex items-center gap-1 bg-[var(--surface-0)] px-2.5 py-1 rounded-md text-xs font-mono cursor-default">
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
      </div>

      {/* ADR */}
      {biasResult.adr && (
        <div className="flex items-center gap-3 flex-wrap text-xs font-mono text-muted-foreground/50 border-t border-border/20 pt-2 mb-3">
          <span>ADR:{biasResult.adr.pips}p</span>
        </div>
      )}

      {/* Analysis — inset container */}
      {summaryText && (
        <div className="bg-[var(--surface-0)] rounded-lg p-3 mb-4 flex-1">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-neutral-accent" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Analysis</span>
            </div>
            <div className="flex items-center gap-1.5">
              {llmResult?.riskAssessment && (
                <Tooltip>
                  <TooltipTrigger
                    className={cn(
                      "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded cursor-default",
                      llmResult.riskAssessment === "low" && "bg-bullish/15 text-bullish",
                      llmResult.riskAssessment === "medium" && "bg-amber/15 text-[var(--amber)]",
                      llmResult.riskAssessment === "high" && "bg-bearish/15 text-bearish"
                    )}
                  >
                    {llmResult.riskAssessment} risk
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <div className="flex flex-col gap-0.5 py-0.5 text-[11px]">
                      {getRiskReasons(biasResult).map((r, i) => (
                        <span key={i} className={i === 0 ? "font-semibold" : "opacity-70"}>{r}</span>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )}
              {llmResult?.conviction && (
                <span className={cn(
                  "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                  llmResult.conviction === "high" && "bg-bullish/15 text-bullish",
                  llmResult.conviction === "medium" && "bg-amber/15 text-[var(--amber)]",
                  llmResult.conviction === "low" && "bg-muted text-muted-foreground",
                )}>
                  {llmResult.conviction}
                </span>
              )}
              {llmResult?.outlook && (
                <span className={cn(
                  "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                  llmResult.outlook === "bullish" && "bg-bullish/15 text-bullish",
                  llmResult.outlook === "bearish" && "bg-bearish/15 text-bearish",
                  llmResult.outlook === "neutral" && "bg-neutral-accent/15 text-neutral-accent",
                )}>
                  {llmResult.outlook}
                </span>
              )}
            </div>
          </div>

          {/* Summary */}
          <p className="text-sm text-foreground/70 leading-relaxed">
            {summaryText}
          </p>

          {/* Details — always visible */}
          <div className="mt-3 space-y-2.5 border-t border-border/20 pt-2.5">
            {llmResult?.fundamentalReason && (
              <div>
                <div className="flex items-center gap-1.5">
                  <BiasDot score={fundScore} />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Fundamentals</span>
                </div>
                <p className="text-sm text-foreground/65 leading-relaxed mt-0.5">{llmResult.fundamentalReason}</p>
              </div>
            )}
            {llmResult?.technicalReason && (
              <div>
                <div className="flex items-center gap-1.5">
                  <BiasDot score={techScore} />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Technicals</span>
                </div>
                <p className="text-sm text-foreground/65 leading-relaxed mt-0.5">{llmResult.technicalReason}</p>
              </div>
            )}
            {llmResult?.catalysts && llmResult.catalysts.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-block h-1.5 w-1.5 rounded-full shrink-0",
                      llmResult.outlook === "bullish" ? "bg-bullish" : llmResult.outlook === "bearish" ? "bg-bearish" : "bg-muted-foreground/40"
                    )}
                  />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Catalysts</span>
                </div>
                <ul className="mt-0.5 space-y-0.5">
                  {llmResult.catalysts.map((c, i) => (
                    <li key={i} className="text-sm text-foreground/65 leading-relaxed flex items-start gap-1.5">
                      <span className="text-neutral-accent mt-1.5 shrink-0">&bull;</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
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
