"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { BacktestResult, Weakness, ParameterAdjustment, ImprovementAnalysis } from "@/lib/types/backtest";
import { analyzeWeaknesses } from "@/lib/calculations/backtest-analyzer";
import { AlertTriangle, Zap, ArrowRight, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  result: BacktestResult;
}

function SeverityBadge({ severity }: { severity: Weakness["severity"] }) {
  const config = {
    critical: { label: "CRITICAL", classes: "bg-bearish/15 text-bearish" },
    moderate: { label: "MODERATE", classes: "bg-amber-500/15 text-amber-700 dark:text-amber-500" },
    minor: { label: "MINOR", classes: "bg-muted-foreground/15 text-muted-foreground" },
  };
  const c = config[severity];
  return (
    <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded", c.classes)}>
      {c.label}
    </span>
  );
}

function ImpactBadge({ impact }: { impact: ParameterAdjustment["impact"] }) {
  const config = {
    high: { label: "HIGH", classes: "bg-bullish/15 text-bullish" },
    medium: { label: "MED", classes: "bg-amber-500/15 text-amber-700 dark:text-amber-500" },
    low: { label: "LOW", classes: "bg-muted-foreground/15 text-muted-foreground" },
  };
  const c = config[impact];
  return (
    <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded", c.classes)}>
      {c.label}
    </span>
  );
}

function WeaknessCard({ weakness }: { weakness: Weakness }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="section-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className={cn(
            "h-3.5 w-3.5 shrink-0",
            weakness.severity === "critical" ? "text-bearish" : weakness.severity === "moderate" ? "text-amber-500" : "text-muted-foreground"
          )} />
          <span className="text-xs font-semibold text-foreground truncate">{weakness.area}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SeverityBadge severity={weakness.severity} />
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <p className="text-[13px] text-muted-foreground leading-relaxed">{weakness.description}</p>
      {expanded && (
        <div className="space-y-1.5 pt-1 border-t border-border/20">
          <div>
            <span className="text-[11px] font-bold text-muted-foreground/50 uppercase">Evidence</span>
            <p className="text-[12px] font-mono text-muted-foreground/70">{weakness.evidence}</p>
          </div>
          <div>
            <span className="text-[11px] font-bold text-muted-foreground/50 uppercase">Suggested Fix</span>
            <p className="text-[12px] text-muted-foreground/70">{weakness.suggestedFix}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestionCard({ suggestion }: { suggestion: ParameterAdjustment }) {
  return (
    <div className="section-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Zap className="h-3.5 w-3.5 shrink-0 text-neutral-accent" />
          <span className="text-xs font-semibold text-foreground font-mono">{suggestion.parameter}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--surface-1)] text-muted-foreground/60">{suggestion.category}</span>
          <ImpactBadge impact={suggestion.impact} />
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="font-mono text-bearish/70">{String(suggestion.currentValue)}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground/30" />
        <span className="font-mono font-bold text-bullish">{String(suggestion.suggestedValue)}</span>
      </div>

      <p className="text-[12px] text-muted-foreground/70 leading-relaxed">{suggestion.reasoning}</p>
    </div>
  );
}

function StatDelta({ label, before, after, format, invert }: {
  label: string;
  before: number;
  after: number;
  format: (n: number) => string;
  invert?: boolean;
}) {
  const delta = after - before;
  const isGood = invert ? delta < 0 : delta > 0;
  return (
    <div className="text-center">
      <div className="text-[11px] font-bold text-muted-foreground/50 uppercase mb-1">{label}</div>
      <div className="text-xs font-mono text-muted-foreground/60">{format(before)}</div>
      <div className={cn("text-sm font-mono font-bold", isGood ? "text-bullish" : delta === 0 ? "text-muted-foreground" : "text-bearish")}>
        {delta > 0 ? "+" : ""}{format(delta)}
      </div>
      <div className="text-xs font-mono text-foreground">{format(after)}</div>
    </div>
  );
}

