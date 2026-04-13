import type { TechnicalSummary } from "@/lib/types/indicators";

/** Subset of `TechnicalSummary` needed to derive S/R-style levels for desk zones. */
export type StructuralSummaryInput = Pick<
  TechnicalSummary,
  "supportResistance" | "pivotPoints" | "fibonacci"
>;

export interface StructuralLevel {
  price: number;
  type: "support" | "resistance";
  strength: number;
}

/**
 * Collect fractal S/R, pivots, and Fib levels near current price (same logic as mechanical desk).
 */
export function collectStructuralLevels(
  summary: StructuralSummaryInput,
  currentPrice: number
): StructuralLevel[] {
  const levels: StructuralLevel[] = [];

  for (const sr of summary.supportResistance) {
    levels.push({ price: sr.price, type: sr.type, strength: Math.min(10, sr.strength * 2) });
  }

  for (const pp of summary.pivotPoints) {
    const bonus = pp.type === "weekly" ? 2 : 0;
    levels.push({ price: pp.pivot, type: pp.pivot < currentPrice ? "support" : "resistance", strength: 5 + bonus });
    levels.push({ price: pp.r1, type: "resistance", strength: 4 + bonus });
    levels.push({ price: pp.r2, type: "resistance", strength: 3 + bonus });
    levels.push({ price: pp.r3, type: "resistance", strength: 2 + bonus });
    levels.push({ price: pp.s1, type: "support", strength: 4 + bonus });
    levels.push({ price: pp.s2, type: "support", strength: 3 + bonus });
    levels.push({ price: pp.s3, type: "support", strength: 2 + bonus });
  }

  for (const fib of summary.fibonacci) {
    const fibStrength = fib.level === 0.618 || fib.level === 0.382 ? 4 : 2;
    levels.push({
      price: fib.price,
      type: fib.price < currentPrice ? "support" : "resistance",
      strength: fibStrength,
    });
  }

  return levels
    .filter((l) => l.price > 0 && Math.abs(l.price - currentPrice) / currentPrice < 0.1)
    .sort((a, b) => a.price - b.price);
}
