"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Header } from "@/components/dashboard/Header";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { BacktestConfig } from "./BacktestConfig";
import { BacktestStats } from "./BacktestStats";
import { EquityCurveChart } from "./EquityCurveChart";
import { MonthlyReturnsGrid } from "./MonthlyReturnsGrid";
import { BreakdownTabs } from "./BreakdownTabs";
import { TradeLog } from "./TradeLog";
import { AutoImprovement } from "./AutoImprovement";
import { WeekendLab } from "./WeekendLab";
import { useBacktest } from "@/lib/hooks/useBacktest";
import { FlaskConical, BarChart3, TrendingUp, Layers, Cpu, Beaker } from "lucide-react";

type TestMode = "single" | "lab";

export function BacktestPage() {
  const [mode, setMode] = useState<TestMode>("single");
  const { config, setConfig, progress, result, run, stop } = useBacktest();

  return (
    <div className="min-h-screen bg-background">
      <Header mode="testing" />

      <div className="max-w-[1400px] mx-auto px-8 py-6 space-y-8">
        {/* Mode Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-2/30 border border-border/20 w-fit">
          <button
            onClick={() => setMode("single")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all",
              mode === "single"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FlaskConical className="h-3.5 w-3.5" />
            Single Backtest
          </button>
          <button
            onClick={() => setMode("lab")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all",
              mode === "lab"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Beaker className="h-3.5 w-3.5" />
            Weekend Lab
          </button>
        </div>

        {/* Single Backtest Mode */}
        {mode === "single" && (
          <>
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
                <section>
                  <SectionHeader
                    title="Performance Summary"
                    subtitle={`${result.trades.length} trades over ${result.candleCount} candles — ${result.computeTimeMs.toFixed(0)}ms`}
                    icon={<BarChart3 className="h-4 w-4" />}
                    accentColor="green"
                  />
                  <BacktestStats stats={result.stats} />
                </section>

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

                <section>
                  <TradeLog trades={result.trades} />
                </section>

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
          </>
        )}

        {/* Weekend Lab Mode */}
        {mode === "lab" && <WeekendLab />}
      </div>
    </div>
  );
}
