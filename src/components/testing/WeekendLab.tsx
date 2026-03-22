"use client";

import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { WeekendLabConfig } from "./WeekendLabConfig";
import { AggregateScorecard } from "./AggregateScorecard";
import { InstrumentGrid } from "./InstrumentGrid";
import { useWeekendLab } from "@/lib/hooks/useWeekendLab";
import { FlaskConical, BarChart3, Grid3X3, Brain } from "lucide-react";

export function WeekendLab() {
  const {
    batchConfig,
    setBatchConfig,
    progress,
    results,
    aggregateStats,
    confluenceFed,
    confluencePreview,
    runBatch,
    stopBatch,
    applyConfluenceFeedback,
  } = useWeekendLab();

  return (
    <div className="space-y-8">
      {/* Section 1: Config + Progress */}
      <section>
        <SectionHeader
          title="Weekend Lab Configuration"
          subtitle="Run the brain across all instruments with auto-improvement"
          icon={<FlaskConical className="h-4 w-4" />}
          accentColor="blue"
        />
        <WeekendLabConfig
          config={batchConfig}
          onConfigChange={setBatchConfig}
          progress={progress}
          onRun={runBatch}
          onStop={stopBatch}
        />
      </section>

      {/* Section 2: Aggregate Scorecard */}
      {aggregateStats && results.length > 0 && (
        <section>
          <SectionHeader
            title="Aggregate Performance"
            subtitle={`${results.length} instruments tested — ${aggregateStats.totalTrades} total trades`}
            icon={<BarChart3 className="h-4 w-4" />}
            accentColor="green"
          />
          <AggregateScorecard stats={aggregateStats} results={results} />
        </section>
      )}

      {/* Section 3: Instrument Grid */}
      {results.length > 0 && (
        <section>
          <SectionHeader
            title="Instrument Results"
            subtitle="Per-instrument backtest with before/after improvements"
            icon={<Grid3X3 className="h-4 w-4" />}
            accentColor="amber"
          />
          <InstrumentGrid results={results} />
        </section>
      )}

      {/* Section 4: Confluence Feedback */}
      {results.length > 0 && confluencePreview && (
        <section>
          <SectionHeader
            title="Confluence Learning"
            subtitle="Feed backtest outcomes into the brain's pattern memory"
            icon={<Brain className="h-4 w-4" />}
            accentColor="blue"
          />
          <div className="glass-card rounded-2xl border border-border/30 p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[11px] text-foreground">
                  <span className="font-bold">{confluencePreview.totalTrades}</span> trades across{" "}
                  <span className="font-bold">{confluencePreview.uniquePatterns}</span> unique confluence patterns
                </p>
                <p className="text-[9px] text-muted-foreground/50">
                  {Object.entries(confluencePreview.byCategory)
                    .map(([cat, count]) => `${cat}: ${count}`)
                    .join(" | ")}
                </p>
                {confluenceFed && (
                  <p className="text-[10px] text-bullish font-semibold mt-1">
                    Confluence patterns updated successfully
                  </p>
                )}
              </div>

              {!confluenceFed && (
                <button
                  onClick={applyConfluenceFeedback}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-[11px] font-bold transition-all hover:opacity-90"
                >
                  <Brain className="h-3.5 w-3.5" />
                  Apply to Brain
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
