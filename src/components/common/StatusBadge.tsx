"use client";

import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  variant: "bullish" | "bearish" | "neutral" | "warning";
  children: React.ReactNode;
  pulse?: boolean;
  className?: string;
}

const variantStyles = {
  bullish: "bg-bullish/15 text-bullish border-bullish/30",
  bearish: "bg-bearish/15 text-bearish border-bearish/30",
  neutral: "bg-neutral-accent/15 text-neutral-accent border-neutral-accent/30",
  warning: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
};

const dotColors = {
  bullish: "bg-bullish",
  bearish: "bg-bearish",
  neutral: "bg-neutral-accent",
  warning: "bg-yellow-500",
};

export function StatusBadge({ variant, children, pulse = false, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {pulse && (
        <span className={cn("h-1.5 w-1.5 rounded-full pulse-dot", dotColors[variant])} />
      )}
      {children}
    </span>
  );
}
