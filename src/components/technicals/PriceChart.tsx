"use client";

import { useEffect, useRef, useState } from "react";
import { useTechnicalData } from "@/lib/hooks/useTechnicalData";
import { useMarketStore } from "@/lib/store/market-store";
import { GlassCard } from "@/components/common/GlassCard";
import { ChartSkeleton } from "@/components/common/Skeletons";

export function PriceChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<unknown>(null);
  const candleSeriesRef = useRef<unknown>(null);
  const [chartReady, setChartReady] = useState(false);

  const { candles, isLoading } = useTechnicalData();
  const instrument = useMarketStore((s) => s.selectedInstrument);
  const timeframe = useMarketStore((s) => s.selectedTimeframe);
  const setTimeframe = useMarketStore((s) => s.setSelectedTimeframe);

  // Dynamically import lightweight-charts (browser-only)
  useEffect(() => {
    if (!chartContainerRef.current) return;

    let chart: unknown;
    let resizeObserver: ResizeObserver;

    import("lightweight-charts").then((lc) => {
      if (!chartContainerRef.current) return;

      chart = lc.createChart(chartContainerRef.current, {
        layout: {
          background: { type: lc.ColorType.Solid, color: "transparent" },
          textColor: "rgba(255, 255, 255, 0.5)",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "rgba(255, 255, 255, 0.03)" },
          horzLines: { color: "rgba(255, 255, 255, 0.03)" },
        },
        crosshair: {
          vertLine: { color: "rgba(255, 255, 255, 0.2)", width: 1, style: 2 },
          horzLine: { color: "rgba(255, 255, 255, 0.2)", width: 1, style: 2 },
        },
        rightPriceScale: {
          borderColor: "rgba(255, 255, 255, 0.05)",
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: {
          borderColor: "rgba(255, 255, 255, 0.05)",
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: true,
        handleScale: true,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = chart as any;
      const candleSeries = c.addSeries(lc.CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e80",
        wickDownColor: "#ef444480",
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      setChartReady(true);

      const handleResize = () => {
        if (chartContainerRef.current) {
          c.applyOptions({ width: chartContainerRef.current.clientWidth });
        }
      };

      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(chartContainerRef.current!);
    });

    return () => {
      resizeObserver?.disconnect();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (chart) (chart as any).remove();
    };
  }, []);

  // Update data when candles change
  useEffect(() => {
    if (!candleSeriesRef.current || !chartReady || candles.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const series = candleSeriesRef.current as any;
    const chartData = candles.map((c) => ({
      time: c.timestamp / 1000,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    series.setData(chartData);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chartRef.current as any)?.timeScale().fitContent();
  }, [candles, chartReady]);

  if (isLoading) return <ChartSkeleton />;

  const timeframes = ["1min", "5min", "15min", "1h", "4h", "1d"];

  return (
    <GlassCard className="h-full" delay={0.05}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{instrument.symbol} Chart</h3>
        <div className="flex gap-1">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                timeframe === tf
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div ref={chartContainerRef} className="h-[300px] lg:h-[350px]" />

      {candles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">Add API keys to see chart data</p>
        </div>
      )}
    </GlassCard>
  );
}
