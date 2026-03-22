"use client";

import { useState, useCallback } from "react";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { WeekendLabConfig } from "./WeekendLabConfig";
import { AggregateScorecard } from "./AggregateScorecard";
import { InstrumentGrid } from "./InstrumentGrid";
import { useWeekendLab } from "@/lib/hooks/useWeekendLab";
import { FlaskConical, BarChart3, Grid3X3, Brain, Zap, Copy, Check } from "lucide-react";

export function WeekendLab() {
  const {
    batchConfig,
    setBatchConfig,
    progress,
    results,
    aggregateStats,
    confluenceFed,
    confluencePreview,
    paramsApplied,
    improvementCount,
    runBatch,
    stopBatch,
    applyConfluenceFeedback,
    applyOptimizedParams,
    getOptimizationPrompt,
  } = useWeekendLab();

  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = useCallback(() => {
    const prompt = getOptimizationPrompt();
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [getOptimizationPrompt]);

  return (
    <div className="space-y-8">
      {/* Section 1: Config + Progress */}
      <section>
        <SectionHeader
          title="Weekend Lab Configuration"
          subtitle="Parameter sweep across all instruments with auto-improvement"
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
            subtitle="Per-instrument sweep — expand for variant comparison"
            icon={<Grid3X3 className="h-4 w-4" />}
            accentColor="amber"
          />
          <InstrumentGrid results={results} />
        </section>
      )}

      {/* Section 4: Apply Optimizations */}
      {results.length > 0 && improvementCount > 0 && (
        <section>
          <SectionHeader
            title="Apply Optimizations"
            subtitle={`${improvementCount} instruments found better parameters via sweep`}
            icon={<Zap className="h-4 w-4" />}
            accentColor="green"
          />
          <div className="glass-card rounded-2xl border border-border/30 p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Runtime: Save to localStorage */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                  Runtime Override
                </h4>
                <p className="text-[10px] text-muted-foreground/50">
                  Saves optimized params to localStorage. The desk will auto-load them as overrides per instrument.
                  Resets on clear storage.
                </p>
                {paramsApplied ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-bullish font-semibold">
                    <Check className="h-3.5 w-3.5" />
                    {improvementCount} profiles saved — desk will use them automatically
                  </div>
                ) : (
                  <button
                    onClick={applyOptimizedParams}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-[11px] font-bold transition-all hover:opacity-90"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Apply to Desk ({improvementCount})
                  </button>
                )}
              </div>

              {/* Permanent: Copy prompt for Claude */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                  Permanent Code Change
                </h4>
                <p className="text-[10px] text-muted-foreground/50">
                  Copies a prompt with the exact STYLE_PARAMS changes. Paste into Claude to update the code permanently.
                </p>
                <button
                  onClick={handleCopyPrompt}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border/30 text-foreground text-[11px] font-bold transition-all hover:bg-surface-2/30"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-bullish" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy for Claude
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Section 5: Confluence Feedback */}
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
