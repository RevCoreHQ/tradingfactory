"use client";

import { GlassCard } from "@/components/common/GlassCard";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { useMarketStore } from "@/lib/store/market-store";
import { cn } from "@/lib/utils";

const MOCK_CORRELATIONS: Record<string, Record<string, number>> = {
  EUR_USD: { EUR_USD: 1, GBP_USD: 0.85, AUD_USD: 0.75, NZD_USD: 0.7, USD_JPY: -0.65, USD_CAD: -0.6, USD_CHF: -0.82, XAU_USD: 0.45, BTC_USD: 0.3, ETH_USD: 0.32, US100: 0.4, US30: 0.35, SPX500: 0.38, US2000: 0.3 },
  GBP_USD: { EUR_USD: 0.85, GBP_USD: 1, AUD_USD: 0.68, NZD_USD: 0.62, USD_JPY: -0.55, USD_CAD: -0.55, USD_CHF: -0.75, XAU_USD: 0.38, BTC_USD: 0.25, ETH_USD: 0.27, US100: 0.35, US30: 0.3, SPX500: 0.33, US2000: 0.25 },
  AUD_USD: { EUR_USD: 0.75, GBP_USD: 0.68, AUD_USD: 1, NZD_USD: 0.88, USD_JPY: -0.45, USD_CAD: -0.5, USD_CHF: -0.65, XAU_USD: 0.55, BTC_USD: 0.4, ETH_USD: 0.42, US100: 0.5, US30: 0.45, SPX500: 0.48, US2000: 0.42 },
  NZD_USD: { EUR_USD: 0.7, GBP_USD: 0.62, AUD_USD: 0.88, NZD_USD: 1, USD_JPY: -0.4, USD_CAD: -0.45, USD_CHF: -0.6, XAU_USD: 0.48, BTC_USD: 0.35, ETH_USD: 0.37, US100: 0.45, US30: 0.4, SPX500: 0.43, US2000: 0.38 },
  USD_JPY: { EUR_USD: -0.65, GBP_USD: -0.55, AUD_USD: -0.45, NZD_USD: -0.4, USD_JPY: 1, USD_CAD: 0.55, USD_CHF: 0.6, XAU_USD: -0.4, BTC_USD: -0.15, ETH_USD: -0.18, US100: 0.2, US30: 0.25, SPX500: 0.22, US2000: 0.15 },
  USD_CAD: { EUR_USD: -0.6, GBP_USD: -0.55, AUD_USD: -0.5, NZD_USD: -0.45, USD_JPY: 0.55, USD_CAD: 1, USD_CHF: 0.58, XAU_USD: -0.35, BTC_USD: -0.2, ETH_USD: -0.22, US100: -0.3, US30: -0.25, SPX500: -0.28, US2000: -0.2 },
  USD_CHF: { EUR_USD: -0.82, GBP_USD: -0.75, AUD_USD: -0.65, NZD_USD: -0.6, USD_JPY: 0.6, USD_CAD: 0.58, USD_CHF: 1, XAU_USD: -0.5, BTC_USD: -0.25, ETH_USD: -0.27, US100: -0.35, US30: -0.3, SPX500: -0.33, US2000: -0.25 },
  XAU_USD: { EUR_USD: 0.45, GBP_USD: 0.38, AUD_USD: 0.55, NZD_USD: 0.48, USD_JPY: -0.4, USD_CAD: -0.35, USD_CHF: -0.5, XAU_USD: 1, BTC_USD: 0.35, ETH_USD: 0.3, US100: -0.25, US30: -0.2, SPX500: -0.22, US2000: -0.18 },
  BTC_USD: { EUR_USD: 0.3, GBP_USD: 0.25, AUD_USD: 0.4, NZD_USD: 0.35, USD_JPY: -0.15, USD_CAD: -0.2, USD_CHF: -0.25, XAU_USD: 0.35, BTC_USD: 1, ETH_USD: 0.92, US100: 0.65, US30: 0.5, SPX500: 0.55, US2000: 0.48 },
  ETH_USD: { EUR_USD: 0.32, GBP_USD: 0.27, AUD_USD: 0.42, NZD_USD: 0.37, USD_JPY: -0.18, USD_CAD: -0.22, USD_CHF: -0.27, XAU_USD: 0.3, BTC_USD: 0.92, ETH_USD: 1, US100: 0.62, US30: 0.48, SPX500: 0.52, US2000: 0.45 },
  US100: { EUR_USD: 0.4, GBP_USD: 0.35, AUD_USD: 0.5, NZD_USD: 0.45, USD_JPY: 0.2, USD_CAD: -0.3, USD_CHF: -0.35, XAU_USD: -0.25, BTC_USD: 0.65, ETH_USD: 0.62, US100: 1, US30: 0.92, SPX500: 0.97, US2000: 0.82 },
  US30: { EUR_USD: 0.35, GBP_USD: 0.3, AUD_USD: 0.45, NZD_USD: 0.4, USD_JPY: 0.25, USD_CAD: -0.25, USD_CHF: -0.3, XAU_USD: -0.2, BTC_USD: 0.5, ETH_USD: 0.48, US100: 0.92, US30: 1, SPX500: 0.95, US2000: 0.85 },
  SPX500: { EUR_USD: 0.38, GBP_USD: 0.33, AUD_USD: 0.48, NZD_USD: 0.43, USD_JPY: 0.22, USD_CAD: -0.28, USD_CHF: -0.33, XAU_USD: -0.22, BTC_USD: 0.55, ETH_USD: 0.52, US100: 0.97, US30: 0.95, SPX500: 1, US2000: 0.88 },
  US2000: { EUR_USD: 0.3, GBP_USD: 0.25, AUD_USD: 0.42, NZD_USD: 0.38, USD_JPY: 0.15, USD_CAD: -0.2, USD_CHF: -0.25, XAU_USD: -0.18, BTC_USD: 0.48, ETH_USD: 0.45, US100: 0.82, US30: 0.85, SPX500: 0.88, US2000: 1 },
};

