"use client";

import { Header } from "@/components/dashboard/Header";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { EtheralShadow } from "@/components/ui/etheral-shadow";
import { PipelineFlow } from "./PipelineFlow";
import { AIvsRulesCallout } from "./AIvsRulesCallout";
import { FundamentalSourcesGrid } from "./FundamentalSourcesGrid";
import { MechanicalSystemsGrid } from "./MechanicalSystemsGrid";
import { ConvictionBreakdown } from "./ConvictionBreakdown";
import { RiskManagementVisual } from "./RiskManagementVisual";
import { TradeWalkthrough } from "./TradeWalkthrough";
import {
  Brain,
  Sparkles,
  Globe,
  Cog,
  Target,
  Shield,
  Route,
} from "lucide-react";

export function TradingBrain() {
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
        <Header mode="brain" />

        <main className="max-w-[1400px] mx-auto px-8 py-6 space-y-8">
          {/* Section 1: Pipeline Overview */}
          <section>
            <SectionHeader
              title="Trading Brain"
              subtitle="How trade ideas are generated — from raw data to final setup"
              icon={<Brain className="h-3.5 w-3.5" />}
              accentColor="blue"
            />
            <PipelineFlow />
          </section>

          {/* Section 2: AI vs Mechanical */}
          <section>
            <SectionHeader
              title="Mechanical vs AI"
              subtitle="What's rule-based and what uses language models"
              icon={<Sparkles className="h-3.5 w-3.5" />}
              accentColor="amber"
            />
            <AIvsRulesCallout />
          </section>

          {/* Section 3: Fundamental Sources */}
          <section>
            <SectionHeader
              title="Fundamental Analysis"
              subtitle="7 data sources that feed the bias engine"
              icon={<Globe className="h-3.5 w-3.5" />}
              accentColor="amber"
            />
            <FundamentalSourcesGrid />
          </section>

          {/* Section 4: Mechanical Systems */}
          <section>
            <SectionHeader
              title="Mechanical Signal Engine"
              subtitle="8 book-sourced systems — 100% rule-based, zero AI"
              icon={<Cog className="h-3.5 w-3.5" />}
              accentColor="green"
            />
            <MechanicalSystemsGrid />
          </section>

          {/* Section 5: Conviction Scoring */}
          <section>
            <SectionHeader
              title="Conviction Scoring"
              subtitle="How signals become A+ to D conviction tiers"
              icon={<Target className="h-3.5 w-3.5" />}
              accentColor="blue"
            />
            <ConvictionBreakdown />
          </section>

          {/* Section 6: Risk Management */}
          <section>
            <SectionHeader
              title="Risk Management"
              subtitle="Position sizing, portfolio limits, and the self-learning loop"
              icon={<Shield className="h-3.5 w-3.5" />}
              accentColor="red"
            />
            <RiskManagementVisual />
          </section>

          {/* Section 7: Walk Through a Trade */}
          <section>
            <SectionHeader
              title="Follow a Trade Idea"
              subtitle="Walk through the full pipeline with a EUR/USD example"
              icon={<Route className="h-3.5 w-3.5" />}
              accentColor="green"
            />
            <TradeWalkthrough />
          </section>
        </main>
      </div>
    </div>
  );
}
