"use client";

import { useBondYields } from "@/lib/hooks/useMarketData";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { SparklineChart } from "@/components/common/SparklineChart";
import { StatusBadge } from "@/components/common/StatusBadge";
import { getChangeClass, getSignPrefix } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

export function BondYields() {
  const { data, isLoading } = useBondYields();

  if (isLoading) {
    return (
      <div className="section-card p-3 sm:p-5 h-full">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-6 w-6 rounded-md flex items-center justify-center bg-amber/15">
            <TrendingUp className="h-3.5 w-3.5 text-[var(--amber)]" />
          </div>
          <h3 className="text-xs font-semibold text-foreground">Bond Yields & DXY</h3>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 shimmer rounded" />
          ))}
        </div>
      </div>
    );
  }

  const yields = data?.yields || [];
  const dxy = data?.dxy || { value: 0, change: 0, changePercent: 0, history: [] };

  const y2 = yields.find((y) => y.maturity === "2Y");
  const y10 = yields.find((y) => y.maturity === "10Y");
  const spread = y10 && y2 ? y10.yield - y2.yield : 0;
  const isInverted = spread < 0;

  const curveData = yields.map((y) => ({
    maturity: y.maturity,
    yield: y.yield,
  }));

  return (
    <div className="section-card p-3 sm:p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md flex items-center justify-center bg-amber/15">
            <TrendingUp className="h-3.5 w-3.5 text-[var(--amber)]" />
          </div>
          <h3 className="text-xs font-semibold text-foreground">Bond Yields & DXY</h3>
        </div>
        {isInverted && (
          <StatusBadge variant="warning">Inverted</StatusBadge>
        )}
      </div>

      {/* Yield curve chart */}
      {curveData.length > 0 && (
        <div className="h-28 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curveData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <XAxis dataKey="maturity" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }}
              />
              <Line
                type="monotone"
                dataKey="yield"
                stroke={isInverted ? "var(--bearish)" : "var(--neutral-accent)"}
                strokeWidth={2}
                dot={{ r: 4, fill: "var(--background)", stroke: isInverted ? "var(--bearish)" : "var(--neutral-accent)", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Individual yields */}
      <div className="space-y-2">
        {yields.map((y) => (
          <div key={y.maturity} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{y.maturity} Treasury</span>
            <div className="flex items-center gap-2">
              <AnimatedNumber value={y.yield} format={(n) => `${n.toFixed(2)}%`} className="font-medium" />
              <span className={cn("font-mono text-[12px]", getChangeClass(y.change))}>
                {getSignPrefix(y.change)}{y.change.toFixed(3)}
              </span>
            </div>
          </div>
        ))}

        {y10 && y2 && (
          <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
            <span className="text-muted-foreground">10Y-2Y Spread</span>
            <span className={cn("font-mono font-medium", isInverted ? "text-bearish" : "text-bullish")}>
              {spread.toFixed(3)}%
            </span>
          </div>
        )}
      </div>

      {/* DXY Section */}
      <div className="mt-4 pt-3 border-t border-border/50">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Dollar Index (DXY)</span>
          <div className="flex items-center gap-2">
            {dxy.value > 0 && (
              <>
                <AnimatedNumber value={dxy.value} format={(n) => n.toFixed(2)} className="text-xs font-medium" />
                <span className={cn("text-[12px] font-mono", getChangeClass(dxy.change))}>
                  {getSignPrefix(dxy.change)}{dxy.changePercent.toFixed(2)}%
                </span>
              </>
            )}
          </div>
        </div>
        {dxy.history.length > 2 && (
          <SparklineChart data={dxy.history.map((h) => h.value)} height={30} className="mt-2" />
        )}
      </div>
    </div>
  );
}
