"use client";

import { useFearGreed, useBondYields, useRates } from "@/lib/hooks/useMarketData";
import { useMarketStore } from "@/lib/store/market-store";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Activity, TrendingUp, TrendingDown, Minus, DollarSign, BarChart3, Star } from "lucide-react";
import useSWR from "swr";
import type React from "react";

interface DXYAnalysis {
  trends: Record<string, { direction: "bullish" | "bearish" | "ranging"; strength: number }>;
  overallBias: "bullish" | "bearish" | "neutral";
  trendScore: number;
  impact: Record<string, string>;
}

const dxyFetcher = (url: string) => fetch(url).then((r) => r.json());

const handleSpotlight = (e: React.MouseEvent<HTMLElement>) => {
  const rect = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--spotlight-x", `${e.clientX - rect.left}px`);
  e.currentTarget.style.setProperty("--spotlight-y", `${e.clientY - rect.top}px`);
};

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

  const { data: dxyAnalysis } = useSWR<DXYAnalysis>("/api/fundamentals/dxy-analysis", dxyFetcher, {
    refreshInterval: 5 * 60_000,
    revalidateOnFocus: false,
  });

  const fg = fearGreedData?.current || { value: 50, label: "Neutral" };
  const dxy = bondData?.dxy || { value: 0, change: 0, changePercent: 0 };
  const quotes = ratesData?.quotes || {};

  const KEY_MARKETS = [
    { id: "XAU_USD", label: "Gold", decimals: 2 },
    { id: "BTC_USD", label: "Bitcoin", decimals: 0 },
    { id: "US100", label: "Nasdaq", decimals: 1 },
    { id: "EUR_USD", label: "EUR/USD", decimals: 5 },
    { id: "XAG_USD", label: "Silver", decimals: 3 },
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
        <PopoverTrigger className="glass-card spotlight p-4 text-left w-full cursor-pointer transition-colors" onMouseMove={handleSpotlight}>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ background: `${fgColor}20` }}>
              <Activity className="h-3.5 w-3.5" style={{ color: fgColor }} />
            </div>
            <span className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">Sentiment</span>
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
              <span className="text-[12px] text-muted-foreground/50 ml-2">Top drivers</span>
            </div>
            <span className="text-[12px] font-mono text-muted-foreground/40">F&G: {fg.value}</span>
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {(!newsData?.items || newsData.items.length === 0) ? (
              <div className="px-3 py-6 text-center text-[13px] text-muted-foreground/50">
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
                      <p className="text-[13px] text-foreground/80 leading-snug">{item.headline}</p>
                      <span className={cn(
                        "text-[11px] font-bold uppercase tracking-wider",
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
      <Popover>
        <PopoverTrigger className="glass-card spotlight p-4 text-left w-full cursor-pointer transition-colors" onMouseMove={handleSpotlight}>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded-md flex items-center justify-center bg-neutral-accent/15">
              <DollarSign className="h-3.5 w-3.5 text-neutral-accent" />
            </div>
            <span className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">Dollar Index</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono">
              {dxy.value > 0 ? dxy.value.toFixed(2) : "—"}
            </span>
            {(dxy.change !== 0 || dxy.changePercent !== 0) && (
              <span className={cn("text-xs font-mono font-medium", dxy.changePercent > 0 ? "text-bullish" : "text-bearish")}>
                {dxy.changePercent > 0 ? "+" : ""}{dxy.changePercent.toFixed(2)}%
              </span>
            )}
          </div>
          {/* Mini trend badges */}
          {dxyAnalysis?.trends && (
            <div className="flex items-center gap-1.5 mt-2">
              {(["1h", "4h", "1d"] as const).map((tf) => {
                const t = dxyAnalysis.trends[tf];
                if (!t) return null;
                return (
                  <span
                    key={tf}
                    className={cn(
                      "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5",
                      t.direction === "bullish" && "bg-bullish/12 text-bullish",
                      t.direction === "bearish" && "bg-bearish/12 text-bearish",
                      t.direction === "ranging" && "bg-muted text-muted-foreground"
                    )}
                  >
                    {t.direction === "bullish" ? <TrendingUp className="h-2.5 w-2.5" /> : t.direction === "bearish" ? <TrendingDown className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
                    {tf}
                  </span>
                );
              })}
            </div>
          )}
          {!dxyAnalysis?.trends && (
            <div className="text-[12px] text-muted-foreground/60 mt-2 font-mono">
              {dxy.changePercent > 0.15 ? "USD Strength" : dxy.changePercent < -0.15 ? "USD Weakness" : "Stable"}
            </div>
          )}
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="w-80">
          <div className="space-y-3">
            {/* MTF Trend Table */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">USD Trend by Timeframe</span>
              <div className="mt-2 space-y-1.5">
                {(["1h", "4h", "1d"] as const).map((tf) => {
                  const t = dxyAnalysis?.trends?.[tf];
                  const label = tf === "1h" ? "Intraday (1H)" : tf === "4h" ? "Swing (4H)" : "Daily (1D)";
                  const dir = t?.direction || "ranging";
                  return (
                    <div key={tf} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span
                        className={cn(
                          "text-xs font-bold uppercase px-2 py-0.5 rounded flex items-center gap-1",
                          dir === "bullish" && "bg-bullish/12 text-bullish",
                          dir === "bearish" && "bg-bearish/12 text-bearish",
                          dir === "ranging" && "bg-muted text-muted-foreground"
                        )}
                      >
                        {dir === "bullish" ? <TrendingUp className="h-3 w-3" /> : dir === "bearish" ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {dir === "bullish" ? "Bullish" : dir === "bearish" ? "Bearish" : "Ranging"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Overall Bias */}
            {dxyAnalysis?.overallBias && (
              <div className="border-t border-border/30 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Overall USD Bias</span>
                  <span
                    className={cn(
                      "text-xs font-bold uppercase px-2 py-0.5 rounded",
                      dxyAnalysis.overallBias === "bullish" && "bg-bullish/15 text-bullish",
                      dxyAnalysis.overallBias === "bearish" && "bg-bearish/15 text-bearish",
                      dxyAnalysis.overallBias === "neutral" && "bg-muted text-muted-foreground"
                    )}
                  >
                    {dxyAnalysis.overallBias}
                  </span>
                </div>
              </div>
            )}

            {/* Impact on your trades */}
            <div className="border-t border-border/30 pt-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Impact on your instruments</span>
              {(() => {
                const bias = dxyAnalysis?.overallBias || (dxy.changePercent > 0.15 ? "bullish" : dxy.changePercent < -0.15 ? "bearish" : "neutral");
                if (bias === "neutral") return <p className="text-sm text-foreground/65 mt-1">USD is stable — no strong directional pressure on your pairs.</p>;
                const usdStrong = bias === "bullish";
                return (
                  <ul className="space-y-1 mt-1.5 text-sm text-foreground/65">
                    <li className="flex items-start gap-1.5">
                      <span className={cn("shrink-0", usdStrong ? "text-bearish" : "text-bullish")}>&bull;</span>
                      {usdStrong ? "Bearish" : "Bullish"} for Gold & Silver (inverse to USD)
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className={cn("shrink-0", usdStrong ? "text-bearish" : "text-bullish")}>&bull;</span>
                      {usdStrong ? "Bearish" : "Bullish"} for EUR, GBP, AUD, NZD vs USD
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className={cn("shrink-0", usdStrong ? "text-bullish" : "text-bearish")}>&bull;</span>
                      {usdStrong ? "Bullish" : "Bearish"} for USD/JPY, USD/CAD, USD/CHF
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className={cn("shrink-0", usdStrong ? "text-bearish" : "text-bullish")}>&bull;</span>
                      {usdStrong ? "Headwind" : "Tailwind"} for Oil (priced in USD)
                    </li>
                  </ul>
                );
              })()}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Market Bias — with Strong Conviction Popover */}
      <div className="glass-card spotlight p-4" onMouseMove={handleSpotlight}>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-6 w-6 rounded-md flex items-center justify-center bg-bullish/15">
            <BarChart3 className="h-3.5 w-3.5 text-bullish" />
          </div>
          <span className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">Market Bias</span>
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
          <PopoverTrigger className="text-[12px] text-muted-foreground/60 mt-2 cursor-pointer hover:text-muted-foreground transition-colors underline decoration-dotted underline-offset-2 flex items-center gap-1">
            {strongConviction > 0 && <Star className="h-2.5 w-2.5 fill-[#FFD700] text-[#FFD700]" />}
            {strongConviction} of {totalInstruments} strong conviction
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" sideOffset={8} className="w-64 p-0">
            <div className="px-3 py-2.5 border-b border-border/30">
              <span className="text-xs font-semibold">Strong Conviction</span>
              <span className="text-[12px] text-muted-foreground/50 ml-2">|bias| &ge; 45</span>
            </div>
            <div className="max-h-[240px] overflow-y-auto">
              {strongConvictionInstruments.length === 0 ? (
                <div className="px-3 py-4 text-center text-[13px] text-muted-foreground/50">
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
                      <span className="text-[13px] font-medium">{sc.symbol}</span>
                    </div>
                    <span className={cn(
                      "text-[11px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
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
      <div className="glass-card spotlight p-4" onMouseMove={handleSpotlight}>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-6 w-6 rounded-md flex items-center justify-center bg-foreground/10">
            <TrendingUp className="h-3.5 w-3.5 text-foreground/60" />
          </div>
          <span className="text-[13px] font-medium text-muted-foreground uppercase tracking-wider">Key Markets</span>
        </div>
        <div className="space-y-1.5">
          {KEY_MARKETS.map((m) => {
            const q = quotes[m.id];
            const change = q?.change || 0;
            const pct = q?.changePercent || 0;
            return (
              <div key={m.id} className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-muted-foreground">{m.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-[13px] font-mono font-semibold", change > 0 ? "text-bullish" : change < 0 ? "text-bearish" : "text-muted-foreground")}>
                    {change > 0 ? "+" : ""}{change.toFixed(m.decimals)}
                  </span>
                  <span className={cn("text-[11px] font-mono px-1 py-0.5 rounded", pct > 0 ? "bg-bullish/12 text-bullish" : pct < 0 ? "bg-bearish/12 text-bearish" : "bg-muted text-muted-foreground")}>
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
