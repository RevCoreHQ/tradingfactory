"use client";

import { useEffect, useRef } from "react";
import { useMarketStore } from "@/lib/store/market-store";

const TV_SYMBOL_MAP: Record<string, string> = {
  EUR_USD: "FX:EURUSD",
  GBP_USD: "FX:GBPUSD",
  AUD_USD: "FX:AUDUSD",
  NZD_USD: "FX:NZDUSD",
  USD_JPY: "FX:USDJPY",
  USD_CAD: "FX:USDCAD",
  USD_CHF: "FX:USDCHF",
  XAU_USD: "OANDA:XAUUSD",
  BTC_USD: "COINBASE:BTCUSD",
  ETH_USD: "COINBASE:ETHUSD",
  US100: "PEPPERSTONE:NAS100",
  US30: "TVC:DJI",
  SPX500: "SP:SPX",
  US2000: "TVC:RUT",
};

const TV_INTERVAL_MAP: Record<string, string> = {
  "1min": "1",
  "5min": "5",
  "15min": "15",
  "30min": "30",
  "1h": "60",
  "4h": "240",
  "1d": "D",
  "1w": "W",
};

interface TradingViewChartProps {
  heightClass?: string;
}

export function TradingViewChart({ heightClass }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instrument = useMarketStore((s) => s.selectedInstrument);
  const timeframe = useMarketStore((s) => s.selectedTimeframe);

  const tvSymbol = TV_SYMBOL_MAP[instrument.id] ?? `FX:${instrument.symbol.replace("/", "")}`;
  const tvInterval = TV_INTERVAL_MAP[timeframe] ?? "60";

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = "";

    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container";
    widgetContainer.style.height = "100%";
    widgetContainer.style.width = "100%";

    const widgetInner = document.createElement("div");
    widgetInner.className = "tradingview-widget-container__widget";
    widgetInner.style.height = "100%";
    widgetInner.style.width = "100%";
    widgetContainer.appendChild(widgetInner);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: tvInterval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(0, 0, 0, 0)",
      gridColor: "rgba(255, 255, 255, 0.03)",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    widgetContainer.appendChild(script);
    containerRef.current.appendChild(widgetContainer);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [tvSymbol, tvInterval]);

  return (
    <div className={`rounded-lg overflow-hidden border border-[var(--border-primary)] ${heightClass || "h-[400px] lg:h-[500px]"}`}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
