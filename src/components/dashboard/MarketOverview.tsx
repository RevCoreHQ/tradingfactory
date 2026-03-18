"use client";

import { Header } from "./Header";
import { MarketPulse } from "./MarketPulse";
import { SectionHeader } from "./SectionHeader";
import { TopPairs } from "@/components/bias/TopPairs";
import { AIMarketSummary } from "./AIMarketSummary";
import { AITradeSignals } from "./AITradeSignals";
import { RedNewsWeek } from "@/components/fundamentals/RedNewsWeek";
import { BondYields } from "@/components/fundamentals/BondYields";
import { CurrencyBias } from "@/components/fundamentals/CurrencyBias";
import { MarketHoursStrip } from "@/components/common/MarketHours";
import { FallingPattern } from "@/components/ui/falling-pattern";
import { useAllBiasScores } from "@/lib/hooks/useAllBiasScores";
import { Activity, Sparkles, Target, AlertTriangle, BarChart3 } from "lucide-react";

export function MarketOverview() {
  useAllBiasScores();

  return (
    <div className="relative min-h-screen bg-background">
      {/* Animated falling pattern background */}
      <div className="fixed inset-0 z-0">
        <FallingPattern
          className="h-full [mask-image:radial-gradient(ellipse_at_center,transparent,var(--background))]"
          color="oklch(0.5 0.12 255)"
          duration={150}
        />
      </div>

      <div className="relative z-10">
        <Header mode="overview" />
        <MarketHoursStrip />

        <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-8">
          {/* Section 1: Market Pulse */}
          <section>
            <SectionHeader
              step={1}
              title="Market Pulse"
              subtitle="Current market conditions at a glance"
              icon={<Activity className="h-3.5 w-3.5" />}
              accentColor="blue"
            />
            <MarketPulse />
          </section>

          {/* Section 2: AI Intelligence */}
          <section>
            <SectionHeader
              step={2}
              title="AI Intelligence"
              subtitle="AI-generated macro analysis and sector breakdown"
              icon={<Sparkles className="h-3.5 w-3.5" />}
              accentColor="blue"
            />
            <AIMarketSummary />
          </section>

          {/* Section 3: Top Opportunities */}
          <section>
            <SectionHeader
              step={3}
              title="Top Opportunities"
              subtitle="Ranked by ADR-weighted conviction score"
              icon={<Target className="h-3.5 w-3.5" />}
              accentColor="green"
            />
            <TopPairs />
          </section>

          {/* Section 4: Risk Calendar + AI Signals */}
          <section>
            <SectionHeader
              step={4}
              title="Risk Calendar"
              subtitle="High-impact events and AI trade signals"
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              accentColor="red"
            />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-7">
                <RedNewsWeek />
              </div>
              <div className="lg:col-span-5">
                <AITradeSignals />
              </div>
            </div>
          </section>

          {/* Section 5: Deep Dive */}
          <section>
            <SectionHeader
              step={5}
              title="Deep Dive"
              subtitle="Bond yields, currency strength, and macro data"
              icon={<BarChart3 className="h-3.5 w-3.5" />}
              accentColor="amber"
            />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-5">
                <BondYields />
              </div>
              <div className="lg:col-span-7">
                <CurrencyBias />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
