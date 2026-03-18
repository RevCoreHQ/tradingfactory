"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { useMarketStore } from "@/lib/store/market-store";
import { getBiasColor, getBiasLabel } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, ArrowRight, Shield, Zap, AlertTriangle } from "lucide-react";
import type { BiasDirection, BiasResult, RiskSizing } from "@/lib/types/bias";
import { GlowingEffect } from "@/components/ui/glowing-effect";

function DirectionBadge({ direction }: { direction: BiasDirection }) {
  const label = getBiasLabel(direction);
  const isBullish = direction.includes("bullish");
  const isBearish = direction.includes("bearish");

  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider leading-none",
        isBullish && "bg-bullish/15 text-bullish",
        isBearish && "bg-bearish/15 text-bearish",
        !isBullish && !isBearish && "bg-neutral-accent/15 text-neutral-accent"
      )}
    >
      {label}
    </span>
  );
}

function RiskBadge({ sizing, className }: { sizing: RiskSizing; className?: string }) {
  const config = {
    size_up: { label: "SIZE UP", icon: Zap, cls: "bg-bullish/15 text-bullish" },
    normal: { label: "NORMAL", icon: Shield, cls: "bg-neutral-accent/15 text-neutral-accent" },
    size_down: { label: "SIZE DOWN", icon: AlertTriangle, cls: "bg-amber/15 text-[var(--amber)]" },
  }[sizing];
  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider leading-none", config.cls, className)}>
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </span>
  );
}

function formatPrice(price: number, decimals: number): string {
  return price.toFixed(decimals);
}

interface RankedItem {
  instrument: typeof INSTRUMENTS[number];
  biasResult: BiasResult;
  tradeScore: number;
  llmSummary: string | null;
  llmCatalysts: string[] | undefined;
  llmKeyLevels: { support: number; resistance: number } | undefined;
  llmRisk: "low" | "medium" | "high" | undefined;
}

