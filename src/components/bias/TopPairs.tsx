"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { useMarketStore } from "@/lib/store/market-store";
import { getBiasColor, getBiasLabel } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, ArrowRight, Shield, Zap, AlertTriangle, Activity, Brain, BarChart3 } from "lucide-react";
import { SessionBadge } from "@/components/common/SessionIndicator";
import type { BiasDirection, BiasResult, RiskSizing } from "@/lib/types/bias";
import { GlowingEffect } from "@/components/ui/glowing-effect";

function DirectionBadge({ direction }: { direction: BiasDirection }) {
  const label = getBiasLabel(direction);
  const isBullish = direction.includes("bullish");
  const isBearish = direction.includes("bearish");

  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider leading-none",
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
    <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider leading-none", config.cls, className)}>
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

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
} as const;
const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

function RiskLabel({ risk }: { risk: string }) {
  const cfg = {
    low: { cls: "bg-bullish/15 text-bullish", label: "Low Risk" },
    medium: { cls: "bg-amber-500/15 text-amber-500", label: "Medium Risk" },
    high: { cls: "bg-bearish/15 text-bearish", label: "High Risk" },
  }[risk] || { cls: "bg-[var(--surface-2)] text-muted-foreground", label: risk };

  return (
    <span className={cn("text-[11px] font-bold uppercase px-1.5 py-0.5 rounded", cfg.cls)}>
      {cfg.label}
    </span>
  );
}

