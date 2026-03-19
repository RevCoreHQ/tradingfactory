"use client";

import { useMarketStore } from "@/lib/store/market-store";
import { useBiasScore } from "@/lib/hooks/useBiasScore";
import { getBiasColor, getBiasLabel } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import { Target, Shield, Zap, AlertTriangle, TrendingUp, TrendingDown, Crosshair } from "lucide-react";
import type { RiskSizing } from "@/lib/types/bias";

function RiskBadge({ sizing }: { sizing: RiskSizing }) {
  const config = {
    size_up: { label: "SIZE UP", icon: Zap, cls: "bg-bullish/15 text-bullish border-bullish/20" },
    normal: { label: "NORMAL SIZE", icon: Shield, cls: "bg-neutral-accent/15 text-neutral-accent border-neutral-accent/20" },
    size_down: { label: "SIZE DOWN", icon: AlertTriangle, cls: "bg-amber/15 text-[var(--amber)] border-[var(--amber)]/20" },
  }[sizing];
  const Icon = config.icon;

  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border", config.cls)}>
      <Icon className="h-4 w-4" />
      <span className="text-sm font-bold uppercase tracking-wider">{config.label}</span>
    </div>
  );
}

export function TradeSetupCard() {
  const instrument = useMarketStore((s) => s.selectedInstrument);
  const batchLLMResults = useMarketStore((s) => s.batchLLMResults);
  const { biasResult } = useBiasScore();

  if (!biasResult?.tradeSetup) {
    const hasBias = biasResult && Math.abs(biasResult.overallBias) > 2;
    return (
      <div className="panel rounded-lg p-4 min-h-[280px]">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Trade Setup
          </h3>
        </div>
        {hasBias ? (
          <p className="text-[11px] text-muted-foreground/60 py-4 text-center">
            Waiting for price data to calculate entry levels...
          </p>
        ) : (
          <div className="space-y-3 py-2">
            <div className="h-5 w-1/3 shimmer rounded" />
            <div className="h-3 w-2/3 shimmer rounded" />
            <div className="h-3 w-1/2 shimmer rounded" />
            <div className="h-3 w-3/4 shimmer rounded" />
            <div className="h-3 w-2/3 shimmer rounded" />
            <div className="h-3 w-1/2 shimmer rounded" />
          </div>
        )}
      </div>
    );
  }

  const { tradeSetup, overallBias, direction, confidence, adr, aiBias } = biasResult;
  const color = getBiasColor(direction);
  const isBullish = direction.includes("bullish");
  const dec = instrument.decimalPlaces;
  const llm = batchLLMResults?.[instrument.id];

  return (
    <div className="panel rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-3.5 w-3.5 text-neutral-accent" />
          <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Trade Setup
          </h3>
        </div>
        <span className="text-[9px] font-mono text-muted-foreground/40">
          Score: {tradeSetup.tradeScore.toFixed(0)}
        </span>
      </div>

      {/* Direction + Risk Sizing */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isBullish ? (
              <TrendingUp className="h-5 w-5" style={{ color }} />
            ) : (
              <TrendingDown className="h-5 w-5" style={{ color }} />
            )}
            <span className="text-lg font-bold uppercase" style={{ color }}>
              {getBiasLabel(direction)}
            </span>
          </div>
          <span className="text-sm font-mono text-muted-foreground">
            Conf: {Math.round(confidence)}%
          </span>
        </div>
        <RiskBadge sizing={tradeSetup.riskSizing} />
      </div>

      {/* Scores Row */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-[var(--surface-2)] rounded px-2 py-1.5 text-center">
          <div className="text-[9px] text-muted-foreground/60 uppercase">Fundamental</div>
          <div className="text-sm font-mono font-bold text-foreground">{Math.round(biasResult.fundamentalScore.total)}</div>
        </div>
        <div className="bg-[var(--surface-2)] rounded px-2 py-1.5 text-center">
          <div className="text-[9px] text-muted-foreground/60 uppercase">Technical</div>
          <div className="text-sm font-mono font-bold text-foreground">{Math.round(biasResult.technicalScore.total)}</div>
        </div>
        <div className="bg-[var(--surface-2)] rounded px-2 py-1.5 text-center">
          <div className="text-[9px] text-muted-foreground/60 uppercase">AI Bias</div>
          <div className="text-sm font-mono font-bold text-neutral-accent">
            {aiBias > 0 ? "+" : ""}{Math.round(aiBias)}
          </div>
        </div>
        <div className="bg-[var(--surface-2)] rounded px-2 py-1.5 text-center">
          <div className="text-[9px] text-muted-foreground/60 uppercase">ADR</div>
          <div className="text-sm font-mono font-bold text-foreground">
            {adr ? `${adr.pips}p` : "—"}
          </div>
        </div>
      </div>

      {/* Price Levels */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 mb-1">
          <Crosshair className="h-3 w-3 inline mr-1" />
          Price Levels
        </div>

        {/* Entry Zone */}
        <div className="flex items-center justify-between bg-[var(--surface-2)] rounded px-3 py-2">
          <span className="text-[11px] font-medium text-muted-foreground">Entry Zone</span>
          <span className="text-[12px] font-mono font-bold text-foreground">
            {tradeSetup.entryZone[0].toFixed(dec)} – {tradeSetup.entryZone[1].toFixed(dec)}
          </span>
        </div>

        {/* Stop Loss */}
        <div className="flex items-center justify-between bg-bearish/5 rounded px-3 py-2 border border-bearish/10">
          <span className="text-[11px] font-medium text-bearish">Stop Loss</span>
          <span className="text-[12px] font-mono font-bold text-bearish">
            {tradeSetup.stopLoss.toFixed(dec)}
          </span>
        </div>

        {/* Take Profit Levels */}
        {tradeSetup.takeProfit.map((tp, i) => (
          <div key={i} className="flex items-center justify-between bg-bullish/5 rounded px-3 py-2 border border-bullish/10">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-bullish">TP{i + 1}</span>
              <span className="text-[10px] font-mono text-bullish/60">{tradeSetup.riskReward[i]}R</span>
            </div>
            <span className="text-[12px] font-mono font-bold text-bullish">
              {tp.toFixed(dec)}
            </span>
          </div>
        ))}
      </div>

      {/* Projected Move */}
      <div className="flex items-center justify-between bg-[var(--surface-2)] rounded px-3 py-2">
        <span className="text-[11px] font-medium text-muted-foreground">Projected Move</span>
        <span className="text-sm font-mono font-bold" style={{ color }}>
          {isBullish ? "+" : "-"}{tradeSetup.projectedMove.pips} pips ({tradeSetup.projectedMove.percent}%)
        </span>
      </div>

      {/* AI Key Levels */}
      {llm?.keyLevels && llm.keyLevels.support > 0 && (
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground/50">
          <span>AI Support: {llm.keyLevels.support.toFixed(dec)}</span>
          <span>AI Resistance: {llm.keyLevels.resistance.toFixed(dec)}</span>
        </div>
      )}

      {/* Risk Reason + Catalysts */}
      <div className="border-t border-border/50 pt-2 space-y-1.5">
        <p className="text-[10px] text-muted-foreground/50">{tradeSetup.riskReason}</p>
        {llm?.catalysts && llm.catalysts.length > 0 && (
          <div>
            <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-wider">Catalysts: </span>
            <span className="text-[10px] text-muted-foreground/50">{llm.catalysts.join(" · ")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
