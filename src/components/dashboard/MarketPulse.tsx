"use client";

import { useFearGreed, useBondYields } from "@/lib/hooks/useMarketData";
import { useMarketStore } from "@/lib/store/market-store";
import { TRADING_SESSIONS } from "@/lib/utils/constants";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { cn } from "@/lib/utils";
import { Activity, TrendingUp, TrendingDown, DollarSign, BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";

function isSessionActive(session: { openHourUTC: number; closeHourUTC: number }, hourUTC: number): boolean {
  if (session.openHourUTC < session.closeHourUTC) {
    return hourUTC >= session.openHourUTC && hourUTC < session.closeHourUTC;
  }
  return hourUTC >= session.openHourUTC || hourUTC < session.closeHourUTC;
}

function getGaugeColor(value: number): string {
  if (value <= 20) return "var(--bearish)";
  if (value <= 40) return "#ef8b4f";
  if (value <= 60) return "var(--neutral-accent)";
  if (value <= 80) return "#8bc34a";
  return "var(--bullish)";
}

export function MarketPulse() {
  const { data: fearGreedData } = useFearGreed();
  const { data: bondData } = useBondYields();
  const allBiasResults = useMarketStore((s) => s.allBiasResults);
  const biasTimeframe = "intraday" as const;
  const currentResults = allBiasResults[biasTimeframe];

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const hourUTC = now.getUTCHours();
  const fg = fearGreedData?.current || { value: 50, label: "Neutral" };
  const dxy = bondData?.dxy || { value: 0, change: 0 };
  const activeSessions = Object.values(TRADING_SESSIONS).filter((s) => isSessionActive(s, hourUTC));
  const strongConviction = Object.values(currentResults).filter((r) => Math.abs(r.overallBias) >= 45).length;
  const totalInstruments = Object.keys(currentResults).length;
  const bullishCount = Object.values(currentResults).filter((r) => r.overallBias > 10).length;
  const bearishCount = Object.values(currentResults).filter((r) => r.overallBias < -10).length;

  const fgColor = getGaugeColor(fg.value);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Fear & Greed */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ background: `${fgColor}20` }}>
            <Activity className="h-3.5 w-3.5" style={{ color: fgColor }} />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Sentiment</span>
        </div>
        <div className="flex items-baseline gap-2">
          <AnimatedNumber
            value={fg.value}
            format={(n) => Math.round(n).toString()}
            className={cn("text-2xl font-bold font-mono rounded-md px-1.5 py-0.5 -mx-1.5", fg.value >= 60 ? "glow-bullish" : fg.value <= 40 ? "glow-bearish" : "glow-amber")}
          />
          <span className="text-xs font-semibold" style={{ color: fgColor }}>{fg.label || "Neutral"}</span>
        </div>
        <div className="flex h-1.5 rounded-full overflow-hidden gap-0.5 mt-3">
          {[
            { color: "var(--bearish)", range: [0, 20] },
            { color: "#ef8b4f", range: [20, 40] },
            { color: "var(--neutral-accent)", range: [40, 60] },
            { color: "#8bc34a", range: [60, 80] },
            { color: "var(--bullish)", range: [80, 100] },
          ].map((seg) => (
            <div
              key={seg.range[0]}
              className="flex-1 rounded-sm"
              style={{
                backgroundColor: seg.color,
                opacity: fg.value >= seg.range[0] && fg.value < seg.range[1] ? 1 : 0.15,
              }}
            />
          ))}
        </div>
      </div>

      {/* DXY */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-6 w-6 rounded-md flex items-center justify-center bg-neutral-accent/15">
            <DollarSign className="h-3.5 w-3.5 text-neutral-accent" />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Dollar Index</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono">
            {dxy.value > 0 ? dxy.value.toFixed(2) : "—"}
          </span>
          {dxy.change !== 0 && (
            <span className={cn("text-xs font-mono font-medium", dxy.change > 0 ? "text-bullish" : "text-bearish")}>
              {dxy.change > 0 ? "+" : ""}{dxy.change.toFixed(2)}
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground/60 mt-2 font-mono">
          {dxy.change > 0.3 ? "USD Strength" : dxy.change < -0.3 ? "USD Weakness" : "Stable"}
        </div>
      </div>

      {/* Market Bias */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-6 w-6 rounded-md flex items-center justify-center bg-bullish/15">
            <BarChart3 className="h-3.5 w-3.5 text-bullish" />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Market Bias</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-bullish" />
            <span className="text-lg font-bold text-bullish">{bullishCount}</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-bearish" />
            <span className="text-lg font-bold text-bearish">{bearishCount}</span>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground/60 mt-2">
          {strongConviction} of {totalInstruments} strong conviction
        </div>
      </div>

      {/* Active Sessions */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-6 w-6 rounded-md flex items-center justify-center bg-amber/15">
            <Activity className="h-3.5 w-3.5 text-[var(--amber)]" />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Sessions</span>
        </div>
        {activeSessions.length > 0 ? (
          <div className="space-y-1.5">
            {activeSessions.map((session) => (
              <div key={session.name} className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full pulse-dot shrink-0"
                  style={{ backgroundColor: session.color }}
                />
                <span className="text-sm font-medium">{session.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Markets Closed</span>
        )}
        <div className="text-[10px] text-muted-foreground/60 mt-2 font-mono">
          {now.toUTCString().slice(17, 25)} UTC
        </div>
      </div>
    </div>
  );
}
