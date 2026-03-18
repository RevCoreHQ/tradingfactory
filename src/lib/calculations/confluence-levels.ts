import type { TechnicalSummary } from "@/lib/types/indicators";
import type { SupplyDemandZone, ConfluenceLevel, ConfluenceSource } from "@/lib/types/deep-analysis";

const PROXIMITY_PCT = 0.003; // 0.3% — levels within this range cluster together
const MAX_LEVELS = 8;

/**
 * Find price levels where multiple technical indicators converge.
 * Higher confluence = stronger support/resistance.
 */
export function calculateConfluenceLevels(
  currentPrice: number,
  indicators: TechnicalSummary,
  supplyZones: SupplyDemandZone[],
  demandZones: SupplyDemandZone[]
): ConfluenceLevel[] {
  const allSources: ConfluenceSource[] = [];

  // Support/Resistance levels
  for (const sr of indicators.supportResistance) {
    allSources.push({
      name: `S/R ${sr.type} (${sr.strength}x)`,
      price: sr.price,
      category: "support_resistance",
    });
  }

  // Pivot Points (daily + weekly)
  for (const pp of indicators.pivotPoints) {
    const prefix = pp.type === "daily" ? "D" : "W";
    allSources.push({ name: `${prefix}-PP`, price: pp.pivot, category: "pivot" });
    allSources.push({ name: `${prefix}-R1`, price: pp.r1, category: "pivot" });
    allSources.push({ name: `${prefix}-R2`, price: pp.r2, category: "pivot" });
    allSources.push({ name: `${prefix}-R3`, price: pp.r3, category: "pivot" });
    allSources.push({ name: `${prefix}-S1`, price: pp.s1, category: "pivot" });
    allSources.push({ name: `${prefix}-S2`, price: pp.s2, category: "pivot" });
    allSources.push({ name: `${prefix}-S3`, price: pp.s3, category: "pivot" });
  }

  // Fibonacci levels
  for (const fib of indicators.fibonacci) {
    allSources.push({
      name: `Fib ${fib.label}`,
      price: fib.price,
      category: "fibonacci",
    });
  }

  // Supply/Demand zone boundaries
  for (const zone of [...supplyZones, ...demandZones]) {
    const label = zone.type === "supply" ? "Supply" : "Demand";
    allSources.push({
      name: `${label} Zone High`,
      price: zone.priceHigh,
      category: "supply_demand",
    });
    allSources.push({
      name: `${label} Zone Low`,
      price: zone.priceLow,
      category: "supply_demand",
    });
  }

  // Moving Averages
  for (const ma of indicators.movingAverages) {
    allSources.push({
      name: `${ma.type} ${ma.period}`,
      price: ma.value,
      category: "moving_average",
    });
  }

  // VWAP
  if (indicators.vwap) {
    allSources.push({
      name: "VWAP",
      price: indicators.vwap.value,
      category: "vwap",
    });
  }

  // Filter out levels too far from current price (>5%)
  const relevant = allSources.filter(
    (s) => Math.abs(s.price - currentPrice) / currentPrice < 0.05
  );

  // Cluster levels by proximity
  const clusters: { prices: number[]; sources: ConfluenceSource[] }[] = [];

  // Sort by price for efficient clustering
  const sorted = [...relevant].sort((a, b) => a.price - b.price);

  for (const source of sorted) {
    const existing = clusters.find((c) => {
      const avgPrice = c.prices.reduce((a, b) => a + b, 0) / c.prices.length;
      return Math.abs(avgPrice - source.price) / source.price < PROXIMITY_PCT;
    });

    if (existing) {
      existing.prices.push(source.price);
      // Avoid duplicate category entries in a cluster
      const hasSameCategory = existing.sources.some(
        (s) => s.category === source.category && s.name === source.name
      );
      if (!hasSameCategory) {
        existing.sources.push(source);
      }
    } else {
      clusters.push({ prices: [source.price], sources: [source] });
    }
  }

  // Convert clusters with 2+ sources to ConfluenceLevels
  const levels: ConfluenceLevel[] = clusters
    .filter((c) => c.sources.length >= 2)
    .map((c) => {
      const avgPrice = c.prices.reduce((a, b) => a + b, 0) / c.prices.length;
      return {
        price: avgPrice,
        score: c.sources.length,
        sources: c.sources,
        type: avgPrice < currentPrice ? "support" : "resistance" as "support" | "resistance",
      };
    });

  return levels
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_LEVELS);
}
