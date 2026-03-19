"use client";

import { Header } from "./Header";
import { MarketPulse } from "./MarketPulse";
import { SectionHeader } from "./SectionHeader";
import { AIMarketSummary } from "./AIMarketSummary";
import { AITradeSignals } from "./AITradeSignals";
import { RedNewsWeek } from "@/components/fundamentals/RedNewsWeek";
import { BondYields } from "@/components/fundamentals/BondYields";
import { CurrencyBias } from "@/components/fundamentals/CurrencyBias";
import { MarketHoursStrip } from "@/components/common/MarketHours";
import { EtheralShadow } from "@/components/ui/etheral-shadow";
import { useAllBiasScores } from "@/lib/hooks/useAllBiasScores";
import { BiasAccuracySummary } from "@/components/bias/BiasAccuracy";
import { RiskCorrelation } from "@/components/bias/RiskCorrelation";
import { COTPositioning } from "@/components/fundamentals/COTPositioning";
import { TradeJournal } from "@/components/journal/TradeJournal";
import { useMarketStore } from "@/lib/store/market-store";
import { useSmartAlerts } from "@/lib/hooks/useSmartAlerts";
import { useRealtimePrices } from "@/lib/hooks/useRealtimePrices";
import { AITradeDesk } from "./AITradeDesk";
import { TradingAdvisor } from "./TradingAdvisor";
import { AccountStatusBar } from "./AccountStatusBar";
import { useTradeDeskData } from "@/lib/hooks/useTradeDeskData";
import { isSetupActive } from "@/lib/calculations/setup-tracker";
import { computePortfolioRisk } from "@/lib/calculations/risk-engine";
import { DEFAULT_RISK_CONFIG } from "@/lib/types/signals";
import { loadTrackedSetups } from "@/lib/storage/setup-storage";
import useSWR from "swr";
import { useMemo } from "react";
import { Activity, Sparkles, AlertTriangle, BarChart3, Shield, Brain, MessageSquare } from "lucide-react";

export function MarketOverview() {
  useAllBiasScores();
  useSmartAlerts();
  useRealtimePrices();
  const journalOpen = useMarketStore((s) => s.journalOpen);
  const setJournalOpen = useMarketStore((s) => s.setJournalOpen);

  // Read tracked setups from SWR (same key as useTrackedSetups — reads cached data, no processing)
  const { portfolioRisk: baseRisk } = useTradeDeskData();
  const { data: trackedSetups } = useSWR("tracked-setups", loadTrackedSetups, {
    revalidateOnFocus: false,
    refreshInterval: 0,
  });

  const { activeSetups, historySetups } = useMemo(() => {
    const all = trackedSetups ?? [];
    return {
      activeSetups: all.filter((t) => isSetupActive(t.status)),
      historySetups: all.filter((t) => !isSetupActive(t.status)),
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
        <AccountStatusBar
          portfolioRisk={portfolioRisk}
          openPositions={activeSetups.length}
          maxPositions={DEFAULT_RISK_CONFIG.maxOpenPositions}
        />

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

          {/* Section 3: Trading Advisor + AI Trade Desk */}
          <section>
            <SectionHeader
              title="AI Trade Desk"
              subtitle="Book-sourced mechanical systems, conviction tiers, and risk management"
              icon={<Brain className="h-3.5 w-3.5" />}
              accentColor="green"
            />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4">
              <div className="lg:col-span-5">
                <TradingAdvisor />
              </div>
              <div className="lg:col-span-7">
                <AITradeDesk />
              </div>
            </div>
          </section>

          {/* Section 4: Risk Calendar + AI Signals */}
          <section>
            <SectionHeader
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

          {/* Section 6: Portfolio Risk */}
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

      {journalOpen && <TradeJournal onClose={() => setJournalOpen(false)} />}
    </div>
  );
}
