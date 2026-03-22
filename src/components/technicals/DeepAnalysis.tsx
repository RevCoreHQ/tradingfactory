"use client";

import { useDeepAnalysis, useDeepAnalysisLLM } from "@/lib/hooks/useDeepAnalysis";
import { useBiasScore } from "@/lib/hooks/useBiasScore";
import { useMarketStore } from "@/lib/store/market-store";
import { TradingViewChart } from "./TradingViewChart";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  Layers,
  Crosshair,
  Sparkles,
  Target,
} from "lucide-react";
import type { SupplyDemandZone, ConfluenceLevel, AITradeIdea, FairValueGap } from "@/lib/types/deep-analysis";

function FreshnessBadge({ freshness, testCount }: { freshness: string; testCount: number }) {
  if (freshness === "fresh") {
    return (
      <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-bullish/15 text-bullish">
        FRESH
      </span>
    );
  }
  return (
    <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">
      TESTED ×{testCount}
    </span>
  );
}

function StrengthBar({ strength }: { strength: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
        <div
          className="h-full rounded-full bg-neutral-accent transition-all duration-300"
          style={{ width: `${strength}%`, opacity: 0.7 + (strength / 100) * 0.3 }}
        />
      </div>
      <span className="text-[9px] font-mono text-muted-foreground/60 w-6 text-right">
        {strength}
      </span>
    </div>
  );
}

