"use client";

import { useFearGreed } from "@/lib/hooks/useMarketData";
import { GlassCard } from "@/components/common/GlassCard";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { SparklineChart } from "@/components/common/SparklineChart";
import { CardSkeleton } from "@/components/common/Skeletons";
import { cn } from "@/lib/utils";

function getGaugeColor(value: number): string {
  if (value <= 20) return "var(--bearish)";
  if (value <= 40) return "#ef8b4f";
  if (value <= 60) return "var(--neutral-accent)";
  if (value <= 80) return "#8bc34a";
  return "var(--bullish)";
}

export function FearGreedGauge() {
  const { data, isLoading } = useFearGreed();

  if (isLoading) return <CardSkeleton lines={4} />;

  const fg = data?.current || { value: 50, label: "Neutral", timestamp: 0, previousClose: 50, previousWeek: 50, previousMonth: 50 };
  const color = getGaugeColor(fg.value);

  // Create simple sparkline from available data points
  const sparkData = [fg.previousMonth, fg.previousWeek, fg.previousClose, fg.value].filter(Boolean);

  return (
    <GlassCard delay={0.25}>
      <h3 className="text-sm font-semibold mb-3">Fear & Greed Index</h3>

      <div className="flex flex-col items-center">
        {/* Semi-circular gauge */}
        <svg width="180" height="100" viewBox="0 0 180 100">
          <defs>
            <linearGradient id="fg-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--bearish)" />
              <stop offset="25%" stopColor="#ef8b4f" />
              <stop offset="50%" stopColor="var(--neutral-accent)" />
              <stop offset="75%" stopColor="#8bc34a" />
              <stop offset="100%" stopColor="var(--bullish)" />
            </linearGradient>
          </defs>

          {/* Background arc */}
          <path
            d="M 15 90 A 75 75 0 0 1 165 90"
            fill="none"
            stroke="oklch(0.20 0 0)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Colored arc */}
          <path
            d="M 15 90 A 75 75 0 0 1 165 90"
            fill="none"
            stroke="url(#fg-gradient)"
            strokeWidth="10"
            strokeLinecap="round"
            opacity="0.7"
          />

          {/* Needle */}
          {(() => {
            const angle = Math.PI - (fg.value / 100) * Math.PI;
            const nx = 90 + 60 * Math.cos(angle);
            const ny = 90 - 60 * Math.sin(angle);
            return (
              <>
                <line x1="90" y1="90" x2={nx} y2={ny} stroke="white" strokeWidth="2" strokeLinecap="round" />
                <circle cx="90" cy="90" r="4" fill="white" />
              </>
            );
          })()}
        </svg>

        <div className="text-center -mt-2">
          <AnimatedNumber
            value={fg.value}
            format={(n) => Math.round(n).toString()}
            className="text-2xl font-bold font-mono"
          />
          <div className="text-xs font-semibold mt-0.5" style={{ color }}>{fg.label}</div>
        </div>
      </div>

      {/* Previous values */}
      <div className="grid grid-cols-3 gap-2 mt-4 text-center">
        {[
          { label: "Yesterday", value: fg.previousClose },
          { label: "Last Week", value: fg.previousWeek },
          { label: "Last Month", value: fg.previousMonth },
        ].map(({ label, value }) => (
          <div key={label}>
            <div className="text-[10px] text-muted-foreground">{label}</div>
            <div className="text-xs font-mono font-medium" style={{ color: getGaugeColor(value) }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {sparkData.length > 2 && (
        <SparklineChart data={sparkData} height={30} className="mt-3" />
      )}
    </GlassCard>
  );
}
