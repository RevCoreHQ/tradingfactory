import type { BiasDirection } from "@/lib/types/bias";

export function formatPrice(price: number, decimals: number = 2): string {
  return price.toFixed(decimals);
}

export function formatPercent(value: number, decimals: number = 2): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatPips(value: number, pipSize: number): string {
  return (value / pipSize).toFixed(1);
}

export function formatCompactNumber(value: number): string {
  if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(2);
}

export function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function getBiasLabel(direction: BiasDirection): string {
  const labels: Record<BiasDirection, string> = {
    strong_bearish: "STRONG BEARISH",
    bearish: "BEARISH",
    neutral: "NEUTRAL",
    bullish: "BULLISH",
    strong_bullish: "STRONG BULLISH",
  };
  return labels[direction];
}

export function getBiasColor(direction: BiasDirection): string {
  const colors: Record<BiasDirection, string> = {
    strong_bearish: "var(--bearish)",
    bearish: "var(--bearish)",
    neutral: "var(--neutral-accent)",
    bullish: "var(--bullish)",
    strong_bullish: "var(--bullish)",
  };
  return colors[direction];
}

export function getBiasTextClass(direction: BiasDirection): string {
  const classes: Record<BiasDirection, string> = {
    strong_bearish: "text-bearish",
    bearish: "text-bearish",
    neutral: "text-neutral-accent",
    bullish: "text-bullish",
    strong_bullish: "text-bullish",
  };
  return classes[direction];
}

export function getBiasDirection(bias: number): BiasDirection {
  if (bias <= -45) return "strong_bearish";
  if (bias <= -10) return "bearish";
  if (bias >= 45) return "strong_bullish";
  if (bias >= 10) return "bullish";
  return "neutral";
}

export function getImpactColor(impact: "low" | "medium" | "high"): string {
  const colors = { low: "text-muted-foreground", medium: "text-yellow-500", high: "text-bearish" };
  return colors[impact];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return outMin + ((value - inMin) * (outMax - outMin)) / (inMax - inMin);
}

export function getChangeClass(value: number): string {
  if (value > 0) return "text-bullish";
  if (value < 0) return "text-bearish";
  return "text-muted-foreground";
}

export function getSignPrefix(value: number): string {
  return value >= 0 ? "+" : "";
}