function ZoneCard({ zone, decimals }: { zone: SupplyDemandZone; decimals: number }) {
  const isSupply = zone.type === "supply";

  return (
    <div
      className={cn(
        "rounded-lg p-3 border transition-colors",
        isSupply
          ? "bg-bearish/5 border-bearish/20"
          : "bg-bullish/5 border-bullish/20"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {isSupply ? (
            <TrendingDown className="h-3 w-3 text-bearish" />
          ) : (
            <TrendingUp className="h-3 w-3 text-bullish" />
          )}
          <span className={cn("text-[10px] font-bold uppercase", isSupply ? "text-bearish" : "text-bullish")}>
            {zone.type}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <FreshnessBadge freshness={zone.freshness} testCount={zone.testCount} />
          {zone.isOrderBlock && (
            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-neutral-accent/15 text-neutral-accent">
              OB
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-foreground">
          {zone.priceLow.toFixed(decimals)} – {zone.priceHigh.toFixed(decimals)}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground/50">
          {zone.impulseMagnitude.toFixed(1)}× ATR
        </span>
      </div>

      <StrengthBar strength={zone.strength} />
    </div>
  );
}

function ZoneSummary({ supplyZones, demandZones, decimals }: {
  supplyZones: SupplyDemandZone[];
  demandZones: SupplyDemandZone[];
  decimals: number;
}) {
  return (
    <div className="section-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="h-4 w-4 text-neutral-accent" />
        <h3 className="text-xs font-semibold text-foreground">Supply & Demand Zones</h3>
        <span className="text-[9px] font-mono text-muted-foreground/40 ml-auto">
          {supplyZones.length + demandZones.length} zones detected
        </span>
      </div>

      {supplyZones.length === 0 && demandZones.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 text-center py-4">
          No significant zones found — try a longer timeframe
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <span className="text-[9px] font-bold text-bearish uppercase tracking-wider">Supply Zones</span>
            {supplyZones.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/40">None detected</p>
            ) : (
              supplyZones.slice(0, 4).map((z, i) => (
                <ZoneCard key={`s-${i}`} zone={z} decimals={decimals} />
              ))
            )}
          </div>
          <div className="space-y-2">
            <span className="text-[9px] font-bold text-bullish uppercase tracking-wider">Demand Zones</span>
            {demandZones.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/40">None detected</p>
            ) : (
              demandZones.slice(0, 4).map((z, i) => (
                <ZoneCard key={`d-${i}`} zone={z} decimals={decimals} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FVGCard({ fvg, decimals }: { fvg: FairValueGap; decimals: number }) {
  const isBullish = fvg.type === "bullish";
  return (
    <div
      className={cn(
        "rounded-lg p-3 border transition-colors",
        isBullish ? "bg-bullish/5 border-bullish/20" : "bg-bearish/5 border-bearish/20"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {isBullish ? (
            <TrendingUp className="h-3 w-3 text-bullish" />
          ) : (
            <TrendingDown className="h-3 w-3 text-bearish" />
          )}
          <span className={cn("text-[10px] font-bold uppercase", isBullish ? "text-bullish" : "text-bearish")}>
            {fvg.type} FVG
          </span>
        </div>
        <span className={cn(
          "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded",
          fvg.freshness === "fresh" ? "bg-bullish/15 text-bullish" : "bg-amber-500/15 text-amber-700 dark:text-amber-500"
        )}>
          {fvg.freshness === "fresh" ? "FRESH" : `${fvg.fillPercent.toFixed(0)}% FILLED`}
        </span>
      </div>

      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono text-foreground">
          {fvg.low.toFixed(decimals)} – {fvg.high.toFixed(decimals)}
        </span>
        <span className="text-[9px] font-mono text-muted-foreground/50">
          {fvg.sizeATR.toFixed(1)}× ATR
        </span>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] text-muted-foreground/60">
          CE: <span className="font-mono text-foreground/80">{fvg.midpoint.toFixed(decimals)}</span>
        </span>
      </div>

      <StrengthBar strength={fvg.strength} />
    </div>
  );
}

function FVGSummary({ fairValueGaps, decimals }: {
  fairValueGaps: FairValueGap[];
  decimals: number;
}) {
  if (fairValueGaps.length === 0) return null;

  const bullishFVGs = fairValueGaps.filter((f) => f.type === "bullish");
  const bearishFVGs = fairValueGaps.filter((f) => f.type === "bearish");

  return (
    <div className="section-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="h-4 w-4 text-amber-700 dark:text-amber-500" />
        <h3 className="text-xs font-semibold text-foreground">Fair Value Gaps</h3>
        <span className="text-[9px] font-mono text-muted-foreground/40 ml-auto">
          {fairValueGaps.length} FVGs detected
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <span className="text-[9px] font-bold text-bullish uppercase tracking-wider">Bullish FVGs</span>
          {bullishFVGs.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/40">None detected</p>
          ) : (
            bullishFVGs.slice(0, 4).map((f, i) => (
              <FVGCard key={`bf-${i}`} fvg={f} decimals={decimals} />
            ))
          )}
        </div>
        <div className="space-y-2">
          <span className="text-[9px] font-bold text-bearish uppercase tracking-wider">Bearish FVGs</span>
          {bearishFVGs.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/40">None detected</p>
          ) : (
            bearishFVGs.slice(0, 4).map((f, i) => (
              <FVGCard key={`bef-${i}`} fvg={f} decimals={decimals} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ConfluenceLevelsList({ levels, currentPrice, decimals }: {
  levels: ConfluenceLevel[];
  currentPrice: number;
  decimals: number;
}) {
  return (
    <div className="section-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Crosshair className="h-4 w-4 text-neutral-accent" />
        <h3 className="text-xs font-semibold text-foreground">Confluence Levels</h3>
        <span className="text-[9px] font-mono text-muted-foreground/40 ml-auto">
          {levels.length} key levels
        </span>
      </div>

      {levels.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 text-center py-4">
          No confluence detected
        </p>
      ) : (
        <div className="space-y-2">
          {levels.map((level, i) => {
            const isSupport = level.type === "support";
            const distance = ((level.price - currentPrice) / currentPrice * 100).toFixed(2);
            const distanceStr = `${Number(distance) > 0 ? "+" : ""}${distance}%`;

            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-3 rounded-lg p-2.5 border",
                  isSupport ? "border-bullish/15 bg-bullish/5" : "border-bearish/15 bg-bearish/5"
                )}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={cn(
                    "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded",
                    isSupport ? "bg-bullish/15 text-bullish" : "bg-bearish/15 text-bearish"
                  )}>
                    {level.type === "support" ? "S" : "R"}
                  </span>
                  <span className="text-xs font-mono font-bold text-foreground">
                    {level.price.toFixed(decimals)}
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground/50">
                    {distanceStr}
                  </span>
                </div>

                <div className="flex items-center gap-1 flex-wrap flex-1 justify-end">
                  {level.sources.map((s, j) => (
                    <span
                      key={j}
                      className="text-[8px] font-mono px-1 py-0.5 rounded bg-[var(--surface-3)] text-muted-foreground/60"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  {Array.from({ length: Math.min(level.score, 5) }).map((_, k) => (
                    <div
                      key={k}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        isSupport ? "bg-bullish" : "bg-bearish"
                      )}
                      style={{ opacity: 0.4 + (k / 5) * 0.6 }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TradeIdeaCard({ idea, decimals }: { idea: AITradeIdea; decimals: number }) {
  const isLong = idea.direction === "long";

  return (
    <div className={cn(
      "rounded-lg p-4 border",
      isLong ? "border-bullish/20 bg-bullish/5" : "border-bearish/20 bg-bearish/5"
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isLong ? (
            <TrendingUp className="h-4 w-4 text-bullish" />
          ) : (
            <TrendingDown className="h-4 w-4 text-bearish" />
          )}
          <span className={cn("text-xs font-bold uppercase", isLong ? "text-bullish" : "text-bearish")}>
            {idea.direction}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground/50">{idea.timeframe}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">
            R:R {idea.riskReward.toFixed(1)}
          </span>
          <span className={cn(
            "text-[9px] font-bold px-1.5 py-0.5 rounded",
            idea.confidence >= 70 ? "bg-bullish/15 text-bullish" :
            idea.confidence >= 40 ? "bg-amber-500/15 text-amber-500" :
            "bg-bearish/15 text-bearish"
          )}>
            {idea.confidence}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-[var(--surface-2)] rounded px-2 py-1.5">
          <div className="text-[8px] text-muted-foreground/50 uppercase">Entry</div>
          <div className="text-[11px] font-mono text-foreground">{idea.entry.toFixed(decimals)}</div>
        </div>
        <div className="bg-[var(--surface-2)] rounded px-2 py-1.5">
          <div className="text-[8px] text-muted-foreground/50 uppercase">Stop Loss</div>
          <div className="text-[11px] font-mono text-bearish">{idea.stopLoss.toFixed(decimals)}</div>
        </div>
        <div className="bg-[var(--surface-2)] rounded px-2 py-1.5">
          <div className="text-[8px] text-muted-foreground/50 uppercase">Target</div>
          <div className="text-[11px] font-mono text-bullish">{idea.takeProfit.toFixed(decimals)}</div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground leading-snug mb-2">{idea.rationale}</p>

      <div className="flex items-center gap-1 flex-wrap">
        {idea.confluenceFactors.map((f, i) => (
          <span key={i} className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-muted-foreground/60">
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}

function AITradeIdeas({ deepAnalysis, indicators, biasResult }: {
  deepAnalysis: ReturnType<typeof useDeepAnalysis>["deepAnalysis"];
  indicators: import("@/lib/types/indicators").TechnicalSummary | null;
  biasResult: import("@/lib/types/bias").BiasResult | null;
}) {
  const { tradeIdeas, isLoading, generate, retry, isRequested } = useDeepAnalysisLLM(deepAnalysis, indicators, biasResult);
  const instrument = useMarketStore((s) => s.selectedInstrument);
  const hasIndicators = !!indicators;

  return (
    <div className="section-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-neutral-accent" />
          <h3 className="text-xs font-semibold text-foreground">AI Trade Ideas</h3>
        </div>

        {!isRequested && (
          <button
            onClick={generate}
            disabled={!hasIndicators}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-colors",
              hasIndicators
                ? "bg-neutral-accent/15 text-neutral-accent hover:bg-neutral-accent/25"
                : "bg-[var(--surface-2)] text-muted-foreground/40 cursor-not-allowed"
            )}
          >
            <Sparkles className="h-3 w-3" />
            {hasIndicators ? "Generate Ideas" : "Waiting for data..."}
          </button>
        )}
      </div>

      {!isRequested ? (
        <p className="text-xs text-muted-foreground/50 text-center py-6">
          {hasIndicators
            ? "Click \"Generate Ideas\" to get AI-powered trade setups based on detected zones and levels"
            : "Price data loading — AI trade ideas will be available once chart data loads"
          }
        </p>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-1/4 shimmer rounded" />
              <div className="h-16 shimmer rounded-lg" />
              <div className="h-3 w-3/4 shimmer rounded" />
            </div>
          ))}
        </div>
      ) : tradeIdeas ? (
        <div className="space-y-3">
          {tradeIdeas.summary && (
            <p className="text-[11px] text-muted-foreground leading-snug border-l-2 border-neutral-accent/30 pl-3 mb-3">
              {tradeIdeas.summary}
            </p>
          )}

          {tradeIdeas.tradeIdeas.map((idea, i) => (
            <TradeIdeaCard key={i} idea={idea} decimals={instrument.decimalPlaces} />
          ))}

          {tradeIdeas.keyLevelsToWatch.length > 0 && (
            <div className="flex items-start gap-2 mt-3">
              <Target className="h-3.5 w-3.5 text-muted-foreground/40 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">Watch</span>
                {tradeIdeas.keyLevelsToWatch.map((level, i) => (
                  <p key={i} className="text-[10px] text-muted-foreground/60">{level}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-6 space-y-3">
          <p className="text-xs text-muted-foreground/50">
            {!hasIndicators ? "Waiting for price data..." : "AI analysis unavailable"}
          </p>
          {hasIndicators && (
            <button
              onClick={retry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-neutral-accent/15 text-neutral-accent hover:bg-neutral-accent/25 transition-colors mx-auto"
            >
              <Sparkles className="h-3 w-3" />
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function DeepAnalysis() {
  const { deepAnalysis, indicators, isLoading } = useDeepAnalysis();
  const { biasResult } = useBiasScore();
  const instrument = useMarketStore((s) => s.selectedInstrument);

  return (
    <div className="space-y-4">
      {/* TradingView chart always renders — it loads its own data */}
      <TradingViewChart heightClass="h-[400px] lg:h-[500px]" />

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="h-32 shimmer rounded-lg" />
          <div className="h-32 shimmer rounded-lg" />
        </div>
      ) : (
        <>
          {deepAnalysis && (
            <>
              <ZoneSummary
                supplyZones={deepAnalysis.supplyZones}
                demandZones={deepAnalysis.demandZones}
                decimals={instrument.decimalPlaces}
              />
              {deepAnalysis.fairValueGaps && deepAnalysis.fairValueGaps.length > 0 && (
                <FVGSummary
                  fairValueGaps={deepAnalysis.fairValueGaps}
                  decimals={instrument.decimalPlaces}
                />
              )}
              <ConfluenceLevelsList
                levels={deepAnalysis.confluenceLevels}
                currentPrice={deepAnalysis.currentPrice}
                decimals={instrument.decimalPlaces}
              />
            </>
          )}
        </>
      )}

      {/* AI Trade Ideas — always rendered, works with or without zone data */}
      <AITradeIdeas deepAnalysis={deepAnalysis} indicators={indicators} biasResult={biasResult} />
    </div>
  );
}
