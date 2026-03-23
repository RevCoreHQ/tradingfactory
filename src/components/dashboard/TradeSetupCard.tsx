"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { TradeDeskSetup, ConvictionTier, ImpulseColor, MarketRegime } from "@/lib/types/signals";
import {
  Target,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Minus,
  Check,
  Copy,
} from "lucide-react";

// ── Copy Price ──

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

// ── Sub-badges ──

function ConvictionBadgeLg({ tier }: { tier: ConvictionTier }) {
  const config: Record<ConvictionTier, { cls: string }> = {
    "A+": { cls: "bg-bullish/20 text-bullish ring-1 ring-bullish/30" },
    "A": { cls: "bg-bullish/15 text-bullish" },
    "B": { cls: "bg-neutral-accent/15 text-neutral-accent" },
    "C": { cls: "bg-amber/15 text-[var(--amber)]" },
    "D": { cls: "bg-muted/20 text-muted-foreground" },
  };
  return (
    <span className={cn("inline-flex items-center justify-center h-10 min-w-[44px] px-2 rounded text-lg font-black tracking-wider", config[tier].cls)}>
      {tier}
    </span>
  );
}

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
    green: { label: "GREEN", cls: "text-bullish", dot: "bg-bullish", tooltip: "GREEN — Buying pressure. MACD histogram rising + EMA slope up. Favorable for longs." },
    red: { label: "RED", cls: "text-bearish", dot: "bg-bearish", tooltip: "RED — Selling pressure. MACD histogram falling + EMA slope down. Favorable for shorts." },
    blue: { label: "BLUE", cls: "text-neutral-accent", dot: "bg-neutral-accent", tooltip: "BLUE — Mixed momentum. MACD and EMA disagree. Exercise caution." },
  };
  const c = config[color];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider cursor-help", c.cls)} title={c.tooltip}>
      <span className={cn("h-2 w-2 rounded-full animate-pulse", c.dot)} />
      {c.label}
    </span>
  );
}

// ── Strategy Label ──

function getStrategyLabel(setup: TradeDeskSetup): { name: string; source: string } {
  const agreeing = setup.signals.filter((s) => s.direction === setup.direction);
  const systems = new Set(agreeing.map((s) => s.system));

  const hasImpulse = systems.has("Elder Impulse");
  const hasMACD = systems.has("MACD");
  const hasBBBreak = systems.has("BB Breakout");
  const hasTrendStack = systems.has("Trend Stack");
  const hasRSI = systems.has("RSI Extremes");
  const hasBBMR = systems.has("BB MR");

  if (hasImpulse && hasMACD && hasTrendStack) return { name: "Triple Confirmation", source: "Elder/Weissman" };
  if (hasTrendStack && hasBBBreak && hasMACD) return { name: "Structural Breakout", source: "Weissman" };
  if (hasBBBreak && hasImpulse) return { name: "Momentum Breakout", source: "Weissman" };
  if (hasMACD && hasTrendStack) return { name: "Trend Continuation", source: "Weissman" };
  if (hasRSI && hasBBMR) return { name: "MR Pullback", source: "Weissman" };
  if (hasRSI || hasBBMR) return { name: "Mean Reversion", source: "Weissman" };

  const counts: Record<string, number> = {};
  for (const s of agreeing) counts[s.type] = (counts[s.type] || 0) + 1;
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (dominant === "trend") return { name: "Trend Signal", source: "Multi" };
  if (dominant === "momentum") return { name: "Momentum Signal", source: "Elder" };
  return { name: "Confluence", source: "Multi" };
}

// ── Main Component ──