function CardDetailModal({ item, onClose, onNavigate }: {
  item: RankedItem;
  onClose: () => void;
  onNavigate: () => void;
}) {
  const { biasResult, instrument } = item;
  const dec = instrument.decimalPlaces;
  const color = getBiasColor(biasResult.direction);
  const isBullish = biasResult.overallBias > 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-lg bg-[var(--surface-1)] border-border p-0 overflow-hidden"
        showCloseButton={true}
      >
        <DialogTitle className="sr-only">{instrument.symbol} Details</DialogTitle>
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="p-5 space-y-4 max-h-[80vh] overflow-y-auto"
        >
          {/* Header */}
          <motion.div variants={fadeUp} className="flex items-center gap-3">
            <div
              className="w-1 h-10 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold">{instrument.symbol}</span>
                <DirectionBadge direction={biasResult.direction} />
              </div>
              <span className="text-[12px] text-muted-foreground/50">{instrument.category}</span>
            </div>
            <div className="text-right">
              <span className="text-3xl font-mono font-bold tabular" style={{ color }}>
                {isBullish ? "+" : ""}{Math.round(biasResult.overallBias)}
              </span>
            </div>
          </motion.div>

          {/* Score breakdown */}
          <motion.div variants={fadeUp} className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--surface-2)]">
              <BarChart3 className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-[12px] font-mono text-muted-foreground">F:{Math.round(biasResult.fundamentalScore.total)}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--surface-2)]">
              <Activity className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-[12px] font-mono text-muted-foreground">T:{Math.round(biasResult.technicalScore.total)}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground/40">
                Conf: {Math.round(biasResult.confidence)}%
              </span>
              {biasResult.signalAgreement !== undefined && (
                <span className="text-[11px] text-muted-foreground/40">
                  Agree: {Math.round(biasResult.signalAgreement * 100)}%
                </span>
              )}
            </div>
          </motion.div>

          {/* AI Summary */}
          {item.llmSummary && (
            <motion.div variants={fadeUp} className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5 text-neutral-accent" />
                <span className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">AI Analysis</span>
                {item.llmRisk && <RiskLabel risk={item.llmRisk} />}
              </div>
              <p className="text-[13px] text-muted-foreground/70 leading-relaxed">
                {item.llmSummary}
              </p>
            </motion.div>
          )}

          {/* Catalysts */}
          {item.llmCatalysts && item.llmCatalysts.length > 0 && (
            <motion.div variants={fadeUp} className="space-y-1.5">
              <span className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">Catalysts</span>
              <div className="flex flex-wrap gap-1.5">
                {item.llmCatalysts.map((c, i) => (
                  <span key={i} className="text-[12px] px-2 py-1 rounded bg-[var(--surface-2)] text-muted-foreground/60">
                    {c}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Key Levels */}
          {item.llmKeyLevels && item.llmKeyLevels.support > 0 && (
            <motion.div variants={fadeUp} className="flex items-center gap-4 text-[12px] font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-bullish/60">S</span>
                <span className="text-foreground/70">{formatPriceValue(item.llmKeyLevels.support, dec)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-bearish/60">R</span>
                <span className="text-foreground/70">{formatPriceValue(item.llmKeyLevels.resistance, dec)}</span>
              </div>
            </motion.div>
          )}

          {/* Navigation button */}
          <motion.div variants={fadeUp}>
            <button
              onClick={onNavigate}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-neutral-accent/10 text-neutral-accent text-xs font-semibold hover:bg-neutral-accent/20 transition-colors"
            >
              Open Full Analysis
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

function ConvictionCard({ item, rank, onNavigate }: {
  item: RankedItem;
  rank: number;
  onNavigate: () => void;
}) {
  const { biasResult, instrument } = item;
  const color = getBiasColor(biasResult.direction);
  const isBullish = biasResult.overallBias > 0;
  const isTopPick = rank === 1;
  const adr = biasResult.adr;

  return (
    <button
      onClick={onNavigate}
      className={cn(
        "relative flex flex-col p-3 rounded-lg transition-all cursor-pointer text-left w-full min-h-[140px]",
        "bg-[var(--surface-1)] border border-border hover:border-border-bright group",
        isTopPick && "ring-1 ring-[var(--border-bright)]"
      )}
      style={{ borderLeftWidth: "3px", borderLeftColor: color }}
    >
      {/* Top: Rank + Symbol + Direction */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[12px] text-muted-foreground/40 font-mono">{rank}</span>
        <span className={cn("font-bold truncate", isTopPick ? "text-sm" : "text-xs")}>
          {instrument.symbol}
        </span>
        <DirectionBadge direction={biasResult.direction} />
      </div>

      {/* Center: Large conviction score */}
      <div className="flex items-center justify-center my-1">
        <span
          className={cn("font-mono font-bold tabular", isTopPick ? "text-2xl" : "text-xl")}
          style={{ color }}
        >
          {isBullish ? "+" : ""}{Math.round(biasResult.overallBias)}
        </span>
      </div>

      {/* Score pills */}
      <div className="flex items-center gap-1 justify-center my-1.5 flex-wrap">
        <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-[var(--surface-2)] text-muted-foreground">
          F:{Math.round(biasResult.fundamentalScore.total)}
        </span>
        <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-[var(--surface-2)] text-muted-foreground">
          T:{Math.round(biasResult.technicalScore.total)}
        </span>
      </div>

      {/* Bottom: ADR + Session + Risk */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground/60 mt-auto pt-1.5 border-t border-border/30">
        <div className="flex items-center gap-1.5">
          {adr && <span className="font-mono">{adr.pips}p</span>}
          {biasResult.tradeSetup && (
            <span className="font-mono flex items-center gap-0.5" style={{ color }}>
              {isBullish ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {biasResult.tradeSetup.projectedMove.pips}p
            </span>
          )}
          <SessionBadge instrumentId={instrument.id} />
        </div>
        {biasResult.tradeSetup && (
          <RiskBadge sizing={biasResult.tradeSetup.riskSizing} />
        )}
      </div>

      {/* Navigate indicator */}
      <ArrowRight className="absolute top-2 right-2 h-3 w-3 text-muted-foreground/20 group-hover:text-muted-foreground/60 transition-colors" />
    </button>
  );
}

export function TopPairs() {
  const [expanded, setExpanded] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RankedItem | null>(null);
  const allBiasResults = useMarketStore((s) => s.allBiasResults);
  const biasTimeframe = "intraday" as const;
  const batchLLMResults = useMarketStore((s) => s.batchLLMResults);
  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument);
  const router = useRouter();

  const currentResults = allBiasResults[biasTimeframe];

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
    <div className="relative section-card p-5">
      <GlowingEffect
        spread={40}
        glow={true}
        disabled={false}
        proximity={64}
        inactiveZone={0.01}
        borderWidth={2}
      />
      <div className="flex items-center justify-between mb-4">
        <span className="text-[12px] font-mono text-muted-foreground/40">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </span>
      </div>

      {!hasAnyBias ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-36 shimmer rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* Card grid — full width, single timeframe */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {displayed.map((item, idx) => (
              <ConvictionCard
                key={item.instrument.id}
                item={item}
                rank={idx + 1}
                onNavigate={() => setSelectedItem(item)}
              />
            ))}
          </div>
        </>
      )}

      {hasAnyBias && ranked.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors mt-3"
        >
          {expanded ? (
            <>Show top 5 <ChevronUp className="h-3 w-3" /></>
          ) : (
            <>Show all {ranked.length} <ChevronDown className="h-3 w-3" /></>
          )}
        </button>
      )}

      {/* Card Detail Modal */}
      {selectedItem && (
        <CardDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onNavigate={() => {
            setSelectedInstrument(selectedItem.instrument);
            setSelectedItem(null);
            router.push("/instrument");
          }}
        />
      )}
    </div>
  );
}
