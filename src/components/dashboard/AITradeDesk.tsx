"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTradeDeskData } from "@/lib/hooks/useTradeDeskData";
import { useTrackedSetups } from "@/lib/hooks/useTrackedSetups";
import { useMarketStore } from "@/lib/store/market-store";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { getStatusLabel, isActionable, isRunning as isRunningStatus } from "@/lib/calculations/setup-tracker";
import { getScaleInSize } from "@/lib/calculations/scale-in-detector";
import { computePortfolioRisk } from "@/lib/calculations/risk-engine";
import { cn } from "@/lib/utils";
import { AnalysisLoader } from "@/components/ui/analysis-loader";
import type {
  TradeDeskSetup,
  TrackedSetup,
  ConvictionTier,
  ImpulseColor,
  MarketRegime,
  SetupStatus,
  ConfluencePattern,
  ScaleInOpportunity,
} from "@/lib/types/signals";
import type { TimeframeTrend, MTFTrendSummary } from "@/lib/types/mtf";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Target,
  Minus,
  Check,
  Copy,
  History,
  Brain,
  RefreshCw,
  X,
  Zap,
  Clock,
  Layers,
  Star,
} from "lucide-react";
import { GlowingEffect } from "@/components/ui/glowing-effect";

// ==================== Copy Price ====================

function CopyPrice({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1 font-mono cursor-pointer rounded px-1 -mx-1 transition-colors hover:bg-foreground/5 active:bg-foreground/10 group",
        className
      )}
      title={`Copy ${value}`}
    >
      {value}
      {copied ? (
        <Check className="h-2.5 w-2.5 text-bullish shrink-0" />
      ) : (
        <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-40 shrink-0 transition-opacity" />
      )}
    </button>
  );
}

// ==================== Status Badge ====================

function StatusBadge({ status }: { status: SetupStatus }) {
  const config: Record<SetupStatus, { cls: string }> = {
    pending: { cls: "bg-muted/20 text-muted-foreground" },
    active: { cls: "bg-neutral-accent/15 text-neutral-accent" },
    breakeven: { cls: "bg-amber/15 text-[var(--amber)]" },
    tp1_hit: { cls: "bg-bullish/15 text-bullish" },
    tp2_hit: { cls: "bg-bullish/20 text-bullish" },
    tp3_hit: { cls: "bg-bullish/25 text-bullish ring-1 ring-bullish/30" },
    sl_hit: { cls: "bg-bearish/15 text-bearish" },
    expired: { cls: "bg-muted/15 text-muted-foreground/60" },
    invalidated: { cls: "bg-muted/15 text-muted-foreground/60" },
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
        config[status].cls
      )}
    >
      {getStatusLabel(status)}
    </span>
  );
}

// ==================== Sub-components ====================

function RegimeBadge({ regime, adx }: { regime: MarketRegime; adx: number }) {
  const config: Record<MarketRegime, { label: string; cls: string; icon: typeof Activity }> = {
    trending_up: { label: "Trending Up", cls: "bg-bullish/15 text-bullish", icon: TrendingUp },
    trending_down: { label: "Trending Down", cls: "bg-bearish/15 text-bearish", icon: TrendingDown },
    ranging: { label: "Ranging", cls: "bg-neutral-accent/15 text-neutral-accent", icon: Activity },
    volatile: { label: "Volatile", cls: "bg-amber/15 text-[var(--amber)]", icon: AlertTriangle },
  };
  const c = config[regime];
  const Icon = c.icon;

  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider", c.cls)}>
      <Icon className="h-3 w-3" />
      {c.label}
      {adx > 0 && <span className="opacity-60 ml-0.5">ADX {adx.toFixed(0)}</span>}
    </span>
  );
}

function ImpulseBadge({ color }: { color: ImpulseColor }) {
  const config: Record<ImpulseColor, { label: string; cls: string; dot: string; tooltip: string }> = {
    green: {
      label: "GREEN",
      cls: "text-bullish",
      dot: "bg-bullish",
      tooltip: "GREEN — Buying pressure. MACD histogram rising + EMA slope up. Favorable for longs.",
    },
    red: {
      label: "RED",
      cls: "text-bearish",
      dot: "bg-bearish",
      tooltip: "RED — Selling pressure. MACD histogram falling + EMA slope down. Favorable for shorts.",
    },
    blue: {
      label: "BLUE",
      cls: "text-neutral-accent",
      dot: "bg-neutral-accent",
      tooltip: "BLUE — Mixed momentum. MACD and EMA disagree. Exercise caution — wait for clarity.",
    },
  };
  const c = config[color];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider cursor-help", c.cls)}
      title={c.tooltip}
    >
      <span className={cn("h-2 w-2 rounded-full animate-pulse", c.dot)} />
      {c.label}
    </span>
  );
}

function ConvictionBadge({ tier }: { tier: ConvictionTier }) {
  const config: Record<ConvictionTier, { cls: string }> = {
    "A+": { cls: "bg-bullish/20 text-bullish ring-1 ring-bullish/30 glow-bullish" },
    "A": { cls: "bg-bullish/15 text-bullish ring-1 ring-bullish/20" },
    "B": { cls: "bg-neutral-accent/15 text-neutral-accent" },
    "C": { cls: "bg-amber/15 text-[var(--amber)]" },
    "D": { cls: "bg-muted/20 text-muted-foreground" },
  };
  return (
    <span className={cn("inline-flex items-center justify-center h-6 min-w-[28px] px-1.5 rounded text-[10px] font-black tracking-wider", config[tier].cls)}>
      {tier}
    </span>
  );
}

