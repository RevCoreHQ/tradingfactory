"use client";

import { useState, useEffect, useMemo } from "react";
import { Header } from "./Header";
import { SectionHeader } from "./SectionHeader";
import { AccountStatusBar } from "./AccountStatusBar";
import { AITradeDesk } from "./AITradeDesk";
import { TradingAdvisor } from "./TradingAdvisor";
import { MarketHoursStrip } from "@/components/common/MarketHours";
import { EtheralShadow } from "@/components/ui/etheral-shadow";
import { useAllBiasScores } from "@/lib/hooks/useAllBiasScores";
import { useSmartAlerts } from "@/lib/hooks/useSmartAlerts";
import { useRealtimePrices } from "@/lib/hooks/useRealtimePrices";
import { useTradeDeskData } from "@/lib/hooks/useTradeDeskData";
import { isSetupActive } from "@/lib/calculations/setup-tracker";
import { computePortfolioRisk } from "@/lib/calculations/risk-engine";
import { DEFAULT_RISK_CONFIG } from "@/lib/types/signals";
import { loadTrackedSetups } from "@/lib/storage/setup-storage";
import type { TrackedSetup } from "@/lib/types/signals";
import { Brain } from "lucide-react";

export function TradingDeskPage() {
  useAllBiasScores();
  useSmartAlerts();
  useRealtimePrices();

  const { portfolioRisk: baseRisk } = useTradeDeskData();
  const [trackedSetups, setTrackedSetups] = useState<TrackedSetup[]>([]);

  useEffect(() => {
    setTrackedSetups(loadTrackedSetups());
    const interval = setInterval(() => setTrackedSetups(loadTrackedSetups()), 10_000);
    return () => clearInterval(interval);
  }, []);

  const { activeSetups, historySetups } = useMemo(() => {
    return {
      activeSetups: trackedSetups.filter((t) => isSetupActive(t.status)),
      historySetups: trackedSetups.filter((t) => !isSetupActive(t.status)),
    };
  }, [trackedSetups]);

  const portfolioRisk = useMemo(
    () =>
      computePortfolioRisk(
        baseRisk.accountEquity,
        baseRisk.riskPercent,
        activeSetups,
        historySetups
      ),
    [baseRisk.accountEquity, baseRisk.riskPercent, activeSetups, historySetups]
  );

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
        <AccountStatusBar
          portfolioRisk={portfolioRisk}
          openPositions={activeSetups.length}
          maxPositions={DEFAULT_RISK_CONFIG.maxOpenPositions}
        />

        <main className="max-w-[1600px] mx-auto px-8 py-6 space-y-6">
          <section>
            <SectionHeader
              title="AI Trade Desk"
              subtitle="Book-sourced mechanical systems, conviction tiers, and risk management"
              icon={<Brain className="h-3.5 w-3.5" />}
              accentColor="green"
            />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-4">
                <TradingAdvisor />
              </div>
              <div className="lg:col-span-8">
                <AITradeDesk />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
