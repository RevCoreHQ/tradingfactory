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
        "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider leading-none",
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
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider leading-none", config.cls, className)}>
      <Icon className="h-2.5 w-2.5" />
      {config.label}
    </span>
  );
}

function formatPriceValue(price: number, decimals: number): string {
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
    <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-[var(--surface-2)] rounded px-2 py-1.5">
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Entry Zone</div>
          <div className="text-[11px] font-mono text-foreground">
            {formatPriceValue(setup.entryZone[0], dec)} – {formatPriceValue(setup.entryZone[1], dec)}
          </div>
        </div>
        <div className="bg-[var(--surface-2)] rounded px-2 py-1.5">
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Stop Loss</div>
          <div className="text-[11px] font-mono text-bearish">
            {formatPriceValue(setup.stopLoss, dec)}
          </div>
        </div>
        <div className="bg-[var(--surface-2)] rounded px-2 py-1.5">
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">Projected Move</div>
          <div className="text-[11px] font-mono" style={{ color: getBiasColor(biasResult.direction) }}>
            {isBullish ? "+" : "-"}{setup.projectedMove.pips}p ({setup.projectedMove.percent}%)
          </div>
        </div>
        <div className="bg-[var(--surface-2)] rounded px-2 py-1.5">
          <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-0.5">Position Size</div>
          <RiskBadge sizing={setup.riskSizing} />
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {setup.takeProfit.map((tp, i) => (
          <div key={i} className="flex items-center gap-1 bg-[var(--surface-2)] rounded px-2 py-1">
            <span className="text-[9px] font-bold text-bullish/70">TP{i + 1}</span>
            <span className="text-[10px] font-mono text-foreground/80">{formatPriceValue(tp, dec)}</span>
            <span className="text-[9px] font-mono text-muted-foreground/50">({setup.riskReward[i]}R)</span>
          </div>
        ))}
      </div>

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

      {item.llmKeyLevels && item.llmKeyLevels.support > 0 && (
        <div className="flex items-center justify-between text-[9px] text-muted-foreground/40">
          <span className="font-mono">
            S: {formatPriceValue(item.llmKeyLevels.support, dec)} | R: {formatPriceValue(item.llmKeyLevels.resistance, dec)}
          </span>
          <span className="truncate max-w-[300px]">{setup.riskReason}</span>
        </div>
      )}
    </div>
  );
}

