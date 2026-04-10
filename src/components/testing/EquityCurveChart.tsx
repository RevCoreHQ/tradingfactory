"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { EquityPoint, BacktestTrade } from "@/lib/types/backtest";

interface Props {
  equityCurve: EquityPoint[];
  trades: BacktestTrade[];
}

export function EquityCurveChart({ equityCurve, trades }: Props) {
  const { pathD, ddPathD, width, height, yMin, yMax, markers, yScale } = useMemo(() => {
    if (equityCurve.length < 2) {
      return { pathD: "", ddPathD: "", width: 800, height: 300, yMin: 0, yMax: 1, markers: [], yScale: () => 0 };
    }

    const w = 800;
    const h = 300;
    const pad = { top: 20, right: 20, bottom: 30, left: 60 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    const equities = equityCurve.map((p) => p.equity);
    const eMin = Math.min(...equities) * 0.98;
    const eMax = Math.max(...equities) * 1.02;

    const xs = (i: number) => pad.left + (i / (equityCurve.length - 1)) * plotW;
    const ys = (v: number) => pad.top + plotH - ((v - eMin) / (eMax - eMin || 1)) * plotH;

    // Equity line
    const points = equityCurve.map((p, i) => `${xs(i).toFixed(1)},${ys(p.equity).toFixed(1)}`);
    const pD = `M ${points.join(" L ")}`;

    // Drawdown fill (from equity line down to baseline)
    const baselineY = ys(eMin);
    const ddPoints = equityCurve
      .map((p, i) => {
        if (p.drawdownPercent <= 0) return null;
        return { x: xs(i), y: ys(p.equity) };
      })
      .filter(Boolean) as { x: number; y: number }[];

    let ddD = "";
    if (ddPoints.length > 0) {
      ddD = `M ${ddPoints[0].x.toFixed(1)},${baselineY.toFixed(1)}`;
      for (const pt of ddPoints) {
        ddD += ` L ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      }
      ddD += ` L ${ddPoints[ddPoints.length - 1].x.toFixed(1)},${baselineY.toFixed(1)} Z`;
    }

    // Trade markers
    const tradeMarkers = equityCurve
      .filter((p) => p.tradeId)
      .map((p, idx) => {
        const trade = trades.find((t) => t.id === p.tradeId);
        const i = equityCurve.indexOf(p);
        return {
          cx: xs(i),
          cy: ys(p.equity),
          isWin: trade?.outcome === "win",
          idx,
        };
      });

    return {
      pathD: pD,
      ddPathD: ddD,
      width: w,
      height: h,
      yMin: eMin,
      yMax: eMax,
      markers: tradeMarkers,
      yScale: ys,
    };
  }, [equityCurve, trades]);

  if (equityCurve.length < 2) {
    return (
      <div className="section-card p-8 text-center text-xs text-muted-foreground/40">
        No equity data to display
      </div>
    );
  }

  // Y-axis labels
  const yLabels = [];
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const val = yMin + (i / steps) * (yMax - yMin);
    yLabels.push({
      y: yScale(val),
      label: `$${val >= 1000 ? (val / 1000).toFixed(1) + "k" : val.toFixed(0)}`,
    });
  }

  return (
    <div className="section-card p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {yLabels.map((l, i) => (
          <g key={i}>
            <line x1={60} y1={l.y} x2={780} y2={l.y} className="stroke-border/20" strokeWidth={0.5} />
            <text x={55} y={l.y + 3} textAnchor="end" className="fill-muted-foreground/40 text-[11px]" style={{ fontSize: "9px" }}>
              {l.label}
            </text>
          </g>
        ))}

        {/* Drawdown fill */}
        {ddPathD && (
          <path d={ddPathD} className="fill-bearish/10" />
        )}

        {/* Equity line */}
        <path d={pathD} fill="none" className="stroke-neutral-accent" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* Trade markers */}
        {markers.map((m) => (
          <circle
            key={m.idx}
            cx={m.cx}
            cy={m.cy}
            r={3}
            className={cn(
              m.isWin ? "fill-bullish" : "fill-bearish",
              "opacity-70"
            )}
          />
        ))}
      </svg>
    </div>
  );
}
