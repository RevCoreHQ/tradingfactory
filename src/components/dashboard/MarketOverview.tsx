"use client";

import { Header } from "./Header";
import { TopPairs } from "@/components/bias/TopPairs";
import { RedNewsWeek } from "@/components/fundamentals/RedNewsWeek";
import { FearGreedGauge } from "@/components/fundamentals/FearGreedGauge";
import { MarketHoursStrip } from "@/components/common/MarketHours";
import { MarketContext } from "./MarketContext";
import { useAllBiasScores } from "@/lib/hooks/useAllBiasScores";

export function MarketOverview() {
  useAllBiasScores();

  return (
    <div className="min-h-screen bg-background">
      <Header mode="overview" />
      <MarketHoursStrip />

      <main className="max-w-[1800px] mx-auto px-4 py-4 space-y-4">
        {/* Hero: Conviction Board */}
        <TopPairs />

        {/* Supporting Context */}
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
      </main>
    </div>
  );
}
