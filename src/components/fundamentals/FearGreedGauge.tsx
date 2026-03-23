"use client";

import { useFearGreed } from "@/lib/hooks/useMarketData";
import { GlassCard } from "@/components/common/GlassCard";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { CardSkeleton } from "@/components/common/Skeletons";

function getGaugeColor(value: number): string {
  if (value <= 20) return "var(--bearish)";
  if (value <= 40) return "#ef8b4f";
  if (value <= 60) return "var(--neutral-accent)";
  if (value <= 80) return "#8bc34a";
  return "var(--bullish)";
}

function getGaugeLabel(value: number): string {
  if (value <= 20) return "Extreme Fear";
  if (value <= 40) return "Fear";
  if (value <= 60) return "Neutral";
  if (value <= 80) return "Greed";
  return "Extreme Greed";
}

const SEGMENTS = [
  { label: "Extreme Fear", color: "var(--bearish)", range: [0, 20] },
  { label: "Fear", color: "#ef8b4f", range: [20, 40] },
  { label: "Neutral", color: "var(--neutral-accent)", range: [40, 60] },
  { label: "Greed", color: "#8bc34a", range: [60, 80] },
  { label: "Extreme Greed", color: "var(--bullish)", range: [80, 100] },
];

export function FearGreedGauge() {
  const { data, isLoading } = useFearGreed();

  if (isLoading) return <CardSkeleton lines={3} />;

  const fg = data?.current || { value: 50, label: "Neutral", timestamp: 0, previousClose: 50, previousWeek: 50, previousMonth: 50 };
  const color = getGaugeColor(fg.value);
  const label = fg.label || getGaugeLabel(fg.value);

  return (
    <GlassCard delay={0.15}>
      <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-3">
        Fear & Greed Index
      </h3>

      {/* Value */}
      <div className="flex items-baseline gap-2 mb-3">
        <AnimatedNumber
          value={fg.value}
          format={(n) => Math.round(n).toString()}
          className="text-2xl font-bold font-mono"
        />
        <span className="text-xs font-semibold" style={{ color }}>{label}</span>
      </div>

      {/* Horizontal segmented bar */}
      <div className="relative mb-3">
        <div className="flex h-2 rounded-full overflow-hidden gap-px">
          {SEGMENTS.map((seg) => (
            <div
              key={seg.label}
              className="flex-1"
              style={{
                backgroundColor: seg.color,
                opacity: fg.value >= seg.range[0] && fg.value < seg.range[1] ? 1 : 0.2,
              }}
            />
          ))}
        </div>
        {/* Marker */}
        <div
          className="absolute top-[-2px] h-3 w-0.5 bg-foreground rounded-full transition-all duration-500"
          style={{ left: `${fg.value}%` }}
        />
      </div>

      {/* Previous values */}
      <div className="flex items-center gap-3">
        {[
          { label: "Yesterday", value: fg.previousClose },
          { label: "Week", value: fg.previousWeek },
          { label: "Month", value: fg.previousMonth },
        ].map(({ label: l, value }) => (
          <div key={l} className="flex items-center gap-1">
            <span className="text-[12px] text-muted-foreground">{l}</span>
            <span className="text-[12px] font-mono font-medium" style={{ color: getGaugeColor(value) }}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
