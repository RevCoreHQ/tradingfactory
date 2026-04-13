import type { OHLCV } from "@/lib/types/market";
import type { SupplyDemandZone } from "@/lib/types/deep-analysis";
import { detectSupplyDemandZones } from "@/lib/calculations/supply-demand-zones";

export type DeskZoneRetestHint = {
  /** Max ICT demand-zone retest count overlapping the bullish mechanical pullback band. */
  demandTestsInPullbackBand: number;
  /** Max ICT supply-zone retest count overlapping the bearish mechanical bounce band. */
  supplyTestsInBounceBand: number;
};

/** ~5 sessions of 15m bars */
const SD_MAX_AGE_15M = 5 * 24 * 4;
/** ~5 sessions of 1h bars */
const SD_MAX_AGE_1H = 5 * 24;

function maxRetestOverlappingBand(
  zones: SupplyDemandZone[],
  bandLo: number,
  bandHi: number
): number {
  const lo = Math.min(bandLo, bandHi);
  const hi = Math.max(bandLo, bandHi);
  let max = 0;
  for (const z of zones) {
    if (z.priceLow <= hi && z.priceHigh >= lo) {
      max = Math.max(max, z.testCount);
    }
  }
  return max;
}

/**
 * Retest counts for supply/demand zones overlapping the same ATR mechanical entry bands as `calculateTradeSetup`.
 */
export function deskMechanicalBandRetestCounts(
  candles: OHLCV[],
  atr: number,
  anchorPrice: number,
  timeframe: "15m" | "1h"
): DeskZoneRetestHint | null {
  if (candles.length < 20 || atr <= 0 || !Number.isFinite(anchorPrice)) return null;
  const maxAge =
    timeframe === "15m"
      ? Math.min(SD_MAX_AGE_15M, candles.length)
      : Math.min(SD_MAX_AGE_1H, candles.length);
  const { demandZones, supplyZones } = detectSupplyDemandZones(candles, atr, maxAge);
  const spread = atr * 0.25;
  return {
    demandTestsInPullbackBand: maxRetestOverlappingBand(
      demandZones,
      anchorPrice - spread,
      anchorPrice
    ),
    supplyTestsInBounceBand: maxRetestOverlappingBand(
      supplyZones,
      anchorPrice,
      anchorPrice + spread
    ),
  };
}

export function deskZoneTestCountForBias(
  hint: DeskZoneRetestHint | null | undefined,
  direction: string
): number | undefined {
  if (!hint) return undefined;
  if (direction.includes("bullish")) return hint.demandTestsInPullbackBand;
  if (direction.includes("bearish")) return hint.supplyTestsInBounceBand;
  return undefined;
}
