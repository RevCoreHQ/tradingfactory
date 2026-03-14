"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
  colorize?: boolean;
}

export function AnimatedNumber({
  value,
  format = (n) => n.toFixed(2),
  duration = 600,
  className,
  colorize = false,
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = prevValue.current;
    const diff = value - startValue;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + diff * eased);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        prevValue.current = value;
      }
    };

    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [value, duration]);

  const colorClass = colorize
    ? displayValue > 0
      ? "text-bullish"
      : displayValue < 0
        ? "text-bearish"
        : "text-neutral-accent"
    : "";

  return (
    <span className={cn("tabular-nums font-mono transition-colors duration-300", colorClass, className)}>
      {format(displayValue)}
    </span>
  );
}
