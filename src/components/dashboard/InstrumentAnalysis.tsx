"use client";

import { Header } from "./Header";
import { Watchlist } from "./Watchlist";
import { DailyBriefing } from "./DailyBriefing";
import { SectionHeader } from "./SectionHeader";
import { BiasBreakdown } from "@/components/bias/BiasBreakdown";
import { BiasHistory } from "@/components/bias/BiasHistory";
import { CurrencyStrength } from "@/components/fundamentals/CurrencyStrength";
import { TechnicalOverview } from "@/components/technicals/TechnicalOverview";
import { DeepAnalysis } from "@/components/technicals/DeepAnalysis";
import { TradeSetupCard } from "./TradeSetupCard";
import { useMarketStore } from "@/lib/store/market-store";
import { useBiasScore } from "@/lib/hooks/useBiasScore";
import { useTechnicalData } from "@/lib/hooks/useTechnicalData";
import { saveBiasToHistory } from "@/components/bias/BiasHistory";
import { BiasAccuracyCard } from "@/components/bias/BiasAccuracy";
import { SessionCard } from "@/components/common/SessionIndicator";
import { QuickTradeLog } from "@/components/journal/QuickTradeLog";
import { MTFConfluence } from "@/components/technicals/MTFConfluence";
import { useRealtimePrices } from "@/lib/hooks/useRealtimePrices";
import { generateTradeDeskSetup, selectTradingStyle } from "@/lib/calculations/mechanical-signals";
import { getSessionRelevance } from "@/lib/calculations/session-scoring";
import { getBiasColor } from "@/lib/utils/formatters";
import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  History,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Minus,
  Sparkles,
  Zap,
  Target,
  ShieldCheck,
} from "lucide-react";