function TradeSetupExpanded({ item }: { item: RankedItem }) {
  const { biasResult, instrument } = item;
  const setup = biasResult.tradeSetup;
  if (!setup) return null;

  const dec = instrument.decimalPlaces;
  const isBullish = biasResult.direction.includes("bullish");

  return (
    <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
      {/* Trade Setup Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Entry Zone */}
        <div className="bg-[var(--surface-2)] rounded px-2 py-1.5">
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Entry Zone</div>
          <div className="text-[11px] font-mono text-foreground">
            {formatPrice(setup.entryZone[0], dec)} – {formatPrice(setup.entryZone[1], dec)}
          </div>
        </div>
        {/* Stop Loss */}
        <div className="bg-[var(--surface-2)] rounded px-2 py-1.5">
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Stop Loss</div>
          <div className="text-[11px] font-mono text-bearish">
            {formatPrice(setup.stopLoss, dec)}
          </div>
        </div>
        {/* Projected Move */}
        <div className="bg-[var(--surface-2)] rounded px-2 py-1.5">
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Projected Move</div>
          <div className="text-[11px] font-mono" style={{ color: getBiasColor(biasResult.direction) }}>
            {isBullish ? "+" : "-"}{setup.projectedMove.pips}p ({setup.projectedMove.percent}%)
          </div>
        </div>
        {/* Risk Sizing */}
        <div className="bg-[var(--surface-2)] rounded px-2 py-1.5">
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Position Size</div>
          <RiskBadge sizing={setup.riskSizing} />
        </div>
      </div>

      {/* TP Levels */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {setup.takeProfit.map((tp, i) => (
          <div key={i} className="flex items-center gap-1 bg-[var(--surface-2)] rounded px-2 py-1">
            <span className="text-[9px] font-bold text-bullish/70">TP{i + 1}</span>
            <span className="text-[10px] font-mono text-foreground/80">{formatPrice(tp, dec)}</span>
            <span className="text-[9px] font-mono text-muted-foreground/50">({setup.riskReward[i]}R)</span>
          </div>
        ))}
      </div>

      {/* AI Analysis + Catalysts */}
      <div className="flex flex-col sm:flex-row gap-2">
        {item.llmSummary && (
          <div className="flex-1 text-[10px] text-muted-foreground/70 leading-snug">
            <span className="text-[9px] font-bold text-neutral-accent mr-1">AI:</span>
            {item.llmSummary}
          </div>
        )}
        {item.llmCatalysts && item.llmCatalysts.length > 0 && (
          <div className="flex-shrink-0 space-y-0.5">
            <div className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider">Catalysts</div>
            {item.llmCatalysts.map((c, i) => (
              <div key={i} className="text-[10px] text-muted-foreground/60 truncate max-w-[200px]">
                {c}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Key Levels + Risk Reason */}
      <div className="flex items-center justify-between text-[9px] text-muted-foreground/40">
        {item.llmKeyLevels && item.llmKeyLevels.support > 0 && (
          <span className="font-mono">
            S: {formatPrice(item.llmKeyLevels.support, dec)} | R: {formatPrice(item.llmKeyLevels.resistance, dec)}
          </span>
        )}
        <span className="truncate max-w-[300px]">{setup.riskReason}</span>
      </div>
    </div>
  );
}

function ConvictionList({
  timeframeKey,
  label,
}: {
  timeframeKey: "intraday" | "intraweek";
  label: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const allBiasResults = useMarketStore((s) => s.allBiasResults);
  const batchLLMResults = useMarketStore((s) => s.batchLLMResults);
  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument);
  const router = useRouter();

  const currentResults = allBiasResults[timeframeKey];

  // Rank by tradeScore (ADR-weighted conviction) instead of raw bias
  const ranked: RankedItem[] = INSTRUMENTS
    .map((inst) => {
      const bias = currentResults[inst.id];
      const llm = batchLLMResults?.[inst.id];
      if (!bias) return null;

      const tradeScore = bias.tradeSetup?.tradeScore || Math.abs(bias.overallBias);

      return {
        instrument: inst,
        biasResult: bias,
        tradeScore,
        llmSummary: llm?.summary || null,
        llmCatalysts: llm?.catalysts,
        llmKeyLevels: llm?.keyLevels,
        llmRisk: llm?.riskAssessment,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.tradeScore - a!.tradeScore) as RankedItem[];

  const hasAnyBias = ranked.some((r) => Math.abs(r.biasResult.overallBias) > 2);
  const displayCount = expanded ? ranked.length : 5;
  const displayed = ranked.slice(0, displayCount);

  return (
    <div className="flex-1 min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-3">
        {label}
      </div>

      {!hasAnyBias ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          Calculating bias scores...
        </p>
      ) : (
        <div className="space-y-0.5">
          {displayed.map((item, idx) => {
            const { biasResult, instrument } = item;
            const color = getBiasColor(biasResult.direction);
            const isBullish = biasResult.overallBias > 0;
            const isTopPick = idx === 0;
            const isExpanded = expandedRow === instrument.id || (isTopPick && expandedRow === null);
            const hasSetup = !!biasResult.tradeSetup;
            const adr = biasResult.adr;

            return (
              <div key={instrument.id}>
                <button
                  onClick={() => {
                    if (hasSetup) {
                      setExpandedRow(isExpanded && !isTopPick ? null : isExpanded ? "__none__" : instrument.id);
                    } else {
                      setSelectedInstrument(instrument);
                      router.push("/instrument");
                    }
                  }}
                  className={cn(
                    "flex flex-col w-full text-left px-3 py-2.5 rounded-lg transition-colors cursor-pointer group",
                    isTopPick ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]",
                    isExpanded && !isTopPick && "bg-[var(--surface-2)]"
                  )}
                  style={isTopPick ? { borderLeft: `3px solid ${color}` } : undefined}
                >
                  {/* Main row */}
                  <div className="flex items-center gap-2 w-full">
                    {/* Rank */}
                    <span className="text-[11px] text-muted-foreground/40 w-4 font-mono tabular">
                      {idx + 1}
                    </span>

                    {/* Symbol */}
                    <span className={cn(
                      "font-bold shrink-0 w-[72px]",
                      isTopPick ? "text-sm" : "text-xs"
                    )}>
                      {instrument.symbol}
                    </span>

                    {/* Direction badge */}
                    <DirectionBadge direction={biasResult.direction} />

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* F / T / AI mini scores */}
                    <span className="text-[10px] font-mono text-muted-foreground hidden sm:flex items-center gap-1.5">
                      <span>F:{Math.round(biasResult.fundamentalScore.total)}</span>
                      <span>T:{Math.round(biasResult.technicalScore.total)}</span>
                      {biasResult.aiBias !== 0 && (
                        <span className="text-neutral-accent">AI:{biasResult.aiBias > 0 ? "+" : ""}{Math.round(biasResult.aiBias)}</span>
                      )}
                    </span>

                    {/* ADR */}
                    {adr && (
                      <span className="text-[10px] font-mono text-muted-foreground/50 hidden md:block w-14 text-right">
                        {adr.pips}p
                      </span>
                    )}

                    {/* Projected move */}
                    {biasResult.tradeSetup && (
                      <span
                        className="text-[10px] font-mono hidden lg:flex items-center gap-0.5 w-14 justify-end"
                        style={{ color }}
                      >
                        {isBullish ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {biasResult.tradeSetup.projectedMove.pips}p
                      </span>
                    )}

                    {/* Risk sizing badge */}
                    {biasResult.tradeSetup && (
                      <span className="hidden xl:block">
                        <RiskBadge sizing={biasResult.tradeSetup.riskSizing} />
                      </span>
                    )}

                    {/* Conviction score */}
                    <span
                      className={cn(
                        "font-mono font-bold tabular text-right w-12",
                        isTopPick ? "text-xl" : "text-sm"
                      )}
                      style={{ color }}
                    >
                      {isBullish ? "+" : ""}{Math.round(biasResult.overallBias)}
                    </span>

                    {/* Expand indicator */}
                    {hasSetup && (
                      <ChevronDown className={cn(
                        "h-3 w-3 text-muted-foreground/30 transition-transform",
                        isExpanded && "rotate-180"
                      )} />
                    )}
                  </div>

                  {/* Expanded trade setup */}
                  {isExpanded && hasSetup && (
                    <TradeSetupExpanded item={item} />
                  )}
                </button>

                {/* Navigate link for expanded rows */}
                {isExpanded && hasSetup && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedInstrument(instrument);
                      router.push("/instrument");
                    }}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground/40 hover:text-foreground transition-colors px-3 pb-1 ml-7"
                  >
                    Full analysis <ArrowRight className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasAnyBias && ranked.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-2 px-3"
        >
          {expanded ? (
            <>
              Show top 5 <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              Show all {ranked.length} <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

export function TopPairs() {
  return (
    <div className="relative panel rounded-lg p-4">
      <GlowingEffect
        spread={40}
        glow={true}
        disabled={false}
        proximity={64}
        inactiveZone={0.01}
        borderWidth={2}
      />
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Conviction Board
          </h3>
          <span className="text-[9px] font-mono text-muted-foreground/30 hidden sm:block">
            Ranked by ADR-weighted conviction
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
        </span>
      </div>

      {/* Side-by-side on desktop, stacked on mobile */}
      <div className="flex flex-col lg:flex-row lg:gap-6 gap-6">
        <ConvictionList timeframeKey="intraday" label="Intraday" />
        <div className="hidden lg:block w-px bg-border self-stretch" />
        <ConvictionList timeframeKey="intraweek" label="Intraweek" />
      </div>
    </div>
  );
}