function getCorrelationColor(value: number): string {
  if (value > 0.7) return "bg-bullish/60";
  if (value > 0.3) return "bg-bullish/30";
  if (value > -0.3) return "bg-white/10";
  if (value > -0.7) return "bg-bearish/30";
  return "bg-bearish/60";
}

function getCorrelationText(value: number): string {
  if (value > 0.7) return "text-bullish";
  if (value > 0.3) return "text-bullish/70";
  if (value > -0.3) return "text-muted-foreground";
  if (value > -0.7) return "text-bearish/70";
  return "text-bearish";
}

export function IntermarketCorrelation() {
  const selectedInstrument = useMarketStore((s) => s.selectedInstrument);
  const selectedId = selectedInstrument.id;
  const others = INSTRUMENTS.filter((i) => i.id !== selectedId);

  return (
    <GlassCard delay={0.4}>
      <h3 className="text-sm font-semibold mb-3">
        Correlations — {selectedInstrument.symbol}
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
        {others.map((inst) => {
          const corr = MOCK_CORRELATIONS[selectedId]?.[inst.id] || 0;
          return (
            <div
              key={inst.id}
              className={cn(
                "flex items-center justify-between px-2 py-1.5 rounded-lg text-xs",
                getCorrelationColor(corr)
              )}
              title={`${selectedInstrument.symbol} vs ${inst.symbol}: ${corr.toFixed(2)}`}
            >
              <span className="font-mono text-[10px] text-muted-foreground">{inst.symbol}</span>
              <span className={cn("font-mono text-[11px] font-medium", getCorrelationText(corr))}>
                {corr > 0 ? "+" : ""}{corr.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-4 mt-3">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-bearish/60" />
          <span className="text-[9px] text-muted-foreground">Strong -</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-white/10" />
          <span className="text-[9px] text-muted-foreground">Neutral</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-bullish/60" />
          <span className="text-[9px] text-muted-foreground">Strong +</span>
        </div>
      </div>
    </GlassCard>
  );
}
