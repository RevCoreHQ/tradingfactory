"use client";

import { useEffect, useRef, useState } from "react";
import { useTechnicalData } from "@/lib/hooks/useTechnicalData";
import { useMarketStore } from "@/lib/store/market-store";
import { GlassCard } from "@/components/common/GlassCard";
import { ChartSkeleton } from "@/components/common/Skeletons";
import { cn } from "@/lib/utils";
import type { SupplyDemandZone, ConfluenceLevel } from "@/lib/types/deep-analysis";

interface PriceChartProps {
  supplyZones?: SupplyDemandZone[];
  demandZones?: SupplyDemandZone[];
  confluenceLevels?: ConfluenceLevel[];
  tradeSetup?: {
    entryZone: [number, number];
    stopLoss: number;
    takeProfit: number[];
  } | null;
  showOverlays?: boolean;
  heightClass?: string;
}

export function PriceChart({
  supplyZones,
  demandZones,
  confluenceLevels,
  tradeSetup,
  showOverlays: externalShowOverlays,
  heightClass,
}: PriceChartProps = {}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<unknown>(null);
  const candleSeriesRef = useRef<unknown>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const priceLinesRef = useRef<any[]>([]);
  const [chartReady, setChartReady] = useState(false);
  const [showOverlays, setShowOverlays] = useState(externalShowOverlays ?? false);

  const { candles, isLoading } = useTechnicalData();
  const instrument = useMarketStore((s) => s.selectedInstrument);
  const timeframe = useMarketStore((s) => s.selectedTimeframe);
  const setTimeframe = useMarketStore((s) => s.setSelectedTimeframe);

  const hasOverlayData = !!(supplyZones?.length || demandZones?.length || confluenceLevels?.length || tradeSetup);

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

  // Draw overlays (zones, levels, trade setup)
  useEffect(() => {
    if (!candleSeriesRef.current || !chartReady) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const series = candleSeriesRef.current as any;

    // Remove old price lines
    for (const line of priceLinesRef.current) {
      try { series.removePriceLine(line); } catch { /* ignore */ }
    }
    priceLinesRef.current = [];

    if (!showOverlays) return;

    // Draw demand zones (green)
    if (demandZones) {
      for (const zone of demandZones) {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: zone.priceHigh,
            color: "rgba(34, 197, 94, 0.4)",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: false,
            title: "",
          }),
          series.createPriceLine({
            price: zone.priceLow,
            color: "rgba(34, 197, 94, 0.4)",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: false,
            title: `DZ ${zone.strength}`,
          })
        );
      }
    }

    // Draw supply zones (red)
    if (supplyZones) {
      for (const zone of supplyZones) {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: zone.priceHigh,
            color: "rgba(239, 68, 68, 0.4)",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: false,
            title: `SZ ${zone.strength}`,
          }),
          series.createPriceLine({
            price: zone.priceLow,
            color: "rgba(239, 68, 68, 0.4)",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: false,
            title: "",
          })
        );
      }
    }

    // Draw confluence levels
    if (confluenceLevels) {
      for (const level of confluenceLevels) {
        const isSupport = level.type === "support";
        priceLinesRef.current.push(
          series.createPriceLine({
            price: level.price,
            color: isSupport ? "rgba(34, 197, 94, 0.6)" : "rgba(239, 68, 68, 0.6)",
            lineWidth: 1,
            lineStyle: 1, // dotted
            axisLabelVisible: true,
            title: `C${level.score}`,
          })
        );
      }
    }

    // Draw trade setup
    if (tradeSetup) {
      // Entry zone
      priceLinesRef.current.push(
        series.createPriceLine({
          price: tradeSetup.entryZone[0],
          color: "rgba(255, 255, 255, 0.3)",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "Entry",
        }),
        series.createPriceLine({
          price: tradeSetup.entryZone[1],
          color: "rgba(255, 255, 255, 0.3)",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: false,
          title: "",
        })
      );

      // Stop loss
      priceLinesRef.current.push(
        series.createPriceLine({
          price: tradeSetup.stopLoss,
          color: "#ef4444",
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: "SL",
        })
      );

      // Take profits
      tradeSetup.takeProfit.forEach((tp, i) => {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: tp,
            color: "#22c55e",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `TP${i + 1}`,
          })
        );
      });
    }
  }, [supplyZones, demandZones, confluenceLevels, tradeSetup, showOverlays, chartReady]);

  if (isLoading) return <ChartSkeleton />;

  const timeframes = ["1min", "5min", "15min", "1h", "4h", "1d"];

  return (
    <GlassCard className="h-full" delay={0.05}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{instrument.symbol} Chart</h3>
        <div className="flex gap-1 items-center">
          {hasOverlayData && (
            <button
              onClick={() => setShowOverlays(!showOverlays)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-mono transition-colors mr-2",
                showOverlays
                  ? "bg-neutral-accent/20 text-neutral-accent"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              Zones
            </button>
          )}
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

      <div ref={chartContainerRef} className={heightClass || "h-[300px] lg:h-[350px]"} />

      {candles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">Add API keys to see chart data</p>
        </div>
      )}
    </GlassCard>
  );
}