export function TradeSetupCard({ setup, decimals = 5 }: { setup: TradeDeskSetup | null; decimals?: number }) {
  if (!setup) {
    return (
      <div className="panel rounded-lg p-4 min-h-[280px]">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Trade Setup
          </h3>
        </div>
        <div className="flex flex-col items-center py-8 text-center">
          <Minus className="h-6 w-6 text-muted-foreground/30 mb-2" />
          <p className="text-xs text-muted-foreground/50">
            No qualifying setup. Conviction below A tier or impulse misaligned.
          </p>
          <p className="text-[10px] text-muted-foreground/30 mt-1">
            Wait for higher confluence — quality over quantity.
          </p>
        </div>
      </div>
    );
  }

  const isBullish = setup.direction === "bullish";
  const dec = decimals;
  const strategy = getStrategyLabel(setup);

  return (
    <div className="panel rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-3.5 w-3.5 text-neutral-accent" />
          <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Trade Setup
          </h3>
          <span className={cn(
            "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border",
            setup.tradingStyle === "intraday"
              ? "text-neutral-accent/70 bg-neutral-accent/8 border-neutral-accent/20"
              : "text-muted-foreground/40 bg-muted/5 border-border/20"
          )}>
            {setup.tradingStyle === "intraday" ? "1H Intraday" : "4H Swing"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/10 cursor-help"
            title={`Strategy: ${strategy.name} — derived from ${strategy.source}'s methodology`}
          >
            {strategy.name}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground/40">
            {setup.convictionScore.toFixed(0)}/100
          </span>
        </div>
      </div>

      {/* Direction + Conviction */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ConvictionBadgeLg tier={setup.conviction} />
          <div className="flex items-center gap-2">
            {isBullish ? (
              <TrendingUp className="h-5 w-5 text-bullish" />
            ) : (
              <TrendingDown className="h-5 w-5 text-bearish" />
            )}
            <span className={cn("text-lg font-bold uppercase", isBullish ? "text-bullish" : "text-bearish")}>
              {isBullish ? "LONG" : "SHORT"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ImpulseBadge color={setup.impulse} />
        </div>
      </div>

      {/* Regime */}
      <div className="flex items-center gap-2">
        <RegimeBadge regime={setup.regime} adx={setup.adx} />
      </div>

      {/* 8 Mechanical Systems */}
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
            </div>
          ))}
        </div>
      </div>

      {/* Price Levels */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between bg-[var(--surface-2)] rounded px-3 py-2">
          <span className="text-[11px] font-medium text-muted-foreground">Entry Zone</span>
          <span className="text-[12px] font-mono font-bold text-foreground flex items-center gap-1">
            <CopyPrice value={setup.entry[0].toFixed(dec)} />
            <span className="text-muted-foreground/40">–</span>
            <CopyPrice value={setup.entry[1].toFixed(dec)} />
          </span>
        </div>

        <div className="flex items-center justify-between bg-bearish/5 rounded px-3 py-2 border border-bearish/10">
          <span className="text-[11px] font-medium text-bearish">Stop Loss</span>
          <CopyPrice value={setup.stopLoss.toFixed(dec)} className="text-[12px] font-bold text-bearish" />
        </div>

        {setup.takeProfit.map((tp, i) => (
          <div key={i} className="flex items-center justify-between bg-bullish/5 rounded px-3 py-2 border border-bullish/10">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-bullish">TP{i + 1}</span>
              <span className="text-[10px] font-mono text-bullish/60">1:{setup.riskReward[i]}</span>
            </div>
            <CopyPrice value={tp.toFixed(dec)} className="text-[12px] font-bold text-bullish" />
          </div>
        ))}
      </div>

      {/* Position Sizing */}
      <div className="flex items-center justify-between bg-[var(--surface-2)] rounded px-3 py-2">
        <span className="text-[11px] font-medium text-muted-foreground">Position Size</span>
        <div className="text-[12px] font-mono">
          <span className="font-bold text-foreground">{setup.positionSizeLots} lots</span>
          <span className="text-muted-foreground/60 ml-2">Risk: ${setup.riskAmount}</span>
        </div>
      </div>

      {/* Reasons to Exit */}
      {setup.reasonsToExit.length > 0 && (
        <div className="border-t border-border/50 pt-2">
          <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">
            Reasons to Exit
          </div>
          <div className="space-y-0.5">
            {setup.reasonsToExit.map((reason, i) => (
              <div key={i} className="text-[10px] text-muted-foreground/70 flex items-start gap-1">
                <span className="text-[8px] mt-0.5 text-[var(--amber)] shrink-0">●</span>
                {reason}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
