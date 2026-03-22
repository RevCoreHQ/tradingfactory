"use client";

import { Header } from "@/components/dashboard/Header";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { BacktestConfig } from "./BacktestConfig";
import { BacktestStats } from "./BacktestStats";
import { EquityCurveChart } from "./EquityCurveChart";
import { MonthlyReturnsGrid } from "./MonthlyReturnsGrid";
import { BreakdownTabs } from "./BreakdownTabs";
import { TradeLog } from "./TradeLog";
import { AutoImprovement } from "./AutoImprovement";
import { useBacktest } from "@/lib/hooks/useBacktest";
import { FlaskConical, BarChart3, TrendingUp, Layers, Cpu } from "lucide-react";

export function BacktestPage() {
  const { config, setConfig, progress, result, run, stop } = useBacktest();

  return (
    <div className="min-h-screen bg-background">
      <Header mode="testing" />

      <div className="max-w-[1400px] mx-auto px-8 py-6 space-y-8">
        {/* Section 1: Configuration */}
        <section>
          <SectionHeader
            title="Backtest Configuration"
            subtitle="Run the brain against historical data"
            icon={<FlaskConical className="h-4 w-4" />}
            accentColor="blue"
          />
          <BacktestConfig
            config={config}
            onConfigChange={setConfig}
            progress={progress}
            onRun={run}
            onStop={stop}
          />
        </section>

        {result && (
          <>
            {/* Section 2: Key Statistics */}
            <section>
              <SectionHeader
                title="Performance Summary"
                subtitle={`${result.trades.length} trades over ${result.candleCount} candles — ${result.computeTimeMs.toFixed(0)}ms`}
                icon={<BarChart3 className="h-4 w-4" />}
                accentColor="green"
              />
              <BacktestStats stats={result.stats} />
            </section>

            {/* Section 3: Equity Curve + Monthly Returns */}
            <section>
              <SectionHeader
                title="Equity Curve"
                subtitle="Account growth and drawdown over time"
                icon={<TrendingUp className="h-4 w-4" />}
                accentColor="green"
              />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <EquityCurveChart equityCurve={result.equityCurve} trades={result.trades} />
                </div>
                <div>
                  <MonthlyReturnsGrid monthlyReturns={result.monthlyReturns} />
                </div>
              </div>
            </section>

            {/* Section 4: Breakdowns */}
            <section>
              <SectionHeader
                title="Performance Breakdown"
                subtitle="Analyze edge by system, regime, and conviction"
                icon={<Layers className="h-4 w-4" />}
                accentColor="amber"
              />
              <BreakdownTabs
                systemBreakdown={result.systemBreakdown}
                regimeBreakdown={result.regimeBreakdown}
                convictionBreakdown={result.convictionBreakdown}
                trades={result.trades}
              />
            </section>

            {/* Section 5: Trade Log */}
            <section>
              <TradeLog trades={result.trades} />
            </section>

            {/* Section 6: Auto-Improvement */}
            <section>
              <SectionHeader
                title="Auto-Improvement"
                subtitle="AI-powered weakness detection and parameter optimization"
                icon={<Cpu className="h-4 w-4" />}
                accentColor="blue"
              />
              <AutoImprovement result={result} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}
