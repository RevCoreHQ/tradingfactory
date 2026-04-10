"use client";

import { useEffect, useRef, useState } from "react";
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

/** Map timeframe to a sensible default zoom range */
const TV_RANGE_MAP: Record<string, string> = {
  "1min": "1D",
  "5min": "5D",
  "15min": "5D",
  "15m": "5D",
  "30min": "1M",
  "1h": "1M",
  "4h": "3M",
  "1d": "12M",
  "1w": "60M",
};

export function TradingViewChart({ heightClass }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instrument = useMarketStore((s) => s.selectedInstrument);
  const timeframe = useMarketStore((s) => s.selectedTimeframe);
  const [isDark, setIsDark] = useState(false);

  // Detect theme from document class
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const tvSymbol = TV_SYMBOL_MAP[instrument.id] ?? `FX:${instrument.symbol.replace("/", "")}`;
  const tvInterval = TV_INTERVAL_MAP[timeframe] ?? "60";
  const tvRange = TV_RANGE_MAP[timeframe] ?? "1M";

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    // Clear previous widget
    root.innerHTML = "";

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
      range: tvRange,
      timezone: "Etc/UTC",
      theme: isDark ? "dark" : "light",
      style: "1",
      locale: "en",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    widgetContainer.appendChild(script);
    root.appendChild(widgetContainer);

    return () => {
      root.innerHTML = "";
    };
  }, [tvSymbol, tvInterval, tvRange, isDark]);

  return (
    <div className={`rounded-lg overflow-hidden border border-[var(--border-primary)] ${heightClass || "h-[400px] lg:h-[500px]"}`}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
