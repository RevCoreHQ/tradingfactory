"use client";

import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { cn } from "@/lib/utils";

interface SparklineChartProps {
  data: number[];
  color?: string;
  height?: number;
  showGradient?: boolean;
  className?: string;
}

export function SparklineChart({
  data,
  color,
  height = 40,
  showGradient = true,
  className,
}: SparklineChartProps) {
  if (data.length < 2) return null;

  const autoColor = color || (data[data.length - 1] >= data[0] ? "var(--bullish)" : "var(--bearish)");
  const chartData = data.map((value, index) => ({ index, value }));
  const gradientId = `sparkline-${Math.random().toString(36).slice(2)}`;

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            {showGradient && (
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={autoColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={autoColor} stopOpacity={0} />
              </linearGradient>
            )}
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={autoColor}
            strokeWidth={1.5}
            fill={showGradient ? `url(#${gradientId})` : "none"}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
