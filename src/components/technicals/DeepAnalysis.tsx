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
import type { SupplyDemandZone, ConfluenceLevel, FairValueGap } from "@/lib/types/deep-analysis";

function FreshnessBadge({ freshness, testCount }: { freshness: string; testCount: number }) {
  if (freshness === "fresh") {
    return (
      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-bullish/15 text-bullish">
        FRESH
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500">
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
      <span className="text-[11px] font-mono text-muted-foreground/60 w-6 text-right">
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
          <span className={cn("text-[12px] font-bold uppercase", isSupply ? "text-bearish" : "text-bullish")}>
            {zone.type}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <FreshnessBadge freshness={zone.freshness} testCount={zone.testCount} />
          {zone.isOrderBlock && (
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-neutral-accent/15 text-neutral-accent">
              OB
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-foreground">
          {zone.priceLow.toFixed(decimals)} – {zone.priceHigh.toFixed(decimals)}
        </span>
        <span className="text-[11px] font-mono text-muted-foreground/50">
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
        <span className="text-[11px] font-mono text-muted-foreground/40 ml-auto">
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
            <span className="text-[11px] font-bold text-bearish uppercase tracking-wider">Supply Zones</span>
            {supplyZones.length === 0 ? (
              <p className="text-[12px] text-muted-foreground/40">None detected</p>
            ) : (
              supplyZones.slice(0, 4).map((z, i) => (
                <ZoneCard key={`s-${i}`} zone={z} decimals={decimals} />
              ))
            )}
          </div>
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-bullish uppercase tracking-wider">Demand Zones</span>
            {demandZones.length === 0 ? (
              <p className="text-[12px] text-muted-foreground/40">None detected</p>
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
          <span className={cn("text-[12px] font-bold uppercase", isBullish ? "text-bullish" : "text-bearish")}>
            {fvg.type} FVG
          </span>
        </div>
        <span className={cn(
          "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
          fvg.freshness === "fresh" ? "bg-bullish/15 text-bullish" : "bg-amber-500/15 text-amber-700 dark:text-amber-500"
        )}>
          {fvg.freshness === "fresh" ? "FRESH" : `${fvg.fillPercent.toFixed(0)}% FILLED`}
        </span>
      </div>

      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono text-foreground">
          {fvg.low.toFixed(decimals)} – {fvg.high.toFixed(decimals)}
        </span>
        <span className="text-[11px] font-mono text-muted-foreground/50">
          {fvg.sizeATR.toFixed(1)}× ATR
        </span>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-muted-foreground/60">
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
        <span className="text-[11px] font-mono text-muted-foreground/40 ml-auto">
          {fairValueGaps.length} FVGs detected
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-bullish uppercase tracking-wider">Bullish FVGs</span>
          {bullishFVGs.length === 0 ? (
            <p className="text-[12px] text-muted-foreground/40">None detected</p>
          ) : (
            bullishFVGs.slice(0, 4).map((f, i) => (
              <FVGCard key={`bf-${i}`} fvg={f} decimals={decimals} />
            ))
          )}
        </div>
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-bearish uppercase tracking-wider">Bearish FVGs</span>
          {bearishFVGs.length === 0 ? (
            <p className="text-[12px] text-muted-foreground/40">None detected</p>
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
        <span className="text-[11px] font-mono text-muted-foreground/40 ml-auto">
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
                    "text-[11px] font-bold uppercase px-1.5 py-0.5 rounded",
                    isSupport ? "bg-bullish/15 text-bullish" : "bg-bearish/15 text-bearish"
                  )}>
                    {level.type === "support" ? "S" : "R"}
                  </span>
                  <span className="text-xs font-mono font-bold text-foreground">
                    {level.price.toFixed(decimals)}
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground/50">
                    {distanceStr}
                  </span>
                </div>

                <div className="flex items-center gap-1 flex-wrap flex-1 justify-end">
                  {level.sources.map((s, j) => (
                    <span
                      key={j}
                      className="text-[10px] font-mono px-1 py-0.5 rounded bg-[var(--surface-3)] text-muted-foreground/60"
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

function AIZoneAnalysis({ deepAnalysis, indicators, biasResult }: {
  deepAnalysis: ReturnType<typeof useDeepAnalysis>["deepAnalysis"];
  indicators: import("@/lib/types/indicators").TechnicalSummary | null;
  biasResult: import("@/lib/types/bias").BiasResult | null;
}) {
  const { tradeIdeas: zoneResult, isLoading, generate, retry, isRequested } = useDeepAnalysisLLM(deepAnalysis, indicators, biasResult);
  const hasIndicators = !!indicators;

  return (
    <div className="section-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-neutral-accent" />
          <h3 className="text-xs font-semibold text-foreground">Zone Analysis</h3>
        </div>

        {!isRequested && (
          <button
            onClick={generate}
            disabled={!hasIndicators}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors",
              hasIndicators
                ? "bg-neutral-accent/15 text-neutral-accent hover:bg-neutral-accent/25"
                : "bg-[var(--surface-2)] text-muted-foreground/40 cursor-not-allowed"
            )}
          >
            <Sparkles className="h-3 w-3" />
            {hasIndicators ? "Analyze Zones" : "Waiting for data..."}
          </button>
        )}
      </div>

      {!isRequested ? (
        <p className="text-xs text-muted-foreground/50 text-center py-6">
          {hasIndicators
            ? "Click \"Analyze Zones\" for commentary on detected supply/demand zones and key levels"
            : "Price data loading — zone analysis will be available once chart data loads"
          }
        </p>
      ) : isLoading ? (
        <div className="space-y-3">
          <div className="h-4 w-1/4 shimmer rounded" />
          <div className="h-16 shimmer rounded-lg" />
          <div className="h-3 w-3/4 shimmer rounded" />
        </div>
      ) : zoneResult ? (
        <div className="space-y-4">
          {/* Directional Bias + Conviction header */}
          {zoneResult.directionalBias && (
            <div className="flex items-center gap-2">
              {zoneResult.directionalBias === "bullish" ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : zoneResult.directionalBias === "bearish" ? (
                <TrendingDown className="h-4 w-4 text-red-500" />
              ) : (
                <Layers className="h-4 w-4 text-yellow-500" />
              )}
              <span className={cn(
                "text-[13px] font-bold uppercase tracking-wide",
                zoneResult.directionalBias === "bullish" ? "text-green-500" : zoneResult.directionalBias === "bearish" ? "text-red-500" : "text-yellow-500"
              )}>
                {zoneResult.directionalBias} Bias
              </span>
              {zoneResult.conviction && (
                <span className={cn(
                  "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                  zoneResult.conviction === "high" ? "bg-green-500/15 text-green-500" :
                  zoneResult.conviction === "medium" ? "bg-yellow-500/15 text-yellow-500" :
                  "bg-muted-foreground/15 text-muted-foreground/60"
                )}>
                  {zoneResult.conviction} conviction
                </span>
              )}
            </div>
          )}

          {/* Market Context */}
          {zoneResult.marketContext && (
            <div>
              <span className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-wider">Market Context</span>
              <p className="text-[13px] text-foreground/80 leading-relaxed mt-1">
                {zoneResult.marketContext}
              </p>
            </div>
          )}

          {/* Bull / Bear Case */}
          {(zoneResult.bullCase || zoneResult.bearCase) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {zoneResult.bullCase && (
                <div className="rounded-lg bg-green-500/5 border border-green-500/10 p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    <span className="text-[11px] font-bold text-green-500 uppercase tracking-wider">Bull Case</span>
                  </div>
                  <p className="text-[12px] text-foreground/70 leading-relaxed">{zoneResult.bullCase}</p>
                </div>
              )}
              {zoneResult.bearCase && (
                <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <TrendingDown className="h-3 w-3 text-red-500" />
                    <span className="text-[11px] font-bold text-red-500 uppercase tracking-wider">Bear Case</span>
                  </div>
                  <p className="text-[12px] text-foreground/70 leading-relaxed">{zoneResult.bearCase}</p>
                </div>
              )}
            </div>
          )}

          {/* Actionable Take */}
          {zoneResult.actionableTake && (
            <div className="border-l-2 border-neutral-accent/40 pl-3">
              <span className="text-[11px] font-bold text-neutral-accent uppercase tracking-wider">Bottom Line</span>
              <p className="text-[13px] text-foreground/85 leading-relaxed mt-1 font-medium">
                {zoneResult.actionableTake}
              </p>
            </div>
          )}

          {/* Risk/Reward Assessment */}
          {zoneResult.riskRewardAssessment && (
            <div>
              <span className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-wider">Risk / Reward</span>
              <p className="text-[13px] text-foreground/70 leading-relaxed mt-1">
                {zoneResult.riskRewardAssessment}
              </p>
            </div>
          )}

          {/* Price Structure + Zone Analysis */}
          {(zoneResult.summary || zoneResult.zoneAnalysis) && (
            <div>
              <span className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-wider">Price Structure</span>
              {zoneResult.summary && (
                <p className="text-[13px] text-muted-foreground leading-snug mt-1">
                  {zoneResult.summary}
                </p>
              )}
              {zoneResult.zoneAnalysis && (
                <p className="text-[13px] text-foreground/70 leading-snug mt-1">
                  {zoneResult.zoneAnalysis}
                </p>
              )}
            </div>
          )}

          {/* Significant Zones */}
          {zoneResult.significantZones.length > 0 && (
            <div>
              <span className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-wider">Key Zones</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {zoneResult.significantZones.map((zone, i) => (
                  <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-muted-foreground/60">
                    {zone}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Key Levels to Watch */}
          {zoneResult.keyLevelsToWatch.length > 0 && (
            <div className="flex items-start gap-2">
              <Target className="h-3.5 w-3.5 text-muted-foreground/40 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-wider">Levels to Watch</span>
                {zoneResult.keyLevelsToWatch.map((level, i) => (
                  <p key={i} className="text-[12px] text-muted-foreground/60">{level}</p>
                ))}
              </div>
            </div>
          )}

          {/* Catalysts */}
          {zoneResult.catalysts && zoneResult.catalysts.length > 0 && (
            <div>
              <span className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-wider">Catalysts</span>
              <div className="space-y-1 mt-1">
                {zoneResult.catalysts.map((c, i) => (
                  <p key={i} className="text-[12px] text-muted-foreground/60 flex items-start gap-1.5">
                    <span className="text-neutral-accent mt-0.5">•</span> {c}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-6 space-y-3">
          <p className="text-xs text-muted-foreground/50">
            {!hasIndicators ? "Waiting for price data..." : "Analysis unavailable"}
          </p>
          {hasIndicators && (
            <button
              onClick={retry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-neutral-accent/15 text-neutral-accent hover:bg-neutral-accent/25 transition-colors mx-auto"
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

      {/* Zone Analysis — analysis only, no trade ideas */}
      <AIZoneAnalysis deepAnalysis={deepAnalysis} indicators={indicators} biasResult={biasResult} />
    </div>
  );
}