function ConvictionCard({ item, rank, isExpanded, onToggle, onNavigate }: {
  item: RankedItem;
  rank: number;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const { biasResult, instrument } = item;
  const color = getBiasColor(biasResult.direction);
  const isBullish = biasResult.overallBias > 0;
  const isTopPick = rank === 1;
  const adr = biasResult.adr;
  const hasSetup = !!biasResult.tradeSetup;

  return (
    <button
      onClick={hasSetup ? onToggle : onNavigate}
      className={cn(
        "relative flex flex-col p-3 rounded-lg transition-all cursor-pointer text-left w-full",
        "bg-[var(--surface-1)] border border-border hover:border-border-bright",
        isTopPick && "ring-1 ring-[var(--border-bright)]",
        isExpanded && "border-border-bright"
      )}
      style={{ borderLeftWidth: "3px", borderLeftColor: color }}
    >
      {/* Top: Rank + Symbol + Direction */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-muted-foreground/40 font-mono">{rank}</span>
        <span className={cn("font-bold", isTopPick ? "text-sm" : "text-xs")}>
          {instrument.symbol}
        </span>
        <DirectionBadge direction={biasResult.direction} />
      </div>

      {/* Center: Large conviction score */}
      <div className="flex items-center justify-center my-1">
        <span
          className={cn("font-mono font-bold tabular", isTopPick ? "text-3xl" : "text-2xl")}
          style={{ color }}
        >
          {isBullish ? "+" : ""}{Math.round(biasResult.overallBias)}
        </span>
      </div>

      {/* Score pills */}
      <div className="flex items-center gap-1 justify-center my-2">
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-muted-foreground">
          F:{Math.round(biasResult.fundamentalScore.total)}
        </span>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-muted-foreground">
          T:{Math.round(biasResult.technicalScore.total)}
        </span>
        {biasResult.aiBias !== 0 && (
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-accent/10 text-neutral-accent">
            AI:{biasResult.aiBias > 0 ? "+" : ""}{Math.round(biasResult.aiBias)}
          </span>
        )}
      </div>

      {/* Bottom: ADR + Risk + Projected */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 mt-auto pt-1 border-t border-border/30">
        <div className="flex items-center gap-2">
          {adr && <span className="font-mono">{adr.pips}p ADR</span>}
          {biasResult.tradeSetup && (
            <span className="font-mono flex items-center gap-0.5" style={{ color }}>
              {isBullish ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {biasResult.tradeSetup.projectedMove.pips}p
            </span>
          )}
        </div>
        {biasResult.tradeSetup && (
          <RiskBadge sizing={biasResult.tradeSetup.riskSizing} />
        )}
      </div>

      {/* Expand indicator */}
      {hasSetup && (
        <ChevronDown className={cn(
          "absolute top-2 right-2 h-3 w-3 text-muted-foreground/20 transition-transform",
          isExpanded && "rotate-180"
        )} />
      )}
    </button>
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
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const allBiasResults = useMarketStore((s) => s.allBiasResults);
  const batchLLMResults = useMarketStore((s) => s.batchLLMResults);
  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument);
  const router = useRouter();

  const currentResults = allBiasResults[timeframeKey];

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

  const expandedItem = displayed.find((item) => item.instrument.id === expandedCard);

  return (
    <div className="flex-1 min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-3">
        {label}
      </div>

      {!hasAnyBias ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-36 shimmer rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* Card grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {displayed.map((item, idx) => (
              <ConvictionCard
                key={item.instrument.id}
                item={item}
                rank={idx + 1}
                isExpanded={expandedCard === item.instrument.id}
                onToggle={() => setExpandedCard(
                  expandedCard === item.instrument.id ? null : item.instrument.id
                )}
                onNavigate={() => {
                  setSelectedInstrument(item.instrument);
                  router.push("/instrument");
                }}
              />
            ))}
          </div>

          {/* Expanded trade setup panel below grid */}
          {expandedItem && expandedItem.biasResult.tradeSetup && (
            <div className="mt-3 bg-[var(--surface-1)] border border-border-bright rounded-lg p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{expandedItem.instrument.symbol}</span>
                  <DirectionBadge direction={expandedItem.biasResult.direction} />
                </div>
                <button
                  onClick={() => {
                    setSelectedInstrument(expandedItem.instrument);
                    router.push("/instrument");
                  }}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  Full analysis <ArrowRight className="h-2.5 w-2.5" />
                </button>
              </div>
              <TradeSetupExpanded item={expandedItem} />
            </div>
          )}
        </>
      )}

      {hasAnyBias && ranked.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-3"
        >
          {expanded ? (
            <>Show top 5 <ChevronUp className="h-3 w-3" /></>
          ) : (
            <>Show all {ranked.length} <ChevronDown className="h-3 w-3" /></>
          )}
        </button>
      )}
    </div>
  );
}

export function TopPairs() {
  return (
    <div className="relative section-card p-5">
      <GlowingEffect
        spread={40}
        glow={true}
        disabled={false}
        proximity={64}
        inactiveZone={0.01}
        borderWidth={2}
      />
      <div className="flex items-center justify-between mb-5">
        <span className="text-[10px] font-mono text-muted-foreground/40">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </span>
      </div>

      <div className="flex flex-col lg:flex-row lg:gap-8 gap-6">
        <ConvictionList timeframeKey="intraday" label="Intraday" />
        <div className="hidden lg:block w-px bg-border/50 self-stretch" />
        <ConvictionList timeframeKey="intraweek" label="Intraweek" />
      </div>
    </div>
  );
}
