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
import { GlassCard } from "@/components/common/GlassCard";
import { useMarketStore } from "@/lib/store/market-store";
import { useBiasScore } from "@/lib/hooks/useBiasScore";
import { useAllBiasScores } from "@/lib/hooks/useAllBiasScores";
import { saveBiasToHistory } from "@/components/bias/BiasHistory";
import { useEffect } from "react";

export function InstrumentAnalysis() {
  const instrument = useMarketStore((s) => s.selectedInstrument);
  const { biasResult } = useBiasScore();

  useAllBiasScores();

  useEffect(() => {
    if (biasResult) {
      saveBiasToHistory(
        instrument.id,
        biasResult.overallBias,
        biasResult.direction,
        biasResult.fundamentalScore.total,
        biasResult.technicalScore.total
      );
    }
  }, [biasResult, instrument.id]);

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

            <InstrumentBias />
          </div>

          {/* Center Column - Technicals */}
          <div className="lg:col-span-5 space-y-4">
            <TechnicalOverview />
            <IntermarketCorrelation />
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
      </main>
    </div>
  );
}
