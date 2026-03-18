"use client";

import { GlassCard } from "@/components/common/GlassCard";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { StatusBadge } from "@/components/common/StatusBadge";
import { cn } from "@/lib/utils";

interface IndicatorCardProps {
  name: string;
  value: number;
  format?: (n: number) => string;
  signal: "bullish" | "bearish" | "neutral";
  description: string;
  detail?: string;
  className?: string;
}

export function IndicatorCard({
  name,
  value,
  format = (n) => n.toFixed(2),
  signal,
  description,
  detail,
  className,
}: IndicatorCardProps) {
  return (
    <GlassCard
      accent={signal === "bullish" ? "bullish" : signal === "bearish" ? "bearish" : null}
      className={cn("p-3", className)}
      animate={false}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">{name}</span>
        <StatusBadge variant={signal}>{signal}</StatusBadge>
      </div>
      <AnimatedNumber
        value={value}
        format={format}
        className="text-xl font-bold"
        colorize
      />
      <p className="text-[10px] text-muted-foreground mt-1">{description}</p>
      {detail && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{detail}</p>}
    </GlassCard>
  );
}
