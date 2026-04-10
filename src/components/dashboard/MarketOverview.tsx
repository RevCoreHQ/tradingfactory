"use client";

import { Header } from "./Header";
import { MarketPulse } from "./MarketPulse";
import { ForexMovers } from "./ForexMovers";
import { SectionHeader } from "./SectionHeader";
import { AIMarketSummary } from "./AIMarketSummary";
import { RedNewsWeek } from "@/components/fundamentals/RedNewsWeek";
import { BondYields } from "@/components/fundamentals/BondYields";
import { CurrencyBias } from "@/components/fundamentals/CurrencyBias";
import { MarketHoursStrip } from "@/components/common/MarketHours";

import { useAllBiasScores } from "@/lib/hooks/useAllBiasScores";
import { BiasAccuracySummary } from "@/components/bias/BiasAccuracy";
import { RiskCorrelation } from "@/components/bias/RiskCorrelation";
import { COTPositioning } from "@/components/fundamentals/COTPositioning";
import { useRealtimePrices } from "@/lib/hooks/useRealtimePrices";
import { InstrumentBriefings } from "./InstrumentBriefings";
import { ScanSearch, Sparkles, AlertTriangle, BarChart3, Shield, LayoutGrid } from "lucide-react";
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
    <div className="min-h-screen bg-transparent">
      <div>
        <Header mode="overview" />
        <MarketHoursStrip />

        <main className="max-w-[1400px] mx-auto space-y-6 py-4 pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] md:space-y-8 md:px-8 md:py-6 md:pb-6">
          {/* Section 1: Snapshot — mechanical tape + movers + accuracy */}
          <motion.section custom={0} initial="hidden" animate="visible" variants={sectionVariants}>
            <SectionHeader
              title="Snapshot"
              subtitle="Fear & greed, USD, breadth, key quotes — forex movers and bias hit rate"
              icon={<ScanSearch className="h-3.5 w-3.5" />}
              accentColor="amber"
              subtitleOnMobile
            />
            <div className="overflow-hidden rounded-xl border border-border/50 bg-gradient-to-b from-[var(--surface-1)]/95 to-[var(--surface-1)]/55 shadow-sm sm:rounded-2xl dark:from-white/[0.06] dark:to-transparent dark:shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]">
              <div className="p-2.5 sm:p-4 md:p-5">
                <MarketPulse />
              </div>
              <div className="border-t border-border/40 bg-[var(--surface-2)]/30 px-2.5 py-2 sm:px-4 dark:bg-white/[0.02]">
                <ForexMovers />
              </div>
              <BiasAccuracySummary variant="footer" />
            </div>
          </motion.section>

          {/* Section 2: Market Intelligence */}
          <motion.section custom={1} initial="hidden" animate="visible" variants={sectionVariants}>
            <SectionHeader
              title="Market Intelligence"
              subtitle="Desk narrative — focus lists and sectors expand on demand"
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
