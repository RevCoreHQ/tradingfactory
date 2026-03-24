"use client";

import { useRef } from "react";
import { useScroll } from "motion/react";
import { Header } from "@/components/dashboard/Header";
import { EtheralShadow } from "@/components/ui/etheral-shadow";
import { SystemHero } from "./SystemHero";
import { SystemPipelineFlow } from "./SystemPipelineFlow";
import { SystemSectionCard } from "./SystemSectionCard";
import { SystemMechanicalVsAi } from "./SystemMechanicalVsAi";
import { SystemFundamentals } from "./SystemFundamentals";
import { SystemSignalEngine } from "./SystemSignalEngine";
import { SystemConviction } from "./SystemConviction";
import { SystemRiskManagement } from "./SystemRiskManagement";
import { SystemTradeWalkthrough } from "./SystemTradeWalkthrough";
import { SystemFlowDiagram } from "./SystemFlowDiagram";
import { SystemComprehensiveGuide } from "./SystemComprehensiveGuide";
import {
  Sparkles,
  Globe,
  Cog,
  Target,
  Shield,
  Route,
  Workflow,
  BookOpen,
} from "lucide-react";

export function SystemPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  return (
    <div ref={containerRef} className="relative min-h-screen bg-background">
      {/* Ethereal shadow background — dark mode only */}
      <div className="fixed inset-0 z-0 hidden dark:block">
        <EtheralShadow
          color="rgba(12, 40, 35, 1)"
          animation={{ scale: 60, speed: 40 }}
          noise={{ opacity: 0.6, scale: 1.2 }}
          sizing="fill"
        />
      </div>

      <div className="relative z-10">
        <Header mode="brain" />

        <SystemHero scrollYProgress={scrollYProgress} />

        <main className="max-w-[1400px] mx-auto px-3 md:px-8 py-4 md:py-8 space-y-8 md:space-y-16">
          {/* Pipeline Visualization */}
          <section>
            <SystemPipelineFlow />
          </section>

          {/* Mechanical vs AI */}
          <section>
            <SystemSectionCard
              title="Mechanical vs Language Models"
              subtitle="What's rule-based and what uses language models"
              icon={<Sparkles className="h-4 w-4" />}
              accentColor="amber"
            >
              <SystemMechanicalVsAi />
            </SystemSectionCard>
          </section>

          {/* Fundamental Analysis */}
          <section>
            <SystemSectionCard
              title="Fundamental Analysis"
              subtitle="8 data sources that feed the bias engine"
              icon={<Globe className="h-4 w-4" />}
              accentColor="amber"
            >
              <SystemFundamentals />
            </SystemSectionCard>
          </section>

          {/* Signal Engine */}
          <section>
            <SystemSectionCard
              title="Signal Engine"
              subtitle="8 mechanical systems in 3 de-correlated clusters"
              icon={<Cog className="h-4 w-4" />}
              accentColor="green"
            >
              <SystemSignalEngine />
            </SystemSectionCard>
          </section>

          {/* Conviction Scoring */}
          <section>
            <SystemSectionCard
              title="Conviction Scoring"
              subtitle="De-correlated signals → A+ to D conviction tiers"
              icon={<Target className="h-4 w-4" />}
              accentColor="blue"
            >
              <SystemConviction />
            </SystemSectionCard>
          </section>

          {/* Risk Management */}
          <section>
            <SystemSectionCard
              title="Risk Management"
              subtitle="Position sizing, portfolio gates, and expectancy learning"
              icon={<Shield className="h-4 w-4" />}
              accentColor="red"
            >
              <SystemRiskManagement />
            </SystemSectionCard>
          </section>

          {/* Trade Walkthrough */}
          <section>
            <SystemSectionCard
              title="Follow a Trade"
              subtitle="Walk through the full pipeline with a EUR/USD example"
              icon={<Route className="h-4 w-4" />}
              accentColor="green"
            >
              <SystemTradeWalkthrough />
            </SystemSectionCard>
          </section>

          {/* Complete System Reference */}
          <section>
            <SystemSectionCard
              title="Complete System Reference"
              subtitle="Comprehensive technical documentation — every stage, model, and data flow"
              icon={<BookOpen className="h-4 w-4" />}
              accentColor="blue"
            >
              <SystemComprehensiveGuide />
            </SystemSectionCard>
          </section>

          {/* System Architecture Flow Diagram */}
          <section>
            <SystemSectionCard
              title="System Architecture"
              subtitle="Complete data flow from raw price feeds to desk manager output"
              icon={<Workflow className="h-4 w-4" />}
              accentColor="amber"
            >
              <div className="hidden md:block">
                <SystemFlowDiagram />
              </div>
              <p className="block md:hidden text-xs text-muted-foreground/50 text-center py-4">
                View on desktop for the full system architecture diagram
              </p>
            </SystemSectionCard>
          </section>
        </main>
      </div>
    </div>
  );
}
