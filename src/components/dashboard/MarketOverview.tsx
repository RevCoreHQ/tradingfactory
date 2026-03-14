"use client";

import { Header } from "./Header";
import { TopPairs } from "@/components/bias/TopPairs";
import { RedNewsWeek } from "@/components/fundamentals/RedNewsWeek";
import { FearGreedGauge } from "@/components/fundamentals/FearGreedGauge";
import { MarketHours } from "@/components/common/MarketHours";
import { useAllBiasScores } from "@/lib/hooks/useAllBiasScores";

export function MarketOverview() {
  useAllBiasScores();

  return (
    <div className="min-h-screen bg-background">
      <Header mode="overview" />

      <main className="max-w-[1800px] mx-auto px-3 py-4 space-y-6">
        <section className="space-y-4">
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            Market Overview
          </h2>

          {/* Market Hours + Fear & Greed */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8">
              <MarketHours />
            </div>
            <div className="lg:col-span-4">
              <FearGreedGauge />
            </div>
          </div>

          {/* Top Pairs + Red News */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5">
              <TopPairs />
            </div>
            <div className="lg:col-span-7">
              <RedNewsWeek />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
