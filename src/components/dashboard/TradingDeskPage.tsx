"use client";

import { Header } from "./Header";
import { SectionHeader } from "./SectionHeader";
import { AITradeDesk } from "./AITradeDesk";
import { TradingAdvisor } from "./TradingAdvisor";
import { MarketHoursStrip } from "@/components/common/MarketHours";
import { EtheralShadow } from "@/components/ui/etheral-shadow";
import { useAllBiasScores } from "@/lib/hooks/useAllBiasScores";
import { useRealtimePrices } from "@/lib/hooks/useRealtimePrices";
import { Brain, LayoutList } from "lucide-react";

export function TradingDeskPage() {
  useAllBiasScores();
  // Alerts now fire from AITradeDesk's mechanical signal engine (single brain)
  useRealtimePrices();

  return (
    <div className="relative min-h-screen bg-background">
      <div className="fixed inset-0 z-0 hidden dark:block">
        <EtheralShadow
          color="rgba(30, 27, 55, 1)"
          animation={{ scale: 60, speed: 40 }}
          noise={{ opacity: 0.6, scale: 1.2 }}
          sizing="fill"
        />
      </div>

      <div className="relative z-10">
        <Header mode="desk" />
        <MarketHoursStrip />

        <main className="max-w-[1600px] mx-auto px-8 py-6 space-y-8">
          <section>
            <SectionHeader
              title="Desk Manager"
              subtitle="AI-powered trading advisor interpreting mechanical signals"
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
