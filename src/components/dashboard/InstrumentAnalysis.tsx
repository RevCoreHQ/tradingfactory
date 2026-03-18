"use client";

import { Header } from "./Header";
import { DailyBriefing } from "./DailyBriefing";
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

  return (
    <div className="min-h-screen bg-background">
      <Header mode="analysis" />

      <main className="max-w-[1800px] mx-auto px-3 py-4 space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Instrument Analysis — {instrument.symbol}
        </h2>

        <DailyBriefing />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column - Bias */}
          <div className="lg:col-span-3 space-y-4">
            <GlassCard
              accent={bias.direction.includes("bullish") ? "bullish" : bias.direction.includes("bearish") ? "bearish" : "neutral"}
              delay={0}
            >
              <div className="flex flex-col items-center py-4">
                <h3 className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-widest">
                  Overall Bias — {instrument.symbol}
                </h3>
                <BiasGauge
                  bias={bias.overallBias}
                  confidence={bias.confidence}
                  direction={bias.direction}
                  size="lg"
                />
              </div>
            </GlassCard>

            <TradeSetupCard />
            <div className="flex items-center gap-2">
              <QuickTradeLog instrumentId={instrument.id} biasResult={biasResult} currentPrice={currentPrice} />
            </div>
            <SessionCard instrumentId={instrument.id} />
            <MTFConfluence />
            <InstrumentBias />
          </div>

          {/* Center Column - Technicals / Deep Analysis */}
          <div className="lg:col-span-5 space-y-4">
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

          {/* Right Column - News */}
          <div className="lg:col-span-4 space-y-4">
            <NewsFeed />
          </div>
        </div>

        {/* Second Row */}
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

        {/* Third Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-6">
            <CurrencyStrength />
          </div>
          <div className="lg:col-span-6">
            <BiasBreakdown
              fundamentalScore={bias.fundamentalScore}
              technicalScore={bias.technicalScore}
              signals={bias.signals}
            />
          </div>
        </div>

        <BiasHistory instrumentId={instrument.id} />
        <BiasAccuracyCard instrumentId={instrument.id} />
      </main>
    </div>
  );
}
