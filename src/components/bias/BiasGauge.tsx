"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { useMemo } from "react";
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

export function BiasGauge({ bias, confidence, direction, size = "lg", className }: BiasGaugeProps) {
  const isLarge = size === "lg";
  const width = isLarge ? 280 : 120;
  const height = isLarge ? 160 : 80;
  const cx = width / 2;
  const cy = isLarge ? 140 : 70;
  const radius = isLarge ? 110 : 50;
  const strokeWidth = isLarge ? 12 : 6;

  // Animated bias value
  const springBias = useSpring(bias, { stiffness: 80, damping: 20, mass: 1 });
  const needleAngle = useTransform(springBias, [-100, 100], [180, 0]);

  // Arc path for the gauge background
  const arcPath = useMemo(() => {
    const startAngle = Math.PI;
    const endAngle = 0;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy - radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy - radius * Math.sin(endAngle);
    return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`;
  }, [cx, cy, radius]);

  // Confidence arc (thinner, outer)
  const confRadius = radius + (isLarge ? 20 : 8);
  const confArc = useMemo(() => {
    const confAngle = (confidence / 100) * Math.PI;
    const startAngle = Math.PI / 2 + confAngle / 2;
    const endAngle = Math.PI / 2 - confAngle / 2;
    const x1 = cx + confRadius * Math.cos(startAngle);
    const y1 = cy - confRadius * Math.sin(startAngle);
    const x2 = cx + confRadius * Math.cos(endAngle);
    const y2 = cy - confRadius * Math.sin(endAngle);
    const largeArc = confAngle > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${confRadius} ${confRadius} 0 ${largeArc} 1 ${x2} ${y2}`;
  }, [cx, cy, confRadius, confidence]);

  const biasColor = getBiasColor(direction);
  const label = getBiasLabel(direction);

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg
        width={width}
        height={height + (isLarge ? 10 : 5)}
        viewBox={`0 0 ${width} ${height + (isLarge ? 10 : 5)}`}
      >
        <defs>
          {/* Gradient for the main arc */}
          <linearGradient id={`gauge-gradient-${size}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--bearish)" />
            <stop offset="35%" stopColor="var(--bearish)" stopOpacity="0.5" />
            <stop offset="50%" stopColor="var(--neutral-accent)" />
            <stop offset="65%" stopColor="var(--bullish)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--bullish)" />
          </linearGradient>

          {/* Glow filter */}
          <filter id={`glow-${size}`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background arc */}
        <path
          d={arcPath}
          fill="none"
          stroke="oklch(0.20 0 0)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Colored arc */}
        <path
          d={arcPath}
          fill="none"
          stroke={`url(#gauge-gradient-${size})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.8}
        />

        {/* Confidence arc */}
        {confidence > 0 && (
          <path
            d={confArc}
            fill="none"
            stroke={biasColor}
            strokeWidth={isLarge ? 3 : 1.5}
            strokeLinecap="round"
            opacity={0.4}
          />
        )}

        {/* Needle */}
        <motion.g
          style={{ rotate: needleAngle, transformOrigin: `${cx}px ${cy}px` }}
          filter={`url(#glow-${size})`}
        >
          <line
            x1={cx}
            y1={cy}
            x2={cx + radius - (isLarge ? 20 : 10)}
            y2={cy}
            stroke="white"
            strokeWidth={isLarge ? 2.5 : 1.5}
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r={isLarge ? 5 : 3} fill="white" />
        </motion.g>

        {/* Scale labels for large gauge */}
        {isLarge && (
          <>
            <text x={cx - radius - 5} y={cy + 20} fill="var(--bearish)" fontSize="10" textAnchor="middle" fontFamily="monospace">-100</text>
            <text x={cx} y={cy - radius - 8} fill="var(--neutral-accent)" fontSize="10" textAnchor="middle" fontFamily="monospace">0</text>
            <text x={cx + radius + 5} y={cy + 20} fill="var(--bullish)" fontSize="10" textAnchor="middle" fontFamily="monospace">+100</text>
          </>
        )}
      </svg>

      {/* Value display */}
      <div className={cn("text-center", isLarge ? "-mt-6" : "-mt-2")}>
        <motion.div
          className={cn("font-mono font-bold tabular-nums", isLarge ? "text-3xl" : "text-lg")}
          style={{ color: biasColor }}
          key={bias}
          initial={{ scale: 0.9, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {bias > 0 ? "+" : ""}{Math.round(bias)}
        </motion.div>
        <div
          className={cn("font-semibold tracking-wider uppercase", isLarge ? "text-sm mt-1" : "text-[10px]")}
          style={{ color: biasColor }}
        >
          {label}
        </div>
        {isLarge && (
          <div className="text-xs text-muted-foreground mt-1">
            {confidence.toFixed(0)}% confidence
          </div>
        )}
      </div>
    </div>
  );
}
