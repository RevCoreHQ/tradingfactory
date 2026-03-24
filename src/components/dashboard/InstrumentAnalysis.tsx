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
import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { BarChart3, History, TrendingUp, TrendingDown, Activity, AlertTriangle, Minus } from "lucide-react";

export function InstrumentAnalysis() {
  useRealtimePrices();
  const [activeTab, setActiveTab] = useState<"technical" | "deep">("deep");
  const instrument = useMarketStore((s) => s.selectedInstrument);
  const { biasResult } = useBiasScore();
  const { candles, indicators } = useTechnicalData();
  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;

  // Mechanical signal engine — same brain as overview page
  const mechanicalSetup = useMemo(() => {
    if (!indicators || candles.length < 30) return null;

    // Select trading style based on ADX regime + session
    const adx = indicators.adx.adx;
    const session = getSessionRelevance(instrument.id);
    const style = selectTradingStyle(adx, session.sessionScore);

    const setup = generateTradeDeskSetup(candles, indicators, instrument, 2, undefined, style);
    // Filter same as overview: only A+/A conviction, non-neutral, R:R >= 1.5, impulse aligned
    if (setup.conviction === "D" || setup.conviction === "C" || setup.conviction === "B") return null;
    if (setup.direction === "neutral") return null;
    if (setup.riskReward[0] < 1.5) return null;
    // Elder hard gate: never trade against impulse
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
    fundamentalScore: { total: 50, newsSentiment: 50, economicData: 50, centralBankPolicy: 50, marketSentiment: 50, intermarketCorrelation: 50 },
    technicalScore: { total: 50, trendDirection: 50, momentum: 50, volatility: 50, volumeAnalysis: 50, supportResistance: 50 },
    signals: [],
  };

  const biasAccent = bias.direction.includes("bullish") ? "bullish" : bias.direction.includes("bearish") ? "bearish" : "neutral";
  const biasColor = biasAccent === "bullish" ? "var(--bullish)" : biasAccent === "bearish" ? "var(--bearish)" : "var(--neutral-accent)";

  return (
    <div className="min-h-screen bg-background">
      <Header mode="analysis" />

      <div className="flex">
        {/* Left: Watchlist sidebar */}
        <Watchlist />

        {/* Right: Main content */}
        <main className="flex-1 min-w-0 px-3 md:px-6 py-4 space-y-6">
          <DailyBriefing />

          {/* ── Section 1: Fundamental Context ── */}
          <section>
            <SectionHeader
              title="Fundamental Context"
              subtitle={`Bias breakdown and key signals — ${instrument.symbol}`}
              icon={<BarChart3 className="h-3.5 w-3.5" />}
              accentColor="green"
            />
            <BiasBreakdown
              fundamentalScore={bias.fundamentalScore}
              technicalScore={bias.technicalScore}
              signals={bias.signals}
              fundamentalReason={bias.fundamentalReason}
              technicalReason={bias.technicalReason}
              compact
            />
          </section>

          {/* ── Section 2: Analysis & Chart ── */}
          <section>
            <SectionHeader
              title="Analysis & Chart"
              subtitle="Price action and deep analysis"
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
                    Deep Analysis
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
