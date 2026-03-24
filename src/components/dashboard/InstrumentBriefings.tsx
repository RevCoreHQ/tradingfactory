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
  mtfTrend: MTFTrendSummary | null;
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

  // Generate deterministic summary from scores when LLM hasn't returned yet
  const fundTotal = biasResult.fundamentalScore.total;
  const techTotal = biasResult.technicalScore.total;
  const dir = isBullish ? "bullish" : isBearish ? "bearish" : "neutral";
  const fundLabel = fundTotal > 55 ? "bullish" : fundTotal < 45 ? "bearish" : "neutral";
  const techLabel = techTotal > 55 ? "bullish" : techTotal < 45 ? "bearish" : "neutral";
  const conflicting = fundLabel !== techLabel && fundLabel !== "neutral" && techLabel !== "neutral";
  const agreementNote = biasResult.signalAgreement > 0.7
    ? "Multiple signals are aligned, supporting higher conviction."
    : biasResult.signalAgreement < 0.4
    ? "Signals are mixed — exercise caution and wait for confirmation."
    : "Signal alignment is moderate.";
  const deterministicSummary = conflicting
    ? `${instrument.symbol} has conflicting signals — fundamentals lean ${fundLabel} while technicals lean ${techLabel}. ${agreementNote}`
    : `${instrument.symbol} is showing ${dir} conditions across both fundamentals and technicals. ${agreementNote}`;

  const summaryText =
    (summaryContradictsDirection ? null : llmSummary) ||
    biasResult.fundamentalReason ||
    biasResult.technicalReason ||
    deterministicSummary;

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

      {/* Sub-header: display name + provider + timestamp */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground/40">{instrument.displayName}</span>
          {quote?.provider && (
            <Tooltip>
              <TooltipTrigger className="text-[9px] font-mono text-muted-foreground/25 uppercase tracking-wider cursor-default">
                via {quote.provider === "polygon" ? "Polygon" : quote.provider === "fmp" ? "FMP" : quote.provider === "yahoo" ? "Yahoo" : quote.provider === "coingecko" ? "CoinGecko" : quote.provider}
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Price data from {quote.provider === "polygon" ? "Polygon (Massive)" : quote.provider === "fmp" ? "Financial Modeling Prep" : quote.provider === "yahoo" ? "Yahoo Finance" : quote.provider === "coingecko" ? "CoinGecko" : quote.provider}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
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

      {/* MTF EMA Trend */}
      {mtfTrend && mtfTrend.trends.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-[10px] text-muted-foreground/40 font-medium mr-0.5">EMA</span>
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
      )}

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
              {(() => {
                const outlook = llmResult?.outlook || deriveOutlook(biasResult);
                return (
                  <span className={cn(
                    "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                    outlook === "bullish" && "bg-bullish/15 text-bullish",
                    outlook === "bearish" && "bg-bearish/15 text-bearish",
                    outlook === "neutral" && "bg-neutral-accent/15 text-neutral-accent",
                  )}>
                    {outlook}
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Summary */}
          <p className="text-sm text-foreground/70 leading-relaxed">
            {summaryText}
          </p>

          {/* Details — always visible */}
          <div className="mt-3 space-y-2.5 border-t border-border/20 pt-2.5">
            {(() => {
              const fundReason = llmResult?.fundamentalReason || describeFundamentals(fund);
              return (
                <div>
                  <div className="flex items-center gap-1.5">
                    <BiasDot score={fundScore} />
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Fundamentals</span>
                  </div>
                  <p className="text-sm text-foreground/65 leading-relaxed mt-0.5">{fundReason}</p>
                </div>
              );
            })()}
            {(() => {
              const techReason = llmResult?.technicalReason || describeTechnicals(tech);
              return (
                <div>
                  <div className="flex items-center gap-1.5">
                    <BiasDot score={techScore} />
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Technicals</span>
                  </div>
                  <p className="text-sm text-foreground/65 leading-relaxed mt-0.5">{techReason}</p>
                </div>
              );
            })()}
            {(() => {
              const catalysts = llmResult?.catalysts?.length ? llmResult.catalysts : deriveCatalysts(biasResult.signals);
              const outlook = llmResult?.outlook || deriveOutlook(biasResult);
              if (catalysts.length === 0) return null;
              return (
                <div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-block h-1.5 w-1.5 rounded-full shrink-0",
                        outlook === "bullish" ? "bg-bullish" : outlook === "bearish" ? "bg-bearish" : "bg-muted-foreground/40"
                      )}
                    />
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Catalysts</span>
                  </div>
                  <ul className="mt-0.5 space-y-0.5">
                    {catalysts.map((c, i) => (
                      <li key={i} className="text-sm text-foreground/65 leading-relaxed flex items-start gap-1.5">
                        <span className="text-neutral-accent mt-1.5 shrink-0">&bull;</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
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
      mtfTrend: mtfTrends[inst.id] || null,
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
