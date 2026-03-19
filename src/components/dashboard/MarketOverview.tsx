"use client";

import { Header } from "./Header";
import { MarketPulse } from "./MarketPulse";
import { SectionHeader } from "./SectionHeader";
import { AIMarketSummary } from "./AIMarketSummary";
import { RedNewsWeek } from "@/components/fundamentals/RedNewsWeek";
import { BondYields } from "@/components/fundamentals/BondYields";
import { CurrencyBias } from "@/components/fundamentals/CurrencyBias";
import { MarketHoursStrip } from "@/components/common/MarketHours";
import { EtheralShadow } from "@/components/ui/etheral-shadow";
import { useAllBiasScores } from "@/lib/hooks/useAllBiasScores";
import { BiasAccuracySummary } from "@/components/bias/BiasAccuracy";
import { RiskCorrelation } from "@/components/bias/RiskCorrelation";
import { COTPositioning } from "@/components/fundamentals/COTPositioning";
import { useSmartAlerts } from "@/lib/hooks/useSmartAlerts";
import { useRealtimePrices } from "@/lib/hooks/useRealtimePrices";
import { Activity, Sparkles, AlertTriangle, BarChart3, Shield } from "lucide-react";

export function MarketOverview() {
  useAllBiasScores();
  useSmartAlerts();
  useRealtimePrices();

  return (
    <div className="relative min-h-screen bg-background">
      {/* Ethereal shadow background — dark mode only */}
      <div className="fixed inset-0 z-0 hidden dark:block">
        <EtheralShadow
          color="rgba(30, 27, 55, 1)"
          animation={{ scale: 60, speed: 40 }}
          noise={{ opacity: 0.6, scale: 1.2 }}
          sizing="fill"
        />
      </div>

      <div className="relative z-10">
        <Header mode="overview" />
        <MarketHoursStrip />

        <main className="max-w-[1400px] mx-auto px-8 py-6 space-y-8">
          {/* Section 1: Market Pulse */}
          <section>
            <SectionHeader
              title="Market Pulse"
              subtitle="Current market conditions at a glance"
              icon={<Activity className="h-3.5 w-3.5" />}
              accentColor="blue"
            />
            <MarketPulse />
            <BiasAccuracySummary />
          </section>

          {/* Section 2: AI Intelligence */}
          <section>
            <SectionHeader
              title="AI Intelligence"
              subtitle="AI-generated macro analysis and sector breakdown"
              icon={<Sparkles className="h-3.5 w-3.5" />}
              accentColor="blue"
            />
            <AIMarketSummary />
          </section>

          {/* Section 3: Risk Calendar */}
          <section>
            <SectionHeader
              title="Risk Calendar"
              subtitle="High-impact economic events and news risk"
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              accentColor="red"
            />
            <RedNewsWeek />
          </section>

          {/* Section 4: Deep Dive */}
          <section>
            <SectionHeader
              title="Deep Dive"
              subtitle="Institutional positioning, bond yields, and currency strength"
              icon={<BarChart3 className="h-3.5 w-3.5" />}
              accentColor="amber"
            />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-4">
                <COTPositioning />
              </div>
              <div className="lg:col-span-4">
                <BondYields />
              </div>
              <div className="lg:col-span-4">
                <CurrencyBias />
              </div>
            </div>
          </section>

          {/* Section 5: Portfolio Risk */}
          <section>
            <SectionHeader
              title="Portfolio Risk"
              subtitle="Currency exposure and correlation warnings"
              icon={<Shield className="h-3.5 w-3.5" />}
              accentColor="red"
            />
            <RiskCorrelation />
          </section>
        </main>
      </div>

    </div>
  );
}
