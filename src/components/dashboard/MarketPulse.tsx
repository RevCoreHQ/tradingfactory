"use client";

import { useFearGreed, useBondYields, useRates } from "@/lib/hooks/useMarketData";
import { useMarketStore } from "@/lib/store/market-store";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Activity, TrendingUp, TrendingDown, DollarSign, BarChart3, Star } from "lucide-react";
import useSWR from "swr";

function getGaugeColor(value: number): string {
  if (value <= 20) return "var(--bearish)";
  if (value <= 40) return "#ef8b4f";
  if (value <= 60) return "var(--neutral-accent)";
  if (value <= 80) return "#8bc34a";
  return "var(--bullish)";
}

function useGeneralNews() {
  const fetcher = (url: string) => fetch(url).then((r) => r.json());
  return useSWR<{ items: { headline: string; sentimentLabel: string; sentimentScore: number }[] }>(
    "/api/fundamentals/news",
    fetcher,
    { revalidateOnFocus: false }
  );
}

export function MarketPulse() {
  const { data: fearGreedData } = useFearGreed();
  const { data: bondData } = useBondYields();
  const { data: newsData } = useGeneralNews();
  const { data: ratesData } = useRates();
  const allBiasResults = useMarketStore((s) => s.allBiasResults);
  const biasTimeframe = "intraday" as const;
  const currentResults = allBiasResults[biasTimeframe];

  const fg = fearGreedData?.current || { value: 50, label: "Neutral" };
  const dxy = bondData?.dxy || { value: 0, change: 0 };
  const quotes = ratesData?.quotes || {};

  const KEY_MARKETS = [
    { id: "SPX500", label: "S&P 500", decimals: 1 },
    { id: "US30", label: "Dow 30", decimals: 0 },
    { id: "US100", label: "Nasdaq", decimals: 1 },
    { id: "XAU_USD", label: "Gold", decimals: 2 },
    { id: "USOIL", label: "Oil", decimals: 2 },
  ];
  const strongConviction = Object.values(currentResults).filter((r) => Math.abs(r.overallBias) >= 45).length;
  const totalInstruments = Object.keys(currentResults).length;
  const bullishCount = Object.values(currentResults).filter((r) => r.overallBias > 10).length;
  const bearishCount = Object.values(currentResults).filter((r) => r.overallBias < -10).length;

  const strongConvictionInstruments = Object.entries(currentResults)
    .filter(([, r]) => Math.abs(r.overallBias) >= 45)
    .map(([id, r]) => {
      const inst = INSTRUMENTS.find((i) => i.id === id);
      return {
        id,
        symbol: inst?.symbol || id,
        direction: r.overallBias > 0 ? ("bullish" as const) : ("bearish" as const),
        bias: r.overallBias,
      };
    })
    .sort((a, b) => Math.abs(b.bias) - Math.abs(a.bias));

  const fgColor = getGaugeColor(fg.value);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Fear & Greed — with Sentiment Popover */}
      <Popover>
        <PopoverTrigger className="glass-card p-4 text-left w-full cursor-pointer hover:border-border-bright transition-colors">
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
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" sideOffset={8} className="w-80 p-0">
          <div className="px-3 py-2.5 border-b border-border/30 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold">Why {fg.label}?</span>
              <span className="text-[10px] text-muted-foreground/50 ml-2">Top drivers</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground/40">F&G: {fg.value}</span>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {(!newsData?.items || newsData.items.length === 0) ? (
              <div className="px-3 py-6 text-center text-[11px] text-muted-foreground/50">
                No recent headlines
              </div>
            ) : (
              newsData.items.slice(0, 6).map((item, i) => (
                <div key={i} className="px-3 py-2 border-b border-border/20 last:border-0">
                  <div className="flex items-start gap-2">
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full mt-1.5 shrink-0",
                      item.sentimentLabel === "bullish" ? "bg-bullish" :
                      item.sentimentLabel === "bearish" ? "bg-bearish" : "bg-muted-foreground/40"
                    )} />
                    <div>
                      <p className="text-[11px] text-foreground/80 leading-snug">{item.headline}</p>
                      <span className={cn(
                        "text-[9px] font-bold uppercase tracking-wider",
                        item.sentimentLabel === "bullish" ? "text-bullish" :
                        item.sentimentLabel === "bearish" ? "text-bearish" : "text-muted-foreground/50"
                      )}>
                        {item.sentimentLabel}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

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

      {/* Market Bias — with Strong Conviction Popover */}
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
        <Popover>
          <PopoverTrigger className="text-[10px] text-muted-foreground/60 mt-2 cursor-pointer hover:text-muted-foreground transition-colors underline decoration-dotted underline-offset-2 flex items-center gap-1">
            {strongConviction > 0 && <Star className="h-2.5 w-2.5 fill-[#FFD700] text-[#FFD700]" />}
            {strongConviction} of {totalInstruments} strong conviction
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" sideOffset={8} className="w-64 p-0">
            <div className="px-3 py-2.5 border-b border-border/30">
              <span className="text-xs font-semibold">Strong Conviction</span>
              <span className="text-[10px] text-muted-foreground/50 ml-2">|bias| &ge; 45</span>
            </div>
            <div className="max-h-[240px] overflow-y-auto">
              {strongConvictionInstruments.length === 0 ? (
                <div className="px-3 py-4 text-center text-[11px] text-muted-foreground/50">
                  No strong conviction instruments
                </div>
              ) : (
                strongConvictionInstruments.map((sc) => (
                  <div key={sc.id} className="px-3 py-2 border-b border-border/20 last:border-0 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {sc.direction === "bullish" ? (
                        <TrendingUp className="h-3 w-3 text-bullish" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-bearish" />
                      )}
                      <span className="text-[11px] font-medium">{sc.symbol}</span>
                    </div>
                    <span className={cn(
                      "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                      sc.direction === "bullish" ? "bg-bullish/12 text-bullish" : "bg-bearish/12 text-bearish"
                    )}>
                      {sc.direction === "bullish" ? "LONG" : "SHORT"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Key Markets */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-6 w-6 rounded-md flex items-center justify-center bg-foreground/10">
            <TrendingUp className="h-3.5 w-3.5 text-foreground/60" />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Key Markets</span>
        </div>
        <div className="space-y-1.5">
          {KEY_MARKETS.map((m) => {
            const q = quotes[m.id];
            const change = q?.change || 0;
            const pct = q?.changePercent || 0;
            return (
              <div key={m.id} className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">{m.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-[11px] font-mono font-semibold", change > 0 ? "text-bullish" : change < 0 ? "text-bearish" : "text-muted-foreground")}>
                    {change > 0 ? "+" : ""}{change.toFixed(m.decimals)}
                  </span>
                  <span className={cn("text-[9px] font-mono px-1 py-0.5 rounded", pct > 0 ? "bg-bullish/12 text-bullish" : pct < 0 ? "bg-bearish/12 text-bearish" : "bg-muted text-muted-foreground")}>
                    {pct > 0 ? "+" : ""}{pct.toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
