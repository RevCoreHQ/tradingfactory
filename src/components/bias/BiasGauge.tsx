"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import type { BiasDirection } from "@/lib/types/bias";
import { getBiasLabel, getBiasColor } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";

interface BiasGaugeProps {
  bias: number;
  confidence: number;
  direction: BiasDirection;
  size?: "sm" | "lg";
  className?: string;
}

/** Small variant — colored number + tiny bar */
function SmallGauge({ bias, direction }: { bias: number; direction: BiasDirection }) {
  const color = getBiasColor(direction);
  const absBias = Math.abs(bias);

  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="text-sm font-mono font-bold tabular-nums"
        style={{ color }}
      >
        {bias > 0 ? "+" : ""}{Math.round(bias)}
      </span>
      <div className="w-12 h-[2px] rounded-full bg-[var(--surface-2)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${absBias}%`, backgroundColor: color, opacity: 0.7 }}
        />
      </div>
      <span className="text-[11px] uppercase tracking-wider font-medium" style={{ color }}>
        {getBiasLabel(direction)}
      </span>
    </div>
  );
}

/** Large variant — vertical linear gauge */
function LargeGauge({ bias, confidence, direction }: { bias: number; confidence: number; direction: BiasDirection }) {
  const color = getBiasColor(direction);
  const label = getBiasLabel(direction);
  const springBias = useSpring(bias, { stiffness: 80, damping: 20, mass: 1 });
  const markerPosition = useTransform(springBias, [-100, 100], [100, 0]);

  return (
    <div className="flex items-center gap-6">
      {/* Vertical bar */}
      <div className="relative w-3 h-48 rounded-full overflow-hidden flex-shrink-0">
        {/* Gradient background */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "linear-gradient(to top, var(--bearish), var(--neutral-accent), var(--bullish))",
            opacity: 0.3,
          }}
        />
        {/* Active fill from center */}
        <div className="absolute inset-0 rounded-full" style={{
          background: "linear-gradient(to top, var(--bearish), var(--neutral-accent), var(--bullish))",
          opacity: 0.7,
        }} />
        {/* Marker line */}
        <motion.div
          className="absolute left-0 right-0 h-0.5 bg-foreground rounded-full shadow-[0_0_4px_rgba(255,255,255,0.5)]"
          style={{ top: markerPosition.get() + "%" }}
          animate={{ top: `${50 - (bias / 100) * 50}%` }}
          transition={{ type: "spring", stiffness: 80, damping: 20 }}
        />
      </div>

      {/* Value + labels */}
      <div className="flex flex-col">
        <motion.span
          className="text-4xl font-mono font-bold tabular-nums leading-none"
          style={{ color }}
          key={bias}
          initial={{ scale: 0.95, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {bias > 0 ? "+" : ""}{Math.round(bias)}
        </motion.span>
        <span
          className="text-sm font-semibold uppercase tracking-widest mt-2"
          style={{ color }}
        >
          {label}
        </span>
        <span className="text-xs text-muted-foreground mt-1">
          {confidence.toFixed(0)}% confidence
        </span>

        {/* Scale reference */}
        <div className="flex items-center gap-3 mt-4 text-[12px] font-mono text-muted-foreground/50">
          <span>-100</span>
          <div className="flex-1 h-px bg-border" />
          <span>0</span>
          <div className="flex-1 h-px bg-border" />
          <span>+100</span>
        </div>
      </div>
    </div>
  );
}

export function BiasGauge({ bias, confidence, direction, size = "lg", className }: BiasGaugeProps) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      {size === "lg" ? (
        <LargeGauge bias={bias} confidence={confidence} direction={direction} />
      ) : (
        <SmallGauge bias={bias} direction={direction} />
      )}
    </div>
  );
}
