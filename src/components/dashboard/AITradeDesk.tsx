"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTradeDeskData } from "@/lib/hooks/useTradeDeskData";
import { useMarketStore } from "@/lib/store/market-store";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { cn } from "@/lib/utils";
import type { TradeDeskSetup, ConvictionTier, ImpulseColor, MarketRegime } from "@/lib/types/signals";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Shield,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Zap,
  Target,
  Minus,
} from "lucide-react";

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
      <span className="opacity-60 ml-0.5">ADX {adx.toFixed(0)}</span>
    </span>
  );
}

function ImpulseBadge({ color }: { color: ImpulseColor }) {
  const config: Record<ImpulseColor, { label: string; cls: string; dot: string }> = {
    green: { label: "GREEN", cls: "text-bullish", dot: "bg-bullish" },
    red: { label: "RED", cls: "text-bearish", dot: "bg-bearish" },
    blue: { label: "BLUE", cls: "text-neutral-accent", dot: "bg-neutral-accent" },
  };
  const c = config[color];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider", c.cls)}>
      <span className={cn("h-2 w-2 rounded-full animate-pulse", c.dot)} />
      {c.label}
    </span>
  );
}

function ConvictionBadge({ tier }: { tier: ConvictionTier }) {
  const config: Record<ConvictionTier, { cls: string }> = {
    "A+": { cls: "bg-bullish/20 text-bullish ring-1 ring-bullish/30" },
    "A": { cls: "bg-bullish/15 text-bullish" },
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

// ==================== Setup Card ====================

function SetupCard({ setup, rank }: { setup: TradeDeskSetup; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument);

  const inst = INSTRUMENTS.find((i) => i.id === setup.instrumentId);
  const decimals = inst?.decimalPlaces ?? 4;
  const isBullish = setup.direction === "bullish";

  const handleNavigate = () => {
    if (inst) {
      setSelectedInstrument(inst);
      router.push(`/instrument/${inst.id}`);
    }
  };

  return (
    <div className="section-card overflow-hidden">
      {/* Main Row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface-2/50 transition-colors text-left"
      >
        {/* Rank */}
        <span className="text-[10px] font-mono text-muted-foreground/50 w-4 shrink-0">
          {rank}
        </span>

        {/* Conviction */}
        <ConvictionBadge tier={setup.conviction} />

        {/* Instrument */}
        <div className="flex items-center gap-2 min-w-[110px]">
          <DirectionArrow direction={setup.direction} />
          <div>
            <span className="text-xs font-semibold text-foreground">{setup.symbol}</span>
            <span className="text-[10px] text-muted-foreground/60 ml-1.5">{setup.displayName}</span>
          </div>
        </div>

        {/* Direction */}
        <span
          className={cn(
            "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
            isBullish ? "bg-bullish/12 text-bullish" : "bg-bearish/12 text-bearish"
          )}
        >
          {isBullish ? "LONG" : "SHORT"}
        </span>

        {/* Signal dots */}
        <div className="flex items-center gap-1 ml-auto">
          {setup.signals.map((s, i) => (
            <SignalDot key={i} direction={s.direction} match={s.regimeMatch} />
          ))}
        </div>

        {/* Impulse */}
        <ImpulseBadge color={setup.impulse} />

        {/* Regime */}
        <RegimeBadge regime={setup.regime} adx={setup.adx} />

        {/* Expand */}
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
        )}
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-border/50 px-4 py-3 space-y-3">
          {/* Signals Grid */}
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
                    {sig.regimeMatch && (
                      <span className="text-[8px] opacity-60">MATCH</span>
                    )}
                  </div>
                  <div className="text-[9px] opacity-70 mt-0.5 leading-tight">{sig.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Trade Levels */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">
                Entry Zone
              </div>
              <div className="text-xs font-mono text-foreground">
                {setup.entry[0].toFixed(decimals)} – {setup.entry[1].toFixed(decimals)}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">
                Stop Loss
              </div>
              <div className="text-xs font-mono text-bearish">
                {setup.stopLoss.toFixed(decimals)}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">
                Take Profit
              </div>
              <div className="text-xs font-mono text-bullish space-x-2">
                <span>TP1: {setup.takeProfit[0].toFixed(decimals)}</span>
                <span className="opacity-60">TP2: {setup.takeProfit[1].toFixed(decimals)}</span>
              </div>
            </div>
            <div>
              <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">
                R:R
              </div>
              <div className="text-xs font-mono text-foreground">
                1:{setup.riskReward[0]} / 1:{setup.riskReward[1]} / 1:{setup.riskReward[2]}
              </div>
            </div>
          </div>

          {/* Risk Sizing + Reasons to Exit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">
                Position Sizing (2% Rule)
              </div>
              <div className="text-xs text-foreground">
                <span className="font-mono">{setup.positionSizeLots} lots</span>
                <span className="text-muted-foreground/60 ml-2">Risk: ${setup.riskAmount}</span>
              </div>
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

          {/* Navigate */}
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
  portfolioRisk: { riskPerTrade: number; riskPercent: number; accountEquity: number };
}) {
  // Aggregate regime counts
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
      {/* Dominant Regime */}
      <div className="section-card p-3">
        <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">
          Market Regime
        </div>
        {dominantRegime && (
          <RegimeBadge regime={dominantRegime[0]} adx={0} />
        )}
        <div className="text-[10px] text-muted-foreground/50 mt-1">
          {regimeCounts.trending_up + regimeCounts.trending_down} trending · {regimeCounts.ranging} ranging · {regimeCounts.volatile} volatile
        </div>
      </div>

      {/* System Consensus */}
      <div className="section-card p-3">
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

      {/* Impulse */}
      <div className="section-card p-3">
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

      {/* Risk */}
      <div className="section-card p-3">
        <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">
          Risk per Trade
        </div>
        <div className="text-xs font-mono text-foreground">
          ${portfolioRisk.riskPerTrade.toFixed(0)}
          <span className="text-muted-foreground/60 ml-1">({portfolioRisk.riskPercent}% of ${portfolioRisk.accountEquity.toLocaleString()})</span>
        </div>
      </div>
    </div>
  );
}

// ==================== Loading State ====================

function TradeDeskSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="section-card p-3 space-y-2">
            <div className="h-3 w-20 shimmer rounded" />
            <div className="h-5 w-24 shimmer rounded" />
          </div>
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="section-card p-4 space-y-2">
          <div className="h-4 w-full shimmer rounded" />
          <div className="h-3 w-3/4 shimmer rounded" />
        </div>
      ))}
    </div>
  );
}

// ==================== Main Component ====================

export function AITradeDesk() {
  const { setups, portfolioRisk, isLoading, error } = useTradeDeskData();

  if (isLoading) {
    return (
      <div>
        <TradeDeskSkeleton />
      </div>
    );
  }

  if (error || setups.length === 0) {
    return (
      <div className="section-card p-6 text-center">
        <BarChart3 className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground/60">
          {error ? "Failed to load trade desk data" : "No qualifying setups found — all instruments show D conviction"}
        </p>
      </div>
    );
  }

  return (
    <div>
      <StatsRow setups={setups} portfolioRisk={portfolioRisk} />

      <div className="space-y-1.5">
        {setups.slice(0, 8).map((setup, i) => (
          <SetupCard key={setup.instrumentId} setup={setup} rank={i + 1} />
        ))}
      </div>

      {setups.length === 0 && (
        <div className="text-center py-6">
          <p className="text-xs text-muted-foreground/50">
            No high-conviction setups at this time. All systems show D-tier conviction.
          </p>
        </div>
      )}
    </div>
  );
}
