"use client";

import { Header } from "./Header";
import { TopPairs } from "@/components/bias/TopPairs";
import { AIMarketSummary } from "./AIMarketSummary";
import { AITradeSignals } from "./AITradeSignals";
import { RedNewsWeek } from "@/components/fundamentals/RedNewsWeek";
import { FearGreedGauge } from "@/components/fundamentals/FearGreedGauge";
import { BondYields } from "@/components/fundamentals/BondYields";
import { CurrencyBias } from "@/components/fundamentals/CurrencyBias";
import { MarketHoursStrip } from "@/components/common/MarketHours";
import { MarketContext } from "./MarketContext";
import { FallingPattern } from "@/components/ui/falling-pattern";
import { useAllBiasScores } from "@/lib/hooks/useAllBiasScores";

export function MarketOverview() {
  useAllBiasScores();

  return (
    <div className="relative min-h-screen bg-background">
      {/* Animated falling pattern background */}
      <div className="fixed inset-0 z-0">
        <FallingPattern
          className="h-full [mask-image:radial-gradient(ellipse_at_center,transparent,var(--background))]"
          color="oklch(0.6 0.15 260)"
          duration={150}
        />
      </div>

      <div className="relative z-10">
      <Header mode="overview" />
      <MarketHoursStrip />

      <main className="max-w-[1800px] mx-auto px-4 py-4 space-y-4">
        {/* Row 1: Conviction Board */}
        <TopPairs />

        {/* Row 2: AI Market Summary */}
        <AIMarketSummary />

        {/* Row 3: Supporting Context */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-3">
            <FearGreedGauge />
          </div>
          <div className="lg:col-span-5">
            <RedNewsWeek />
          </div>
          <div className="lg:col-span-4">
            <MarketContext />
          </div>
        </div>

        {/* Row 4: AI Trade Signals + Bond Yields */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8">
            <AITradeSignals />
          </div>
          <div className="lg:col-span-4">
            <BondYields />
          </div>
        </div>

        {/* Row 5: Currency Bias Index */}
        <CurrencyBias />
      </main>
      </div>
    </div>
  );
}