function ScoreRow({ label, value, weight }: { label: string; value: number; weight: number }) {
  const color = value > 60 ? "bg-bullish" : value < 40 ? "bg-bearish" : "bg-neutral-accent";
  const textColor = value > 60 ? "text-bullish" : value < 40 ? "text-bearish" : "text-neutral-accent";
  const arrow = value > 55 ? "↑" : value < 45 ? "↓" : "–";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground/50 text-[11px]">{(weight * 100).toFixed(0)}%w</span>
          <span className={cn("font-mono font-semibold", textColor)}>
            {Math.round(value)} {arrow}
          </span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${value}%`, opacity: 0.8 }}
        />
      </div>
    </div>
  );
}

export function InstrumentAnalysis() {
  useRealtimePrices();
  const [activeTab, setActiveTab] = useState<"technical" | "deep">("deep");
  const instrument = useMarketStore((s) => s.selectedInstrument);
  const batchLLMResults = useMarketStore((s) => s.batchLLMResults);
  const { biasResult } = useBiasScore();
  const { candles, indicators } = useTechnicalData();
  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;

  // LLM analysis data from batch results (populated by overview page)
  const llmResult = batchLLMResults?.[instrument.id] || null;

  // Mechanical signal engine — same brain as overview page
  const mechanicalSetup = useMemo(() => {
    if (!indicators || candles.length < 30) return null;

    const adx = indicators.adx.adx;
    const session = getSessionRelevance(instrument.id);
    const style = selectTradingStyle(adx, session.sessionScore);

    const setup = generateTradeDeskSetup(candles, indicators, instrument, 2, undefined, style);
    if (setup.conviction === "D" || setup.conviction === "C" || setup.conviction === "B") return null;
    if (setup.direction === "neutral") return null;
    if (setup.riskReward[0] < 1.5) return null;
    if (setup.direction === "bullish" && setup.impulse === "red") return null;
    if (setup.direction === "bearish" && setup.impulse === "green") return null;
    return setup;
  }, [candles, indicators, instrument]);

  useEffect(() => {
    if (biasResult && currentPrice > 0) {
      saveBiasToHistory(
        instrument.id,
        biasResult.overallBias,
        biasResult.direction,
        biasResult.fundamentalScore.total,
        biasResult.technicalScore.total,
        currentPrice
      );
    }
  }, [biasResult, instrument.id, currentPrice]);

  const bias = biasResult || {
    overallBias: 0,
    direction: "neutral" as const,
    confidence: 0,
    signalAgreement: 0,
    fundamentalScore: { total: 50, newsSentiment: 50, economicData: 50, centralBankPolicy: 50, marketSentiment: 50, intermarketCorrelation: 50 },
    technicalScore: { total: 50, trendDirection: 50, momentum: 50, volatility: 50, volumeAnalysis: 50, supportResistance: 50 },
    signals: [],
  };

  const biasAccent = bias.direction.includes("bullish") ? "bullish" : bias.direction.includes("bearish") ? "bearish" : "neutral";
  const biasColor = biasAccent === "bullish" ? "var(--bullish)" : biasAccent === "bearish" ? "var(--bearish)" : "var(--neutral-accent)";

  // Signal grouping for bull/bear case
  const bullishSignals = (bias.signals || []).filter((s) => s.signal === "bullish");
  const bearishSignals = (bias.signals || []).filter((s) => s.signal === "bearish");

  // LLM summary — prefer batch LLM, fallback to bias reasons
  const llmSummary = llmResult?.summary || null;
  const fundReason = bias.fundamentalReason || llmResult?.fundamentalReason || null;
  const techReason = bias.technicalReason || llmResult?.technicalReason || null;

  const fund = bias.fundamentalScore;
  const tech = bias.technicalScore;
  const dec = instrument.decimalPlaces;

  return (
    <div className="min-h-screen bg-background">
      <Header mode="analysis" />

      <div className="flex">
        <Watchlist />

        <main className="flex-1 min-w-0 px-3 md:px-6 py-4 space-y-6">
          <DailyBriefing />

          {/* ── Section 1: Comprehensive Analysis ── */}
          <section>
            <SectionHeader
              title="Comprehensive Analysis"
              subtitle={`Full bias breakdown, market context, and signals — ${instrument.symbol}`}
              icon={<Sparkles className="h-3.5 w-3.5" />}
              accentColor="green"
            />

            {/* Overview Banner */}
            <div className="panel rounded-lg p-4 sm:p-6 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 sm:gap-5">
                  <span className="text-3xl sm:text-5xl font-mono font-black tabular" style={{ color: biasColor }}>
                    {bias.overallBias > 0 ? "+" : ""}{Math.round(bias.overallBias)}
                  </span>
                  <div className="space-y-1.5">
                    <span className={cn(
                      "inline-block px-3 py-1 rounded-lg text-xs sm:text-sm font-bold uppercase tracking-wide",
                      biasAccent === "bullish" && "bg-bullish/15 text-bullish",
                      biasAccent === "bearish" && "bg-bearish/15 text-bearish",
                      biasAccent === "neutral" && "bg-neutral-accent/15 text-neutral-accent"
                    )}>
                      {bias.direction.replace("_", " ")}
                    </span>
                    <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
                      <span>{Math.round(bias.confidence)}% confidence</span>
                      <span className="text-border">|</span>
                      <span>{Math.round((bias.signalAgreement ?? 0) * 100)}% signal agreement</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {llmResult?.riskAssessment && (
                    <span className={cn(
                      "text-xs font-bold uppercase px-2.5 py-1 rounded",
                      llmResult.riskAssessment === "low" && "bg-bullish/15 text-bullish",
                      llmResult.riskAssessment === "medium" && "bg-amber/15 text-[var(--amber)]",
                      llmResult.riskAssessment === "high" && "bg-bearish/15 text-bearish"
                    )}>
                      {llmResult.riskAssessment} risk
                    </span>
                  )}
                  {llmResult?.outlook && (
                    <span className={cn(
                      "text-xs font-bold uppercase px-2.5 py-1 rounded",
                      llmResult.outlook === "bullish" && "bg-bullish/15 text-bullish",
                      llmResult.outlook === "bearish" && "bg-bearish/15 text-bearish",
                      llmResult.outlook === "neutral" && "bg-neutral-accent/15 text-neutral-accent",
                    )}>
                      {llmResult.outlook}
                    </span>
                  )}
                </div>
              </div>

              {/* Confidence bar */}
              <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden mb-4">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    biasAccent === "bullish" ? "bg-bullish" : biasAccent === "bearish" ? "bg-bearish" : "bg-neutral-accent"
                  )}
                  style={{ width: `${Math.round(bias.confidence)}%` }}
                />
              </div>

              {/* LLM Summary */}
              {llmSummary && (
                <div className="border-t border-border/20 pt-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="h-3.5 w-3.5 text-neutral-accent" />
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Executive Summary</span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{llmSummary}</p>
                </div>
              )}
            </div>

            {/* Fundamental & Technical Breakdown — side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Fundamental Score Card */}
              <div className="panel rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground/50" />
                    <h3 className="text-sm font-semibold text-foreground">Fundamental Score</h3>
                  </div>
                  <span className={cn(
                    "text-2xl font-mono font-bold",
                    fund.total > 50 ? "text-bullish" : fund.total < 50 ? "text-bearish" : "text-neutral-accent"
                  )}>
                    {Math.round(fund.total)}
                  </span>
                </div>

                <div className="space-y-2.5 mb-4">
                  <ScoreRow label="News Sentiment" value={fund.newsSentiment} weight={0.25} />
                  <ScoreRow label="Economic Data" value={fund.economicData} weight={0.25} />
                  <ScoreRow label="Central Bank Policy" value={fund.centralBankPolicy} weight={0.20} />
                  <ScoreRow label="Market Sentiment" value={fund.marketSentiment} weight={0.15} />
                  <ScoreRow label="Intermarket Correlation" value={fund.intermarketCorrelation} weight={0.15} />
                </div>

                {fundReason && (
                  <div className="border-t border-border/20 pt-3">
                    <p className="text-[13px] text-foreground/70 leading-relaxed">{fundReason}</p>
                  </div>
                )}
              </div>

              {/* Technical Score Card */}
              <div className="panel rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground/50" />
                    <h3 className="text-sm font-semibold text-foreground">Technical Score</h3>
                  </div>
                  <span className={cn(
                    "text-2xl font-mono font-bold",
                    tech.total > 50 ? "text-bullish" : tech.total < 50 ? "text-bearish" : "text-neutral-accent"
                  )}>
                    {Math.round(tech.total)}
                  </span>
                </div>

                <div className="space-y-2.5 mb-4">
                  <ScoreRow label="Trend Direction" value={tech.trendDirection} weight={0.30} />
                  <ScoreRow label="Momentum" value={tech.momentum} weight={0.30} />
                  <ScoreRow label="Volatility" value={tech.volatility} weight={0.15} />
                  <ScoreRow label="Volume (VWAP)" value={tech.volumeAnalysis} weight={0.10} />
                  <ScoreRow label="Support / Resistance" value={tech.supportResistance} weight={0.15} />
                </div>

                {techReason && (
                  <div className="border-t border-border/20 pt-3">
                    <p className="text-[13px] text-foreground/70 leading-relaxed">{techReason}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bull Case / Bear Case */}
            {(bullishSignals.length > 0 || bearishSignals.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="panel rounded-lg p-4 border-l-[3px] border-l-[var(--bullish)]">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4 text-bullish" />
                    <h4 className="text-xs font-bold text-bullish uppercase tracking-wider">Bull Case</h4>
                    <span className="text-[11px] text-muted-foreground/40 ml-auto">{bullishSignals.length} signals</span>
                  </div>
                  <div className="space-y-2">
                    {bullishSignals.length > 0 ? bullishSignals.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-[13px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-bullish mt-1.5 shrink-0" />
                        <div>
                          <span className="font-semibold text-foreground">{s.source}</span>
                          <span className="text-muted-foreground/70"> — {s.description}</span>
                        </div>
                      </div>
                    )) : (
                      <p className="text-xs text-muted-foreground/40">No bullish signals detected</p>
                    )}
                  </div>
                </div>

                <div className="panel rounded-lg p-4 border-l-[3px] border-l-[var(--bearish)]">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="h-4 w-4 text-bearish" />
                    <h4 className="text-xs font-bold text-bearish uppercase tracking-wider">Bear Case</h4>
                    <span className="text-[11px] text-muted-foreground/40 ml-auto">{bearishSignals.length} signals</span>
                  </div>
                  <div className="space-y-2">
                    {bearishSignals.length > 0 ? bearishSignals.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-[13px]">
                        <span className="h-1.5 w-1.5 rounded-full bg-bearish mt-1.5 shrink-0" />
                        <div>
                          <span className="font-semibold text-foreground">{s.source}</span>
                          <span className="text-muted-foreground/70"> — {s.description}</span>
                        </div>
                      </div>
                    )) : (
                      <p className="text-xs text-muted-foreground/40">No bearish signals detected</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Catalysts + Risk Assessment + Key Levels */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Catalysts */}
              {llmResult?.catalysts && llmResult.catalysts.length > 0 && (
                <div className="panel rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-[var(--amber)]" />
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Catalysts</h4>
                  </div>
                  <div className="space-y-2">
                    {llmResult.catalysts.map((c, i) => (
                      <p key={i} className="text-[13px] text-foreground/70 leading-relaxed flex items-start gap-2">
                        <span className="text-[var(--amber)] mt-0.5 shrink-0">&bull;</span>
                        {c}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Risk Assessment */}
              {llmResult?.riskAssessment && (
                <div className="panel rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground/50" />
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Risk Assessment</h4>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-sm font-bold uppercase",
                        llmResult.riskAssessment === "low" && "text-bullish",
                        llmResult.riskAssessment === "medium" && "text-[var(--amber)]",
                        llmResult.riskAssessment === "high" && "text-bearish"
                      )}>
                        {llmResult.riskAssessment} risk
                      </span>
                    </div>
                    <div className="space-y-1.5 text-[13px] text-foreground/70">
                      <p className="flex items-center gap-2">
                        <span className="text-muted-foreground/40 text-[11px] uppercase w-20 shrink-0">Agreement</span>
                        <span className="font-mono">{Math.round((bias.signalAgreement ?? 0) * 100)}%</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="text-muted-foreground/40 text-[11px] uppercase w-20 shrink-0">Confidence</span>
                        <span className="font-mono">{Math.round(bias.confidence)}%</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="text-muted-foreground/40 text-[11px] uppercase w-20 shrink-0">Volatility</span>
                        <span className="font-mono">{Math.round(tech.volatility)}/100</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <span className="text-muted-foreground/40 text-[11px] uppercase w-20 shrink-0">Alignment</span>
                        <span className={cn("font-semibold",
                          (fund.total > 55 && tech.total > 55) || (fund.total < 45 && tech.total < 45) ? "text-bullish" :
                          (fund.total > 55 && tech.total < 45) || (fund.total < 45 && tech.total > 55) ? "text-bearish" :
                          "text-muted-foreground"
                        )}>
                          {(fund.total > 55 && tech.total > 55) || (fund.total < 45 && tech.total < 45) ? "Aligned" :
                           (fund.total > 55 && tech.total < 45) || (fund.total < 45 && tech.total > 55) ? "Conflicting" :
                           "Mixed"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Key Levels */}
              {llmResult?.keyLevels && llmResult.keyLevels.support > 0 && (
                <div className="panel rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4 text-neutral-accent" />
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Key Levels</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground uppercase">Support</span>
                      <span className="text-sm font-mono font-bold text-bullish">
                        {llmResult.keyLevels.support.toFixed(dec)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground uppercase">Resistance</span>
                      <span className="text-sm font-mono font-bold text-bearish">
                        {llmResult.keyLevels.resistance.toFixed(dec)}
                      </span>
                    </div>
                    {currentPrice > 0 && (
                      <div className="border-t border-border/20 pt-2">
                        <div className="flex items-center justify-between text-[12px] text-muted-foreground/50">
                          <span>Distance to S</span>
                          <span className="font-mono">
                            {((currentPrice - llmResult.keyLevels.support) / currentPrice * 100).toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[12px] text-muted-foreground/50">
                          <span>Distance to R</span>
                          <span className="font-mono">
                            {((llmResult.keyLevels.resistance - currentPrice) / currentPrice * 100).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Full Signals List */}
            {bias.signals.length > 0 && (
              <div className="panel rounded-lg p-4 mt-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  All Signals ({bias.signals.length})
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                  {bias.signals.map((signal, i) => (
                    <div key={i} className="flex items-start gap-2 text-[13px]">
                      <span
                        className={cn(
                          "mt-1.5 h-1.5 w-1.5 rounded-full shrink-0",
                          signal.signal === "bullish" ? "bg-bullish" : signal.signal === "bearish" ? "bg-bearish" : "bg-neutral-accent"
                        )}
                      />
                      <div className="min-w-0">
                        <span className="font-semibold text-foreground">{signal.source}</span>
                        <span className="text-muted-foreground/70"> — {signal.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ── Section 2: Chart & Setup ── */}
          <section>
            <SectionHeader
              title="Chart & Setup"
              subtitle="Price action, multi-timeframe analysis, and trade setup"
              icon={<BarChart3 className="h-3.5 w-3.5" />}
              accentColor="blue"
            />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Sidebar: Session + MTF + Trade Log */}
              <div className="lg:col-span-3 space-y-4 min-h-[300px]">
                <SessionCard instrumentId={instrument.id} />
                <MTFConfluence />
                <QuickTradeLog instrumentId={instrument.id} biasResult={biasResult} currentPrice={currentPrice} />
              </div>

              {/* Chart + Deep Analysis / Technical */}
              <div className="lg:col-span-9 space-y-4">
                <div className="flex gap-1 mb-1">
                  <button
                    onClick={() => setActiveTab("deep")}
                    className={cn(
                      "px-3 py-1 rounded-lg text-[13px] font-semibold transition-colors",
                      activeTab === "deep"
                        ? "bg-neutral-accent/15 text-neutral-accent"
                        : "text-muted-foreground hover:text-foreground hover:bg-[var(--surface-2)]"
                    )}
                  >
                    Chart
                  </button>
                  <button
                    onClick={() => setActiveTab("technical")}
                    className={cn(
                      "px-3 py-1 rounded-lg text-[13px] font-semibold transition-colors",
                      activeTab === "technical"
                        ? "bg-neutral-accent/15 text-neutral-accent"
                        : "text-muted-foreground hover:text-foreground hover:bg-[var(--surface-2)]"
                    )}
                  >
                    Technical
                  </button>
                </div>

                {activeTab === "deep" ? (
                  <DeepAnalysis />
                ) : (
                  <TechnicalOverview />
                )}
              </div>
            </div>

            {/* Conviction + Trade Setup — below the chart */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
              <div className="lg:col-span-3">
                <div className="panel rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-widest text-center">
                    Conviction
                  </h3>
                  {mechanicalSetup ? (
                    <div className="flex flex-col items-center gap-3">
                      <span className={cn(
                        "inline-flex items-center justify-center h-16 min-w-[64px] px-3 rounded-lg text-2xl font-black tracking-wider",
                        mechanicalSetup.conviction === "A+" && "bg-bullish/20 text-bullish ring-1 ring-bullish/30",
                        mechanicalSetup.conviction === "A" && "bg-bullish/15 text-bullish",
                        mechanicalSetup.conviction === "B" && "bg-neutral-accent/15 text-neutral-accent",
                      )}>
                        {mechanicalSetup.conviction}
                      </span>
                      <span className="text-sm font-mono text-muted-foreground">
                        {mechanicalSetup.convictionScore.toFixed(0)}/100
                      </span>
                      <div className="flex items-center gap-2">
                        {mechanicalSetup.direction === "bullish" ? (
                          <TrendingUp className="h-5 w-5 text-bullish" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-bearish" />
                        )}
                        <span className={cn(
                          "text-sm font-bold uppercase",
                          mechanicalSetup.direction === "bullish" ? "text-bullish" : "text-bearish"
                        )}>
                          {mechanicalSetup.direction === "bullish" ? "LONG" : "SHORT"}
                        </span>
                      </div>
                      <div className="flex flex-col items-center gap-1.5 mt-1">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-bold uppercase tracking-wider",
                          mechanicalSetup.regime === "trending_up" && "bg-bullish/15 text-bullish",
                          mechanicalSetup.regime === "trending_down" && "bg-bearish/15 text-bearish",
                          mechanicalSetup.regime === "ranging" && "bg-neutral-accent/15 text-neutral-accent",
                          mechanicalSetup.regime === "volatile" && "bg-amber/15 text-[var(--amber)]",
                        )}>
                          {mechanicalSetup.regime === "trending_up" && <TrendingUp className="h-3 w-3" />}
                          {mechanicalSetup.regime === "trending_down" && <TrendingDown className="h-3 w-3" />}
                          {mechanicalSetup.regime === "ranging" && <Activity className="h-3 w-3" />}
                          {mechanicalSetup.regime === "volatile" && <AlertTriangle className="h-3 w-3" />}
                          {mechanicalSetup.regimeLabel}
                        </span>
                        <span className={cn(
                          "inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider cursor-help",
                          mechanicalSetup.impulse === "green" && "text-bullish",
                          mechanicalSetup.impulse === "red" && "text-bearish",
                          mechanicalSetup.impulse === "blue" && "text-neutral-accent",
                        )} title={
                          mechanicalSetup.impulse === "green" ? "GREEN — Buying pressure. Favorable for longs." :
                          mechanicalSetup.impulse === "red" ? "RED — Selling pressure. Favorable for shorts." :
                          "BLUE — Mixed momentum. Exercise caution."
                        }>
                          <span className={cn(
                            "h-2 w-2 rounded-full animate-pulse",
                            mechanicalSetup.impulse === "green" && "bg-bullish",
                            mechanicalSetup.impulse === "red" && "bg-bearish",
                            mechanicalSetup.impulse === "blue" && "bg-neutral-accent",
                          )} />
                          Impulse {mechanicalSetup.impulse.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-6 text-center">
                      <Minus className="h-8 w-8 text-muted-foreground/20 mb-2" />
                      <p className="text-xs text-muted-foreground/40">No qualifying setup</p>
                      <p className="text-[12px] text-muted-foreground/30 mt-1">Below B conviction</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-9">
                <div className="rounded-xl border-l-[3px]" style={{
                  borderLeftColor: mechanicalSetup
                    ? mechanicalSetup.direction === "bullish" ? "var(--bullish)" : "var(--bearish)"
                    : "var(--neutral-accent)"
                }}>
                  <TradeSetupCard setup={mechanicalSetup} decimals={instrument.decimalPlaces} />
                </div>
              </div>
            </div>
          </section>

          {/* ── Section 3: Track Record ── */}
          <section>
            <SectionHeader
              title="Track Record"
              subtitle="Currency strength, bias history, and prediction accuracy"
              icon={<History className="h-3.5 w-3.5" />}
              accentColor="blue"
            />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-6">
                <CurrencyStrength />
              </div>
              <div className="lg:col-span-6">
                <BiasHistory instrumentId={instrument.id} />
              </div>
            </div>
            <div className="mt-4">
              <BiasAccuracyCard instrumentId={instrument.id} />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
