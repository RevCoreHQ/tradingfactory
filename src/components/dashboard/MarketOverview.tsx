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
import { useRealtimePrices } from "@/lib/hooks/useRealtimePrices";
import { InstrumentBriefings } from "./InstrumentBriefings";
import { Activity, Sparkles, AlertTriangle, BarChart3, Shield, LayoutGrid } from "lucide-react";
import { motion } from "framer-motion";

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  }),
};

export function MarketOverview() {
  useAllBiasScores();
  // Alerts now fire from AITradeDesk's mechanical signal engine (single brain)
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

        <main className="max-w-[1400px] mx-auto px-3 md:px-8 py-4 md:py-6 space-y-6 md:space-y-8">
          {/* Section 1: Market Pulse */}
          <motion.section custom={0} initial="hidden" animate="visible" variants={sectionVariants}>
            <SectionHeader
              title="Market Pulse"
              subtitle="Current market conditions at a glance"
              icon={<Activity className="h-3.5 w-3.5" />}
              accentColor="blue"
            />
            <MarketPulse />
            <BiasAccuracySummary />
          </motion.section>

          {/* Section 2: Market Intelligence */}
          <motion.section custom={1} initial="hidden" animate="visible" variants={sectionVariants}>
            <SectionHeader
              title="Market Intelligence"
              subtitle="Macro analysis and sector breakdown"
              icon={<Sparkles className="h-3.5 w-3.5" />}
              accentColor="blue"
            />
            <AIMarketSummary />
          </motion.section>

          {/* Section 2.5: Instrument Briefings */}
          <motion.section custom={2} initial="hidden" animate="visible" variants={sectionVariants}>
            <SectionHeader
              title="Instrument Briefings"
              subtitle="Analysis cards for each tracked instrument"
              icon={<LayoutGrid className="h-3.5 w-3.5" />}
              accentColor="green"
            />
            <InstrumentBriefings />
          </motion.section>

          {/* Section 3: Risk Calendar */}
          <motion.section custom={3} initial="hidden" animate="visible" variants={sectionVariants}>
            <SectionHeader
              title="Risk Calendar"
              subtitle="High-impact economic events and news risk"
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              accentColor="red"
            />
            <RedNewsWeek />
          </motion.section>

          {/* Section 4: Deep Dive */}
          <motion.section custom={4} initial="hidden" animate="visible" variants={sectionVariants}>
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
          </motion.section>

          {/* Section 5: Portfolio Risk */}
          <motion.section custom={5} initial="hidden" animate="visible" variants={sectionVariants}>
            <SectionHeader
              title="Portfolio Risk"
              subtitle="Currency exposure and correlation warnings"
              icon={<Shield className="h-3.5 w-3.5" />}
              accentColor="red"
            />
            <RiskCorrelation />
          </motion.section>
        </main>
      </div>

    </div>
  );
}
