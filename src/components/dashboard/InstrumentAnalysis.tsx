"use client";

import { Header } from "./Header";
import { DailyBriefing } from "./DailyBriefing";
import { SectionHeader } from "./SectionHeader";
import { BiasGauge } from "@/components/bias/BiasGauge";
import { BiasBreakdown } from "@/components/bias/BiasBreakdown";
import { BiasHistory } from "@/components/bias/BiasHistory";
import { InstrumentBias } from "@/components/bias/InstrumentBias";
import { NewsFeed } from "@/components/fundamentals/NewsFeed";
import { EconomicCalendar } from "@/components/fundamentals/EconomicCalendar";
import { BondYields } from "@/components/fundamentals/BondYields";
import { CentralBankTracker } from "@/components/fundamentals/CentralBankTracker";
import { CurrencyStrength } from "@/components/fundamentals/CurrencyStrength";
import { IntermarketCorrelation } from "@/components/fundamentals/IntermarketCorrelation";
import { TechnicalOverview } from "@/components/technicals/TechnicalOverview";
import { DeepAnalysis } from "@/components/technicals/DeepAnalysis";
import { TradeSetupCard } from "./TradeSetupCard";
import { GlassCard } from "@/components/common/GlassCard";
import { useMarketStore } from "@/lib/store/market-store";
import { useBiasScore } from "@/lib/hooks/useBiasScore";
import { useTechnicalData } from "@/lib/hooks/useTechnicalData";
import { saveBiasToHistory } from "@/components/bias/BiasHistory";
import { BiasAccuracyCard } from "@/components/bias/BiasAccuracy";
import { SessionCard } from "@/components/common/SessionIndicator";
import { QuickTradeLog } from "@/components/journal/QuickTradeLog";
import { MTFConfluence } from "@/components/technicals/MTFConfluence";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Target, BarChart3, AlertTriangle, Globe, History } from "lucide-react";

export function InstrumentAnalysis() {
  const [activeTab, setActiveTab] = useState<"technical" | "deep">("deep");
  const instrument = useMarketStore((s) => s.selectedInstrument);
  const { biasResult } = useBiasScore();
  const { candles } = useTechnicalData();
  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;

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

      <main className="max-w-[1800px] mx-auto px-3 py-4 space-y-6">
        <DailyBriefing />

        {/* ── Section 1: Bias & Setup ── */}
        <section>
          <SectionHeader
            step={1}
            title="Bias & Setup"
            subtitle={`Direction, confidence, and trade levels — ${instrument.symbol}`}
            icon={<Target className="h-3.5 w-3.5" />}
            accentColor="green"
          />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Bias Gauge */}
            <div className="lg:col-span-3">
              <GlassCard accent={biasAccent} delay={0}>
                <div className="flex flex-col items-center py-4">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-widest">
                    Overall Bias
                  </h3>
                  <BiasGauge
                    bias={bias.overallBias}
                    confidence={bias.confidence}
                    direction={bias.direction}
                    size="lg"
                  />
                </div>
              </GlassCard>
            </div>

            {/* Trade Setup */}
            <div className="lg:col-span-5">
              <div className="rounded-xl border-l-[3px]" style={{ borderLeftColor: biasColor }}>
                <TradeSetupCard />
              </div>
            </div>

            {/* Bias Breakdown + Key Signals — MOVED UP from Row 3 */}
            <div className="lg:col-span-4">
              <BiasBreakdown
                fundamentalScore={bias.fundamentalScore}
                technicalScore={bias.technicalScore}
                signals={bias.signals}
              />
            </div>
          </div>
        </section>

        {/* ── Section 2: Analysis & Chart ── */}
        <section>
          <SectionHeader
            step={2}
            title="Analysis & Chart"
            subtitle="Price action, zones, and AI trade ideas"
            icon={<BarChart3 className="h-3.5 w-3.5" />}
            accentColor="blue"
          />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Sidebar: Session + MTF + Trade Log */}
            <div className="lg:col-span-3 space-y-4">
              <SessionCard instrumentId={instrument.id} />
              <MTFConfluence />
              <QuickTradeLog instrumentId={instrument.id} biasResult={biasResult} currentPrice={currentPrice} />
            </div>

            {/* Chart + Deep Analysis / Technical (wider!) */}
            <div className="lg:col-span-9 space-y-4">
              <div className="flex gap-1 mb-1">
                <button
                  onClick={() => setActiveTab("deep")}
                  className={cn(
                    "px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors",
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
                    "px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors",
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
                <>
                  <TechnicalOverview />
                  <IntermarketCorrelation />
                </>
              )}
            </div>
          </div>
        </section>

        {/* ── Section 3: News & Context ── */}
        <section>
          <SectionHeader
            step={3}
            title="News & Context"
            subtitle="Market news and instrument comparison"
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            accentColor="red"
          />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8">
              <NewsFeed />
            </div>
            <div className="lg:col-span-4">
              <InstrumentBias />
            </div>
          </div>
        </section>

        {/* ── Section 4: Macro Data ── */}
        <section>
          <SectionHeader
            step={4}
            title="Macro Data"
            subtitle="Yields, calendar, and cross-market data"
            icon={<Globe className="h-3.5 w-3.5" />}
            accentColor="amber"
          />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4">
              <EconomicCalendar />
            </div>
            <div className="lg:col-span-4">
              <BondYields />
            </div>
            <div className="lg:col-span-4">
              <CentralBankTracker />
            </div>
          </div>
        </section>

        {/* ── Section 5: Track Record ── */}
        <section>
          <SectionHeader
            step={5}
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
  );
}
