"use client";

import { Header } from "./Header";
import { SectionHeader } from "./SectionHeader";
import { TradingDeskIntro } from "./TradingDeskIntro";
import { AITradeDesk } from "./AITradeDesk";
import { TradingAdvisor } from "./TradingAdvisor";
import { MarketHoursStrip } from "@/components/common/MarketHours";

import { useAllBiasScores } from "@/lib/hooks/useAllBiasScores";
import { useRealtimePrices } from "@/lib/hooks/useRealtimePrices";
import { Brain, LayoutList } from "lucide-react";

export function TradingDeskPage() {
  useAllBiasScores();
  // Alerts now fire from AITradeDesk's mechanical signal engine (single brain)
  useRealtimePrices();

  return (
    <div className="min-h-screen bg-transparent">
      <div>
        <Header mode="desk" />
        <MarketHoursStrip />

        <main className="max-w-[1600px] mx-auto px-3 md:px-8 py-4 md:py-6 space-y-6 md:space-y-8">
          <TradingDeskIntro />

          <section className="space-y-1">
            <SectionHeader
              title="Desk Manager"
              subtitle="Risk auditor on top of mechanical signals — not entry picks"
              icon={<Brain className="h-3.5 w-3.5" />}
              accentColor="green"
              subtitleOnMobile
              learnMore="The Risk Auditor reads your setups, portfolio, COT, carry, and the calendar. It does not rank or choose entries — that stays with the mechanical engine. Focus vs Watch uses the same trade filter as instrument cards: consider/lean in primary focus; wait or no-trade in Watch until conditions improve."
            />
            <TradingAdvisor />
          </section>

          <section className="space-y-1">
            <SectionHeader
              title="Trade Setups"
              subtitle="Bias engine, tiers, and trade filter — track runs for portfolio context"
              icon={<LayoutList className="h-3.5 w-3.5" />}
              accentColor="blue"
              subtitleOnMobile
              learnMore="Each card reflects the unified bias pipeline: MTF alignment, structure, ICT context, and conviction tiers (A/B/C). The trade filter strip is the desk’s go / wait / no-trade lens. When you track a setup, status and exposure feed back into the Risk Auditor above."
            />
            <AITradeDesk />
          </section>
        </main>
      </div>
    </div>
  );
}
