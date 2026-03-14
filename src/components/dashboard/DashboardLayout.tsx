"use client";

import { Header } from "./Header";
import { DailyBriefing } from "./DailyBriefing";
import { BiasGauge } from "@/components/bias/BiasGauge";
import { BiasBreakdown } from "@/components/bias/BiasBreakdown";
import { BiasHistory } from "@/components/bias/BiasHistory";
import { InstrumentBias } from "@/components/bias/InstrumentBias";
import { TopPairs } from "@/components/bias/TopPairs";
import { NewsFeed } from "@/components/fundamentals/NewsFeed";
import { EconomicCalendar } from "@/components/fundamentals/EconomicCalendar";
import { FearGreedGauge } from "@/components/fundamentals/FearGreedGauge";
import { BondYields } from "@/components/fundamentals/BondYields";
import { CentralBankTracker } from "@/components/fundamentals/CentralBankTracker";
import { CurrencyStrength } from "@/components/fundamentals/CurrencyStrength";
import { IntermarketCorrelation } from "@/components/fundamentals/IntermarketCorrelation";
import { RedNewsWeek } from "@/components/fundamentals/RedNewsWeek";
import { TechnicalOverview } from "@/components/technicals/TechnicalOverview";
import { PriceChart } from "@/components/technicals/PriceChart";
import { MarketHours } from "@/components/common/MarketHours";
import { GlassCard } from "@/components/common/GlassCard";
import { useMarketStore } from "@/lib/store/market-store";
import { useBiasScore } from "@/lib/hooks/useBiasScore";
import { useAllBiasScores } from "@/lib/hooks/useAllBiasScores";
import { saveBiasToHistory } from "@/components/bias/BiasHistory";
import { useEffect } from "react";

export function DashboardLayout() {
  const instrument = useMarketStore((s) => s.selectedInstrument);
  const { biasResult } = useBiasScore();

  // Compute bias for all instruments
  useAllBiasScores();

  // Save bias to history once per day
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
      <Header />

      <main className="max-w-[1800px] mx-auto px-3 py-4 space-y-4">
        {/* Daily Briefing */}
        <DailyBriefing />

        {/* Red News for the Week */}
        <RedNewsWeek />

        {/* Market Hours */}
        <MarketHours />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column - Bias */}
          <div className="lg:col-span-3 space-y-4">
            {/* Hero Bias Gauge */}
            <GlassCard
              glow={bias.direction.includes("bullish") ? "bullish" : bias.direction.includes("bearish") ? "bearish" : "neutral"}
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

            {/* Instrument Grid */}
            <InstrumentBias />

            {/* Top Pairs by Conviction */}
            <TopPairs />
          </div>

          {/* Center Column - Charts & Technicals */}
          <div className="lg:col-span-5 space-y-4">
            <PriceChart />
            <TechnicalOverview />
          </div>

          {/* Right Column - News */}
          <div className="lg:col-span-4 space-y-4">
            <NewsFeed />
          </div>
        </div>

        {/* Second Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-3">
            <FearGreedGauge />
          </div>
          <div className="lg:col-span-5">
            <EconomicCalendar />
          </div>
          <div className="lg:col-span-4">
            <BondYields />
          </div>
        </div>

        {/* Third Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-3">
            <CurrencyStrength />
          </div>
          <div className="lg:col-span-5">
            <IntermarketCorrelation />
          </div>
          <div className="lg:col-span-4">
            <CentralBankTracker />
          </div>
        </div>

        {/* Bias Breakdown */}
        <BiasBreakdown
          fundamentalScore={bias.fundamentalScore}
          technicalScore={bias.technicalScore}
          signals={bias.signals}
        />

        {/* Bias History */}
        <BiasHistory instrumentId={instrument.id} />
      </main>
    </div>
  );
}
