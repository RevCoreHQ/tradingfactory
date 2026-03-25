"use client";

import { Header } from "./Header";
import { SectionHeader } from "./SectionHeader";
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
    <div className="min-h-screen bg-background">
      <div>
        <Header mode="desk" />
        <MarketHoursStrip />

        <main className="max-w-[1600px] mx-auto px-3 md:px-8 py-4 md:py-6 space-y-6 md:space-y-8">
          <section>
            <SectionHeader
              title="Desk Manager"
              subtitle="Trading advisor interpreting mechanical signals"
              icon={<Brain className="h-3.5 w-3.5" />}
              accentColor="green"
            />
            <TradingAdvisor />
          </section>

          <section>
            <SectionHeader
              title="Trade Setups"
              subtitle="Book-sourced mechanical systems, conviction tiers, and risk management"
              icon={<LayoutList className="h-3.5 w-3.5" />}
              accentColor="blue"
            />
            <AITradeDesk />
          </section>
        </main>
      </div>
    </div>
  );
}