export function AutoImprovement({ result }: Props) {
  const [analysis, setAnalysis] = useState<ImprovementAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<BacktestResult | null>(null);

  const runAnalysis = useCallback(() => {
    setLoading(true);
    setError(null);
    setComparisonResult(null);

    // Mechanical weakness detection only — LLM optimization disabled
    const weaknesses = analyzeWeaknesses(result);
    setAnalysis({
      weaknesses,
      suggestions: [],
      summary: weaknesses.length > 0
        ? "Mechanical analysis complete. Use grid search or manual tuning for parameter optimization."
        : "",
      confidence: 0,
    });
    setLoading(false);
  }, [result]);

  const criticalCount = analysis?.weaknesses.filter((w) => w.severity === "critical").length ?? 0;
  const moderateCount = analysis?.weaknesses.filter((w) => w.severity === "moderate").length ?? 0;

  return (
    <div className="space-y-4">
      {/* Action row */}
      <div className="section-card p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            Detect systematic weaknesses in backtest performance.
          </p>
          {analysis && (
            <div className="flex items-center gap-3 mt-1.5">
              {criticalCount > 0 && (
                <span className="text-[12px] font-bold text-bearish">{criticalCount} critical</span>
              )}
              {moderateCount > 0 && (
                <span className="text-[12px] font-bold text-amber-500">{moderateCount} moderate</span>
              )}
              <span className="text-[12px] font-mono text-muted-foreground/40">
                {analysis.suggestions.length} suggestions · {analysis.confidence}% confidence
              </span>
            </div>
          )}
        </div>

        <button
          onClick={runAnalysis}
          disabled={loading}
          className={cn(
            "px-4 py-2 rounded-lg text-xs font-semibold transition-all",
            loading
              ? "bg-[var(--surface-1)] text-muted-foreground cursor-not-allowed"
              : "bg-neutral-accent text-background hover:bg-neutral-accent/90"
          )}
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analyzing...
            </span>
          ) : analysis ? (
            "Re-Analyze"
          ) : (
            "Detect Weaknesses"
          )}
        </button>
      </div>

      {error && (
        <div className="section-card p-3 border-bearish/20">
          <p className="text-xs text-bearish">{error}</p>
        </div>
      )}

      {analysis && (
        <>
          {/* Summary */}
          {analysis.summary && (
            <div className="section-card p-3">
              <p className="text-xs text-foreground leading-relaxed">{analysis.summary}</p>
            </div>
          )}

          {/* Weaknesses */}
          {analysis.weaknesses.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[12px] font-bold text-muted-foreground/50 uppercase tracking-wider">
                Detected Weaknesses ({analysis.weaknesses.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {analysis.weaknesses.map((w, i) => (
                  <WeaknessCard key={i} weakness={w} />
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {analysis.suggestions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[12px] font-bold text-muted-foreground/50 uppercase tracking-wider">
                Suggested Adjustments ({analysis.suggestions.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {analysis.suggestions.map((s, i) => (
                  <SuggestionCard key={i} suggestion={s} />
                ))}
              </div>
            </div>
          )}

          {/* Before/After comparison */}
          {comparisonResult && (
            <div className="space-y-2">
              <h3 className="text-[12px] font-bold text-muted-foreground/50 uppercase tracking-wider">
                Before vs After
              </h3>
              <div className="section-card p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatDelta
                    label="Win Rate"
                    before={result.stats.winRate}
                    after={comparisonResult.stats.winRate}
                    format={(n) => `${(n * 100).toFixed(1)}%`}
                  />
                  <StatDelta
                    label="Expectancy"
                    before={result.stats.expectancy}
                    after={comparisonResult.stats.expectancy}
                    format={(n) => `${n.toFixed(3)}R`}
                  />
                  <StatDelta
                    label="Profit Factor"
                    before={result.stats.profitFactor}
                    after={comparisonResult.stats.profitFactor}
                    format={(n) => n.toFixed(2)}
                  />
                  <StatDelta
                    label="Max Drawdown"
                    before={result.stats.maxDrawdownPercent}
                    after={comparisonResult.stats.maxDrawdownPercent}
                    format={(n) => `${n.toFixed(1)}%`}
                    invert
                  />
                </div>
              </div>
            </div>
          )}

          {/* No weaknesses found */}
          {analysis.weaknesses.length === 0 && analysis.suggestions.length === 0 && (
            <div className="section-card p-6 text-center">
              <p className="text-xs text-muted-foreground">
                No significant weaknesses detected. The system appears well-calibrated for this dataset.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