function DirectionArrow({ direction }: { direction: "bullish" | "bearish" | "neutral" }) {
  if (direction === "bullish") return <TrendingUp className="h-3.5 w-3.5 text-bullish" />;
  if (direction === "bearish") return <TrendingDown className="h-3.5 w-3.5 text-bearish" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function SignalDot({ direction, match }: { direction: string; match: boolean }) {
  return (
    <span
      className={cn(
        "h-1.5 w-1.5 rounded-full",
        direction === "bullish" && "bg-bullish",
        direction === "bearish" && "bg-bearish",
        direction === "neutral" && "bg-muted-foreground/40",
        !match && "opacity-40"
      )}
    />
  );
}

function getStrategyLabel(setup: TradeDeskSetup): { name: string; source: string } {
  const agreeing = setup.signals.filter((s) => s.direction === setup.direction);
  const systems = new Set(agreeing.map((s) => s.system));

  // Elder Triple Screen: Impulse + Elder-Ray + (MACD or MA)
  const hasImpulse = systems.has("Elder Impulse");
  const hasElderRay = systems.has("Elder-Ray");
  const hasMACD = systems.has("MACD");
  const hasMA = systems.has("MA Crossover");
  const hasBBBreak = systems.has("BB Breakout");
  const hasTrendStack = systems.has("Trend Stack");
  const hasRSI = systems.has("RSI Extremes");
  const hasBBMR = systems.has("BB MR");

  if (hasImpulse && hasElderRay && (hasMACD || hasMA)) {
    return { name: "Elder Triple Screen", source: "Elder" };
  }

  // Structural Breakout: Trend Stack + BB Breakout + MA
  if (hasTrendStack && hasBBBreak && hasMA) {
    return { name: "Structural Breakout", source: "Weissman" };
  }

  // Trend Continuation: MA + MACD + Trend Stack (classic trend-following)
  if (hasMA && hasMACD && hasTrendStack) {
    return { name: "Trend Continuation", source: "Weissman" };
  }

  // Momentum Breakout: BB Breakout + Impulse + MACD
  if (hasBBBreak && hasImpulse) {
    return { name: "Momentum Breakout", source: "Weissman" };
  }

  // Mean Reversion Pullback: RSI Extremes + BB MR
  if (hasRSI && hasBBMR) {
    return { name: "MR Pullback", source: "Weissman" };
  }

  // Elder Momentum: Impulse + Elder-Ray
  if (hasImpulse && hasElderRay) {
    return { name: "Elder Momentum", source: "Elder" };
  }

  // Trend-following stack: MA + Trend Stack
  if (hasMA && hasTrendStack) {
    return { name: "Trend Follow", source: "Weissman" };
  }

  // RSI-driven mean reversion
  if (hasRSI || hasBBMR) {
    return { name: "Mean Reversion", source: "Weissman" };
  }

  // Fallback based on dominant type
  const counts: Record<string, number> = {};
  for (const s of agreeing) counts[s.type] = (counts[s.type] || 0) + 1;
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (dominant === "trend") return { name: "Trend Signal", source: "Multi" };
  if (dominant === "momentum") return { name: "Momentum Signal", source: "Elder" };
  return { name: "Confluence", source: "Multi" };
}

function StrategyBadge({ setup }: { setup: TradeDeskSetup }) {
  const { name, source } = getStrategyLabel(setup);
  return (
    <span
      className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/10 cursor-help"
      title={`Strategy: ${name} — derived from ${source}'s methodology`}
    >
      {name}
    </span>
  );
}

// ==================== Progress Bar ====================

function SetupProgress({ tracked }: { tracked: TrackedSetup }) {
  const { setup } = tracked;
  const price = setup.currentPrice;
  const entryMid = (setup.entry[0] + setup.entry[1]) / 2;
  const isBullish = setup.direction === "bullish";

  const slDist = Math.abs(entryMid - setup.stopLoss);
  const tp3Dist = Math.abs(setup.takeProfit[2] - entryMid);
  const totalRange = slDist + tp3Dist;

  if (totalRange === 0) return null;

  const priceDist = isBullish ? price - entryMid : entryMid - price;
  const clamped = Math.max(0, Math.min(100, ((priceDist + slDist) / totalRange) * 100));
  const pnlPercent = entryMid > 0 ? ((isBullish ? price - entryMid : entryMid - price) / entryMid) * 100 : 0;

  const entryPos = (slDist / totalRange) * 100;
  const tp1Pos = ((Math.abs(setup.takeProfit[0] - entryMid) + slDist) / totalRange) * 100;
  const tp2Pos = ((Math.abs(setup.takeProfit[1] - entryMid) + slDist) / totalRange) * 100;

  const milestones = [
    { pos: tp1Pos, label: "TP1", hit: tracked.highestTpHit >= 1 },
    { pos: tp2Pos, label: "TP2", hit: tracked.highestTpHit >= 2 },
  ];

  return (
    <div className="mt-2">
      {/* P&L display for running trades */}
      {isRunningStatus(tracked.status) && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">Progress</span>
          <span className={cn(
            "text-[10px] font-bold font-mono",
            pnlPercent >= 0 ? "text-bullish" : "text-bearish"
          )}>
            {pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%
          </span>
        </div>
      )}
      <div className="relative h-2 rounded-full bg-muted/20 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-bearish/20 rounded-l-full"
          style={{ width: `${entryPos}%` }}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
            clamped < entryPos ? "bg-bearish/60" : "bg-bullish/60"
          )}
          style={{ width: `${clamped}%` }}
        />
        {/* TP milestone markers */}
        {milestones.map((m) => (
          <div
            key={m.label}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
            style={{ left: `${m.pos}%` }}
          >
            <div className={cn(
              "h-2.5 w-2.5 rounded-full border-2",
              m.hit
                ? "bg-bullish border-bullish"
                : "bg-background border-bullish/40"
            )} />
          </div>
        ))}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground/30"
          style={{ left: `${entryPos}%` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-[8px] text-muted-foreground/40 font-mono">
        <span>SL</span>
        <span>Entry</span>
        <span className={tracked.highestTpHit >= 1 ? "text-bullish font-bold" : ""}>TP1</span>
        <span className={tracked.highestTpHit >= 2 ? "text-bullish font-bold" : ""}>TP2</span>
        <span>TP3</span>
      </div>
    </div>
  );
}

// ==================== Time Elapsed ====================

function formatElapsed(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

// ==================== Scale-In Banner ====================

function ScaleInBanner({
  scaleIn,
  setup,
  onDismiss,
}: {
  scaleIn: ScaleInOpportunity;
  setup: TradeDeskSetup;
  onDismiss: () => void;
}) {
  const inst = INSTRUMENTS.find((i) => i.id === setup.instrumentId);
  const decimals = inst?.decimalPlaces ?? 4;
  const scaleInLots = getScaleInSize(setup.positionSizeLots);

  return (
    <div className="mt-2 p-2.5 rounded-lg bg-neutral-accent/8 border border-neutral-accent/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-neutral-accent" />
          <span className="text-[10px] font-bold text-neutral-accent uppercase tracking-wider">
            Scale-In Window
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="p-0.5 rounded hover:bg-foreground/5 text-muted-foreground/40"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2 mt-2 text-[10px]">
        <div>
          <span className="text-muted-foreground/50">Pullback</span>
          <div className="font-mono font-semibold text-foreground">{scaleIn.pullbackPercent}%</div>
        </div>
        <div>
          <span className="text-muted-foreground/50">Entry</span>
          <div className="font-mono font-semibold text-foreground">
            {scaleIn.suggestedEntry[0].toFixed(decimals)}
          </div>
        </div>
        <div>
          <span className="text-muted-foreground/50">R:R</span>
          <div className="font-mono font-semibold text-bullish">1:{scaleIn.riskReward}</div>
        </div>
        <div>
          <span className="text-muted-foreground/50">Size</span>
          <div className="font-mono font-semibold text-foreground">{scaleInLots} lots</div>
        </div>
      </div>
    </div>
  );
}

// ==================== Setup Card ====================

// ==================== MTF Trend Bar ====================

function MTFTrendBar({ mtf }: { mtf: MTFTrendSummary }) {
  const alignmentColors: Record<string, string> = {
    full: "text-bullish",
    strong: "text-bullish/70",
    partial: "text-[var(--amber)]",
    conflicting: "text-bearish/70",
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
          Multi-Timeframe Trend
        </div>
        <span className={cn(
          "text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
          mtf.alignment === "full" && "bg-bullish/12 text-bullish",
          mtf.alignment === "strong" && "bg-bullish/8 text-bullish/70",
          mtf.alignment === "partial" && "bg-[var(--amber)]/10 text-[var(--amber)]",
          mtf.alignment === "conflicting" && "bg-bearish/10 text-bearish/70"
        )}>
          {mtf.alignment === "full" ? "Fully Aligned" :
           mtf.alignment === "strong" ? "Strong" :
           mtf.alignment === "partial" ? "Partial" : "Conflicting"}
          {mtf.convictionModifier !== 0 && (
            <span className="ml-1 opacity-70">
              ({mtf.convictionModifier > 0 ? "+" : ""}{mtf.convictionModifier})
            </span>
          )}
        </span>
        {mtf.pullbackComplete && (
          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-accent/12 text-neutral-accent flex items-center gap-1">
            <Zap className="h-2.5 w-2.5" />
            Pullback Complete
            {mtf.pullbackTimeframe && (
              <span className="opacity-60">({mtf.pullbackTimeframe.toUpperCase()})</span>
            )}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {mtf.trends.map((t, i) => (
          <div key={t.timeframe} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground/20 text-[10px]">&rarr;</span>}
            <div className={cn(
              "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold border",
              t.direction === "bullish" && "bg-bullish/8 border-bullish/20 text-bullish",
              t.direction === "bearish" && "bg-bearish/8 border-bearish/20 text-bearish",
              t.direction === "neutral" && "bg-muted/10 border-border/30 text-muted-foreground/60"
            )}>
              <span className="text-[9px] font-mono opacity-60">{t.label}</span>
              {t.direction === "bullish" ? (
                <TrendingUp className="h-2.5 w-2.5" />
              ) : t.direction === "bearish" ? (
                <TrendingDown className="h-2.5 w-2.5" />
              ) : (
                <Minus className="h-2.5 w-2.5" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SetupCard({
  tracked,
  rank,
  onDismissScaleIn,
}: {
  tracked: TrackedSetup;
  rank: number;
  onDismissScaleIn?: (setupId: string, index: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument);
  const { setup, status } = tracked;

  const inst = INSTRUMENTS.find((i) => i.id === setup.instrumentId);
  const decimals = inst?.decimalPlaces ?? 4;
  const isBullish = setup.direction === "bullish";
  const running = isRunningStatus(status);
  const activeScaleIns = (tracked.scaleIns ?? []).filter((s) => !s.dismissed);
  const elapsedMs = tracked.activatedAt ? Date.now() - tracked.activatedAt : 0;
  const allBiasResults = useMarketStore((s) => s.allBiasResults.intraday);
  const biasResult = allBiasResults[setup.instrumentId];
  const isStrongConviction = biasResult ? Math.abs(biasResult.overallBias) >= 45 : false;

  const handleNavigate = () => {
    if (inst) {
      setSelectedInstrument(inst);
      router.push("/instrument");
    }
  };

  return (
    <div className={cn(
      "relative section-card overflow-hidden",
      running && "border-l-2",
      running && isBullish && "border-l-bullish",
      running && !isBullish && "border-l-bearish"
    )}>
      <GlowingEffect
        spread={running ? 60 : setup.conviction === "A+" ? 50 : 35}
        glow={true}
        disabled={false}
        proximity={running ? 100 : setup.conviction === "A+" ? 80 : 50}
        inactiveZone={0.01}
        borderWidth={running ? 2 : setup.conviction === "A+" ? 2 : 1}
      />
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface-2/50 transition-colors text-left"
      >
        <span className="text-[10px] font-mono text-muted-foreground/50 w-4 shrink-0">
          {rank}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          <ConvictionBadge tier={setup.conviction} />
          {isStrongConviction && <Star className="h-3 w-3 fill-[#FFD700] text-[#FFD700]" />}
          <span className="text-[9px] font-mono text-muted-foreground/40">{setup.convictionScore}</span>
        </div>

        <div className="flex items-center gap-2 min-w-[110px]">
          <DirectionArrow direction={setup.direction} />
          <div>
            <span className="text-xs font-semibold text-foreground">{setup.symbol}</span>
            <span className="text-[10px] text-muted-foreground/60 ml-1.5">{setup.displayName}</span>
          </div>
        </div>

        <span
          className={cn(
            "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
            isBullish ? "bg-bullish/12 text-bullish" : "bg-bearish/12 text-bearish"
          )}
        >
          {isBullish ? "LONG" : "SHORT"}
        </span>

        <StatusBadge status={status} />

        {/* Running indicator with elapsed time */}
        {running && (
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-bullish/10 text-bullish">
            <Clock className="h-2.5 w-2.5" />
            {formatElapsed(elapsedMs)}
          </span>
        )}

        {/* Missed entry badge */}
        {tracked.missedEntry && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber/15 text-[var(--amber)]">
            Missed
          </span>
        )}

        {/* Scale-in indicator */}
        {activeScaleIns.length > 0 && (
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-accent/10 text-neutral-accent">
            <Layers className="h-2.5 w-2.5" />
            Scale-In
          </span>
        )}

        <span className={cn(
          "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border",
          setup.tradingStyle === "intraday"
            ? "text-neutral-accent/70 bg-neutral-accent/8 border-neutral-accent/20"
            : "text-muted-foreground/40 bg-muted/5 border-border/20"
        )}>
          {setup.tradingStyle === "intraday" ? "1H Intraday" : "4H Swing"}
        </span>
        <StrategyBadge setup={setup} />

        <div className="flex items-center gap-1 ml-auto">
          {setup.signals.map((s, i) => (
            <SignalDot key={i} direction={s.direction} match={s.regimeMatch} />
          ))}
        </div>

        <ImpulseBadge color={setup.impulse} />
        <RegimeBadge regime={setup.regime} adx={setup.adx} />

        {/* Compact MTF trend — always visible */}
        {setup.mtfTrend && (
          <div className="hidden lg:flex items-center gap-0.5">
            {setup.mtfTrend.trends.map((t, i) => (
              <div key={t.timeframe} className="flex items-center gap-0.5">
                {i > 0 && <span className="text-muted-foreground/15 text-[8px]">&rarr;</span>}
                <span className={cn(
                  "text-[8px] font-mono font-bold px-1 py-0.5 rounded",
                  t.direction === "bullish" && "text-bullish bg-bullish/8",
                  t.direction === "bearish" && "text-bearish bg-bearish/8",
                  t.direction === "neutral" && "text-muted-foreground/50 bg-muted/10"
                )}>
                  {t.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border/50 px-4 py-3 space-y-3">
          <SetupProgress tracked={tracked} />

          {/* Scale-in banners */}
          {activeScaleIns.map((si, idx) => {
            const realIdx = (tracked.scaleIns ?? []).indexOf(si);
            return (
              <ScaleInBanner
                key={si.detectedAt}
                scaleIn={si}
                setup={setup}
                onDismiss={() => onDismissScaleIn?.(tracked.id, realIdx)}
              />
            );
          })}

          {/* MTF Trend Alignment */}
          {setup.mtfTrend && <MTFTrendBar mtf={setup.mtfTrend} />}

          <div>
            <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1.5">
              Mechanical Systems
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5">
              {setup.signals.map((sig, i) => (
                <div
                  key={i}
                  className={cn(
                    "px-2 py-1.5 rounded-md text-[10px] border",
                    sig.direction === "bullish" && "bg-bullish/8 border-bullish/20 text-bullish",
                    sig.direction === "bearish" && "bg-bearish/8 border-bearish/20 text-bearish",
                    sig.direction === "neutral" && "bg-muted/10 border-border/30 text-muted-foreground/60"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{sig.system}</span>
                    {sig.regimeMatch && <span className="text-[8px] opacity-60">MATCH</span>}
                  </div>
                  <div className="text-[9px] opacity-70 mt-0.5 leading-tight">{sig.description}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">
                Entry Zone
              </div>
              <div className="text-xs text-foreground flex items-center gap-1">
                <CopyPrice value={setup.entry[0].toFixed(decimals)} />
                <span className="text-muted-foreground/40">–</span>
                <CopyPrice value={setup.entry[1].toFixed(decimals)} />
              </div>
            </div>
            <div>
              <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">
                Stop Loss
              </div>
              <CopyPrice value={setup.stopLoss.toFixed(decimals)} className="text-xs text-bearish" />
            </div>
            <div>
              <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">
                Take Profit
              </div>
              <div className="text-xs space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/50 text-[9px] w-5">TP1</span>
                  <CopyPrice value={setup.takeProfit[0].toFixed(decimals)} className="text-bullish" />
                  <span className="text-muted-foreground/40 font-mono text-[9px]">1:{setup.riskReward[0]}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/50 text-[9px] w-5">TP2</span>
                  <CopyPrice value={setup.takeProfit[1].toFixed(decimals)} className="text-bullish opacity-70" />
                  <span className="text-muted-foreground/40 font-mono text-[9px]">1:{setup.riskReward[1]}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/50 text-[9px] w-5">TP3</span>
                  <CopyPrice value={setup.takeProfit[2].toFixed(decimals)} className="text-bullish opacity-50" />
                  <span className="text-muted-foreground/40 font-mono text-[9px]">1:{setup.riskReward[2]}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">
                Position Sizing (2% Rule)
              </div>
              <div className="text-xs text-foreground">
                <span className="font-mono">{setup.positionSizeLots} lots</span>
                <span className="text-muted-foreground/60 ml-2">Risk: ${setup.riskAmount}</span>
              </div>
              {setup.learningApplied && (
                <div className="flex items-center gap-1 mt-1">
                  <Brain className="h-2.5 w-2.5 text-neutral-accent" />
                  <span className="text-[9px] text-neutral-accent">
                    {setup.learningApplied.riskMultiplier > 1 ? "↑" : setup.learningApplied.riskMultiplier < 1 ? "↓" : "→"}{" "}
                    {setup.learningApplied.riskMultiplier}x risk ({(setup.learningApplied.winRate * 100).toFixed(0)}% WR, {setup.learningApplied.trades} trades)
                  </span>
                </div>
              )}
            </div>
            <div>
              <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">
                Reasons to Exit
              </div>
              <div className="space-y-0.5">
                {setup.reasonsToExit.map((reason, i) => (
                  <div key={i} className="text-[10px] text-muted-foreground/70 flex items-start gap-1">
                    <span className="text-[8px] mt-0.5 text-amber shrink-0">●</span>
                    {reason}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleNavigate}
            className="text-[10px] text-neutral-accent hover:text-neutral-accent/80 font-semibold flex items-center gap-1 pt-1"
          >
            View full analysis →
          </button>
        </div>
      )}
    </div>
  );
}

// ==================== Stats Row ====================

function StatsRow({
  setups,
  portfolioRisk,
}: {
  setups: TradeDeskSetup[];
  portfolioRisk: import("@/lib/types/signals").PortfolioRisk;
}) {
  const regimeCounts: Record<MarketRegime, number> = { trending_up: 0, trending_down: 0, ranging: 0, volatile: 0 };
  const impulseCounts: Record<ImpulseColor, number> = { green: 0, red: 0, blue: 0 };

  for (const s of setups) {
    regimeCounts[s.regime]++;
    impulseCounts[s.impulse]++;
  }

  const dominantRegime = (Object.entries(regimeCounts) as [MarketRegime, number][])
    .sort((a, b) => b[1] - a[1])[0];

  const totalBullish = setups.reduce((sum, s) => sum + s.consensus.bullish, 0);
  const totalBearish = setups.reduce((sum, s) => sum + s.consensus.bearish, 0);
  const totalNeutral = setups.reduce((sum, s) => sum + s.consensus.neutral, 0);
  const totalSignals = totalBullish + totalBearish + totalNeutral;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <div className="glass-card p-3">
        <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">
          Market Regime
        </div>
        {dominantRegime && <RegimeBadge regime={dominantRegime[0]} adx={0} />}
        <div className="text-[10px] text-muted-foreground/50 mt-1">
          {regimeCounts.trending_up + regimeCounts.trending_down} trending · {regimeCounts.ranging} ranging · {regimeCounts.volatile} volatile
        </div>
      </div>

      <div className="glass-card p-3">
        <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">
          System Consensus
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-bullish font-semibold">{totalBullish}</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-bearish font-semibold">{totalBearish}</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-muted-foreground/60">{totalNeutral}</span>
        </div>
        {totalSignals > 0 && (
          <div className="flex h-1 rounded-full overflow-hidden mt-1.5 bg-muted/20">
            <div className="bg-bullish" style={{ width: `${(totalBullish / totalSignals) * 100}%` }} />
            <div className="bg-bearish" style={{ width: `${(totalBearish / totalSignals) * 100}%` }} />
          </div>
        )}
      </div>

      <div className="glass-card p-3">
        <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">
          Impulse Distribution
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-bullish" />
            <span className="text-bullish font-semibold">{impulseCounts.green}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-bearish" />
            <span className="text-bearish font-semibold">{impulseCounts.red}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-neutral-accent" />
            <span className="text-neutral-accent font-semibold">{impulseCounts.blue}</span>
          </span>
        </div>
      </div>

      <div className="glass-card p-3">
        <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">
          Risk Per Trade
        </div>
        <div className="text-xs font-bold font-mono text-foreground">
          {portfolioRisk.riskPercent}% per trade
        </div>
      </div>
    </div>
  );
}

// ==================== History Tab ====================

function HistoryTab({ history }: { history: TrackedSetup[] }) {
  if (history.length === 0) {
    return (
      <div className="section-card p-6 text-center">
        <History className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground/60">No completed trades yet. Setups will appear here after they hit SL, TP, or expire.</p>
      </div>
    );
  }

  const wins = history.filter((h) => h.outcome === "win").length;
  const losses = history.filter((h) => h.outcome === "loss").length;
  const bes = history.filter((h) => h.outcome === "breakeven").length;
  const decisions = wins + losses;
  const winRate = decisions > 0 ? (wins / decisions) * 100 : 0;
  const avgPnl = history.reduce((s, h) => s + (h.pnlPercent ?? 0), 0) / history.length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        <div className="section-card p-3">
          <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">Total</div>
          <div className="text-sm font-bold text-foreground">{history.length}</div>
        </div>
        <div className="section-card p-3">
          <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">Win Rate</div>
          <div className={cn("text-sm font-bold", winRate >= 50 ? "text-bullish" : "text-bearish")}>
            {winRate.toFixed(0)}%
          </div>
        </div>
        <div className="section-card p-3">
          <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">W / L / BE</div>
          <div className="text-xs">
            <span className="text-bullish font-semibold">{wins}</span>
            <span className="text-muted-foreground/40"> / </span>
            <span className="text-bearish font-semibold">{losses}</span>
            <span className="text-muted-foreground/40"> / </span>
            <span className="text-muted-foreground/60">{bes}</span>
          </div>
        </div>
        <div className="section-card p-3">
          <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">Avg P&L</div>
          <div className={cn("text-sm font-bold font-mono", avgPnl >= 0 ? "text-bullish" : "text-bearish")}>
            {avgPnl >= 0 ? "+" : ""}{avgPnl.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="section-card overflow-hidden">
        <div className="px-4 py-2 border-b border-border/30 grid grid-cols-8 text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
          <span>Instrument</span>
          <span>Direction</span>
          <span>Outcome</span>
          <span>P&L</span>
          <span>TP Path</span>
          <span>Duration</span>
          <span>Scale-Ins</span>
          <span>Date</span>
        </div>
        <div className="divide-y divide-border/20 max-h-[320px] overflow-y-auto">
          {history.slice(0, 50).map((h) => {
            const isBull = h.setup.direction === "bullish";
            const date = h.closedAt ? new Date(h.closedAt) : null;
            const duration = h.activatedAt && h.closedAt ? h.closedAt - h.activatedAt : 0;
            const scaleInCount = (h.scaleIns ?? []).length;

            // Build TP progression path
            const tpPath = h.highestTpHit > 0
              ? Array.from({ length: h.highestTpHit }, (_, i) => `TP${i + 1}`).join(" → ")
              : "—";

            return (
              <div
                key={h.id}
                className={cn(
                  "px-4 py-2 grid grid-cols-8 items-center text-[11px] hover:bg-surface-2/30",
                  h.outcome === "win" && "bg-bullish/[0.02]",
                  h.outcome === "loss" && "bg-bearish/[0.02]"
                )}
              >
                <span className="font-semibold text-foreground">{h.setup.symbol}</span>
                <span className={cn("font-bold uppercase text-[9px]", isBull ? "text-bullish" : "text-bearish")}>
                  {isBull ? "LONG" : "SHORT"}
                </span>
                <span
                  className={cn(
                    "font-bold uppercase text-[9px] px-1.5 py-0.5 rounded w-fit",
                    h.outcome === "win" && "bg-bullish/15 text-bullish",
                    h.outcome === "loss" && "bg-bearish/15 text-bearish",
                    h.outcome === "breakeven" && "bg-muted/20 text-muted-foreground"
                  )}
                >
                  {h.outcome ?? "—"}
                </span>
                <span className={cn("font-mono", (h.pnlPercent ?? 0) >= 0 ? "text-bullish" : "text-bearish")}>
                  {h.pnlPercent !== null ? `${h.pnlPercent >= 0 ? "+" : ""}${h.pnlPercent.toFixed(2)}%` : "—"}
                </span>
                <span className="text-muted-foreground/60 text-[10px] font-mono">
                  {tpPath}
                </span>
                <span className="text-muted-foreground/50 text-[10px] font-mono">
                  {duration > 0 ? formatElapsed(duration) : "—"}
                </span>
                <span className="text-muted-foreground/50 text-[10px]">
                  {scaleInCount > 0 ? (
                    <span className="flex items-center gap-1">
                      <Layers className="h-2.5 w-2.5 text-neutral-accent" />
                      {scaleInCount}
                    </span>
                  ) : "—"}
                </span>
                <span className="text-muted-foreground/40 text-[10px]">
                  {date ? `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ==================== Learning Tab ====================

function LearningTab({ patterns }: { patterns: Record<string, ConfluencePattern> }) {
  const sorted = Object.values(patterns).sort((a, b) => b.trades - a.trades);

  if (sorted.length === 0) {
    return (
      <div className="section-card p-6 text-center">
        <Brain className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground/60">No confluence patterns recorded yet. The system learns from completed trades.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="section-card px-3 py-2 flex items-center gap-2">
        <Brain className="h-3 w-3 text-neutral-accent" />
        <span className="text-[10px] text-muted-foreground/60">
          Risk and conviction adjustments activate after 5 trades per pattern
        </span>
      </div>

      <div className="section-card overflow-hidden">
        <div className="px-4 py-2 border-b border-border/30 grid grid-cols-6 text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
          <span className="col-span-2">Pattern</span>
          <span>Trades</span>
          <span>Win Rate</span>
          <span>Risk Mult</span>
          <span>Conv Adj</span>
        </div>
        <div className="divide-y divide-border/20 max-h-[360px] overflow-y-auto">
          {sorted.map((p) => {
            const active = p.trades >= 5;
            return (
              <div
                key={p.key}
                className={cn(
                  "px-4 py-2 grid grid-cols-6 items-center text-[11px] hover:bg-surface-2/30",
                  !active && "opacity-50"
                )}
              >
                <span className="col-span-2 font-mono text-[9px] text-foreground truncate" title={p.key}>
                  {abbreviatePattern(p.key)}
                </span>
                <span className="text-foreground font-semibold">{p.trades}</span>
                <span
                  className={cn(
                    "font-bold",
                    p.winRate >= 0.6 ? "text-bullish" : p.winRate < 0.4 ? "text-bearish" : "text-foreground"
                  )}
                >
                  {(p.winRate * 100).toFixed(0)}%
                </span>
                <span className={cn("font-mono", active ? "text-foreground" : "text-muted-foreground/40")}>
                  {active ? `${p.riskMultiplier}x` : "—"}
                </span>
                <span className={cn("font-mono", p.convictionAdjust > 0 ? "text-bullish" : p.convictionAdjust < 0 ? "text-bearish" : "text-foreground")}>
                  {active ? `${p.convictionAdjust > 0 ? "+" : ""}${p.convictionAdjust}` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function abbreviatePattern(key: string): string {
  const [systems, regime, impulse] = key.split("::");
  const abbrevSystems = (systems ?? "")
    .split("|")
    .map((s) => {
      if (s === "MA Crossover") return "MA";
      if (s === "BB Breakout") return "BB";
      if (s === "BB MR") return "MR";
      if (s === "RSI Extremes") return "RSI";
      if (s === "Elder Impulse") return "EI";
      if (s === "Elder-Ray") return "ER";
      if (s === "Trend Stack") return "TS";
      return s.slice(0, 4);
    })
    .join("+");
  const abbrevRegime = regime === "trending_up" ? "↑" : regime === "trending_down" ? "↓" : regime === "ranging" ? "→" : "⚡";
  const abbrevImpulse = impulse === "green" ? "G" : impulse === "red" ? "R" : "B";
  return `${abbrevSystems} ${abbrevRegime}${abbrevImpulse}`;
}

// ==================== Tab Bar ====================

type TabId = "active" | "history" | "learning";

function TabBar({
  activeTab,
  onTabChange,
  historyCount,
  patternCount,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  historyCount: number;
  patternCount: number;
}) {
  const tabs: { id: TabId; label: string; icon: typeof Target; count?: number }[] = [
    { id: "active", label: "Active", icon: Target },
    { id: "history", label: "History", icon: History, count: historyCount },
    { id: "learning", label: "Learning", icon: Brain, count: patternCount },
  ];

  return (
    <div className="flex items-center gap-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-colors",
              isActive
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-surface-2/50"
            )}
          >
            <Icon className="h-3 w-3" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="text-[9px] text-muted-foreground/40 ml-0.5">{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ==================== Loading State ====================

function TradeDeskSkeleton() {
  return (
    <div className="section-card p-5">
      <div className="py-12">
        <AnalysisLoader
          messages={[
            "Scanning 16 instruments...",
            "Running mechanical signal systems...",
            "Evaluating regime conditions...",
            "Checking multi-timeframe alignment...",
            "Ranking by conviction tier...",
          ]}
          speed={20}
          holdMs={800}
        />
      </div>
    </div>
  );
}

// ==================== Alert Sound ====================

// Persistent AudioContext — created on first user interaction to satisfy browser policy
let _audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!_audioCtx) {
      _audioCtx = new AudioContext();
    }
    // Resume if suspended (browser autoplay policy)
    if (_audioCtx.state === "suspended") {
      _audioCtx.resume();
    }
    return _audioCtx;
  } catch {
    return null;
  }
}

// Warm up AudioContext on first click anywhere — required by browser autoplay policy
if (typeof window !== "undefined") {
  const warmUp = () => {
    getAudioContext();
    document.removeEventListener("click", warmUp);
    document.removeEventListener("keydown", warmUp);
  };
  document.addEventListener("click", warmUp, { once: true });
  document.addEventListener("keydown", warmUp, { once: true });
}

function playAlertTone() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    // Two-tone chime: C5 → E5
    const frequencies = [523.25, 659.25];
    for (let i = 0; i < frequencies.length; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequencies[i];
      gain.gain.setValueAtTime(0, now + i * 0.15);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.15 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.3);
    }
  } catch {
    // AudioContext play failed
  }
}

// ==================== Setup Alert Banner (Unified — Single Brain) ====================

interface SetupAlert {
  id: string;
  symbol: string;
  direction: "bullish" | "bearish";
  conviction: ConvictionTier;
  score: number;
  strategy: string;
  timestamp: number;
}

function useSetupAlerts(setups: TradeDeskSetup[]) {
  const [alerts, setAlerts] = useState<SetupAlert[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const addStoreAlerts = useMarketStore((s) => s.addAlerts);

  useEffect(() => {
    if (setups.length === 0) return;

    // Skip alerting on first load — only alert on NEW setups
    if (!initializedRef.current) {
      initializedRef.current = true;
      for (const s of setups) {
        seenRef.current.add(`${s.instrumentId}:${s.direction}`);
      }
      return;
    }

    const newBannerAlerts: SetupAlert[] = [];
    const newStoreAlerts: import("@/lib/types/alerts").SmartAlert[] = [];
    const now = Date.now();

    for (const s of setups) {
      const key = `${s.instrumentId}:${s.direction}`;
      if (seenRef.current.has(key)) continue;
      seenRef.current.add(key);

      // Only alert on A+ and A
      if (s.conviction !== "A+" && s.conviction !== "A") continue;
      if (s.direction === "neutral") continue;

      const { name } = getStrategyLabel(s);
      const dir = s.direction === "bullish" ? "LONG" : "SHORT";

      // Banner alert (inline, auto-dismiss after 30s)
      newBannerAlerts.push({
        id: `${key}:${now}`,
        symbol: s.symbol,
        direction: s.direction,
        conviction: s.conviction,
        score: s.convictionScore,
        strategy: name,
        timestamp: now,
      });

      // Zustand store alert (header bell, persists 4h)
      newStoreAlerts.push({
        id: `${key}:${now}`,
        type: "setup_detected",
        instrumentId: s.instrumentId,
        title: `${s.conviction} ${dir} ${s.symbol}`,
        message: `${s.conviction} conviction (${s.convictionScore}pts) — ${name}. R:R ${s.riskReward[0].toFixed(1)}`,
        severity: s.conviction === "A+" ? "danger" : "warning",
        createdAt: now,
        dismissed: false,
        expiresAt: now + 4 * 60 * 60 * 1000,
      });
    }

    if (newBannerAlerts.length > 0) {
      setAlerts((prev) => [...newBannerAlerts, ...prev].slice(0, 5));
      playAlertTone();
    }

    // Push to Zustand store → header bell (single brain: same alerts everywhere)
    if (newStoreAlerts.length > 0) {
      addStoreAlerts(newStoreAlerts);
    }

    // Clean up stale keys from setups that no longer exist
    const currentKeys = new Set(setups.map((s) => `${s.instrumentId}:${s.direction}`));
    for (const key of seenRef.current) {
      if (!currentKeys.has(key)) seenRef.current.delete(key);
    }
  }, [setups, addStoreAlerts]);

  const dismiss = (id: string) => setAlerts((prev) => prev.filter((a) => a.id !== id));
  const dismissAll = () => setAlerts([]);

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    if (alerts.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setAlerts((prev) => prev.filter((a) => now - a.timestamp < 30_000));
    }, 5_000);
    return () => clearInterval(timer);
  }, [alerts.length]);

  return { alerts, dismiss, dismissAll };
}

function SetupAlertBanner({ alerts, onDismiss }: { alerts: SetupAlert[]; onDismiss: (id: string) => void }) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-1.5 mb-4">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={cn(
            "flex items-center gap-3 px-4 py-2.5 rounded-lg border animate-in slide-in-from-top-2 fade-in duration-300",
            alert.conviction === "A+"
              ? "bg-bullish/10 border-bullish/30"
              : "bg-bullish/8 border-bullish/20"
          )}
        >
          <Zap className={cn(
            "h-4 w-4 shrink-0",
            alert.conviction === "A+" ? "text-bullish animate-pulse" : "text-bullish"
          )} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">
                New {alert.conviction} Setup
              </span>
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                alert.direction === "bullish" ? "bg-bullish/15 text-bullish" : "bg-bearish/15 text-bearish"
              )}>
                {alert.direction === "bullish" ? "LONG" : "SHORT"} {alert.symbol}
              </span>
              <span className="text-[9px] text-muted-foreground/60">
                {alert.strategy} · Score {alert.score}
              </span>
            </div>
          </div>

          <button
            onClick={() => onDismiss(alert.id)}
            className="p-1 rounded hover:bg-foreground/5 text-muted-foreground/40 hover:text-muted-foreground shrink-0"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ==================== Main Component ====================

function useTimeAgo(deps: unknown[]) {
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [, setTick] = useState(0);

  // Update timestamp when deps change
  const depsKey = JSON.stringify(deps.map((d) => (Array.isArray(d) ? d.length : d)));
  const prevRef = useRef(depsKey);
  if (prevRef.current !== depsKey) {
    prevRef.current = depsKey;
    setLastUpdated(Date.now());
  }

  // Tick every 10s for "X ago" display
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(interval);
  }, []);

  const seconds = Math.floor((Date.now() - lastUpdated) / 1000);
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

export function AITradeDesk() {
  const [activeTab, setActiveTab] = useState<TabId>("active");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { setups, allSetups, portfolioRisk: baseRisk, isLoading, error, refresh, instrumentsWithData, allInstrumentCount } = useTradeDeskData();
  const { activeSetups, historySetups, confluencePatterns, dismissScaleIn } = useTrackedSetups(allSetups);
  const timeAgo = useTimeAgo([setups]);
  const { alerts: setupAlerts, dismiss: dismissAlert } = useSetupAlerts(setups);

  const portfolioRisk = useMemo(
    () =>
      computePortfolioRisk(
        baseRisk.riskPercent,
        activeSetups
      ),
    [baseRisk.riskPercent, activeSetups]
  );

  if (isLoading) {
    return <TradeDeskSkeleton />;
  }

  if (error || setups.length === 0) {
    const dataOk = instrumentsWithData > 0;
    return (
      <div className="section-card p-6 text-center">
        <BarChart3 className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground/60">
          {error
            ? "Failed to load trade desk data"
            : dataOk
              ? "No qualifying setups — no instruments meet A+/A conviction right now"
              : "No candle data received — check data provider status (Finnhub, Twelve Data)"}
        </p>
        <p className="text-[10px] text-muted-foreground/40 mt-1 font-mono">
          Data: {instrumentsWithData}/{allInstrumentCount} instruments
        </p>
      </div>
    );
  }

  const patternCount = Object.keys(confluencePatterns).length;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <TabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          historyCount={historySetups.length}
          patternCount={patternCount}
        />
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/40">{timeAgo}</span>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1 rounded-md hover:bg-surface-2/50 transition-colors text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-30"
            title="Refresh signals"
          >
            <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      <SetupAlertBanner alerts={setupAlerts} onDismiss={dismissAlert} />

      {activeTab === "active" && (() => {
        const running = activeSetups.filter((t) => isRunningStatus(t.status));
        const actionable = activeSetups.filter((t) => isActionable(t.status));
        return (
          <>
            <StatsRow setups={setups} portfolioRisk={portfolioRisk} />

            {/* New setups section — prioritized first */}
            {actionable.length > 0 && (
              <div className={running.length > 0 ? "mb-4" : ""}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold text-neutral-accent uppercase tracking-wider">
                    New Setups
                  </span>
                  <span className="text-[9px] text-muted-foreground/40">{actionable.length}</span>
                </div>
                <div className="space-y-1.5">
                  {actionable.slice(0, 8).map((tracked, i) => (
                    <SetupCard key={tracked.id} tracked={tracked} rank={i + 1} />
                  ))}
                </div>
              </div>
            )}

            {/* Running trades section */}
            {running.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold text-bullish uppercase tracking-wider">
                    Core Trades Running
                  </span>
                  <span className="text-[9px] text-muted-foreground/40">{running.length}</span>
                </div>
                <div className="space-y-1.5">
                  {running.map((tracked, i) => (
                    <SetupCard
                      key={tracked.id}
                      tracked={tracked}
                      rank={i + 1}
                      onDismissScaleIn={dismissScaleIn}
                    />
                  ))}
                </div>
              </div>
            )}

            {running.length === 0 && actionable.length === 0 && (
              <div className="text-center py-6">
                <p className="text-xs text-muted-foreground/50">
                  No actionable setups right now. Waiting for new entry signals.
                </p>
              </div>
            )}
          </>
        );
      })()}

      {activeTab === "history" && <HistoryTab history={historySetups} />}

      {activeTab === "learning" && <LearningTab patterns={confluencePatterns} />}
    </div>
  );
}
