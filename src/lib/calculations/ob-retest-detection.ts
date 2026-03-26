import type { OHLCV } from "@/lib/types/market";
import type { SupplyDemandZone } from "@/lib/types/deep-analysis";

// ==================== CONSTANTS ====================

const MIN_CANDLES_SINCE_OB = 5; // Minimum bars between OB creation and retest
const ZONE_BUFFER_ATR = 0.2; // How far outside the zone still counts

// ==================== RESULT TYPE ====================

export interface OBRetestResult {
  detected: boolean;
  direction: "bullish" | "bearish";
  zone: { type: "supply" | "demand"; high: number; low: number; strength: number } | null;
  displacementMagnitude: number;
  proximityPercent: number;
  volumeConfirmed: boolean;
  strength: number;
}

// ==================== SCORING ====================

function scoreOBRetest(
  zone: SupplyDemandZone,
  proximityPercent: number,
  volumeConfirmed: boolean,
  lastCandle: OHLCV,
  candles: OHLCV[]
): number {
  // Component 1: Zone strength (0-30 pts)
  const zoneScore = (zone.strength / 100) * 30;

  // Component 2: Displacement magnitude (0-25 pts)
  const displacementScore = Math.min(25, (zone.impulseMagnitude / 4) * 25);

  // Component 3: Proximity to zone (0-20 pts)
  let proximityScore: number;
  if (proximityPercent >= 20) {
    proximityScore = 20; // Deep inside zone body
  } else if (proximityPercent > 0) {
    proximityScore = 12; // Touching edge
  } else {
    proximityScore = 6; // Near zone (within buffer)
  }

  // Component 4: Volume confirmation (0-15 pts)
  // Healthy pullback has declining volume vs average
  const recentVolumes = candles.slice(-20).map((c) => c.volume);
  const avgVol =
    recentVolumes.reduce((s, v) => s + v, 0) / recentVolumes.length;
  let volScore = 0;
  if (avgVol > 0) {
    const volRatio = lastCandle.volume / avgVol;
    if (volRatio < 0.8) volScore = 15;
    else if (volRatio < 1.0) volScore = 8;
  }

  // Component 5: Freshness (0-10 pts)
  let freshnessScore: number;
  if (zone.freshness === "fresh") {
    freshnessScore = 10;
  } else if (zone.testCount <= 1) {
    freshnessScore = 6;
  } else {
    freshnessScore = 2;
  }

  return Math.min(
    100,
    Math.round(
      zoneScore + displacementScore + proximityScore + volScore + freshnessScore
    )
  );
}

// ==================== DETECTION ====================

/**
 * Detect Order Block Retest — price returning to a valid, unbroken OB zone
 * after displacement away from it.
 *
 * Demand OB retest → bullish (buying opportunity at demand zone)
 * Supply OB retest → bearish (selling opportunity at supply zone)
 */
export function detectOBRetest(
  candles: OHLCV[],
  supplyZones: SupplyDemandZone[],
  demandZones: SupplyDemandZone[],
  atrValue: number
): OBRetestResult {
  const noSignal: OBRetestResult = {
    detected: false,
    direction: "bullish",
    zone: null,
    displacementMagnitude: 0,
    proximityPercent: 0,
    volumeConfirmed: false,
    strength: 0,
  };

  if (candles.length < 10 || atrValue <= 0) return noSignal;

  const lastCandle = candles[candles.length - 1];
  const lastCandleIndex = candles.length - 1;
  const currentPrice = lastCandle.close;
  const buffer = atrValue * ZONE_BUFFER_ATR;

  const allZones = [...demandZones, ...supplyZones];

  // Filter to valid Order Blocks only
  const validOBs = allZones.filter(
    (z) =>
      z.isOrderBlock &&
      z.freshness !== "broken" &&
      lastCandleIndex - z.candleIndex >= MIN_CANDLES_SINCE_OB
  );

  if (validOBs.length === 0) return noSignal;

  // Find the best OB retest (strongest zone that price is near)
  let bestResult: OBRetestResult | null = null;
  let bestStrength = 0;

  for (const zone of validOBs) {
    // Check if current price is near or inside the zone
    const isNearZone =
      currentPrice >= zone.priceLow - buffer &&
      currentPrice <= zone.priceHigh + buffer;

    if (!isNearZone) continue;

    // Calculate how deep into the zone price is (0-100%)
    const zoneRange = zone.priceHigh - zone.priceLow;
    let proximityPercent = 0;
    if (zoneRange > 0) {
      if (
        currentPrice >= zone.priceLow &&
        currentPrice <= zone.priceHigh
      ) {
        // Inside zone — measure depth
        if (zone.type === "demand") {
          proximityPercent =
            ((zone.priceHigh - currentPrice) / zoneRange) * 100;
        } else {
          proximityPercent =
            ((currentPrice - zone.priceLow) / zoneRange) * 100;
        }
      }
      // else: outside zone but within buffer → proximityPercent stays 0
    }

    // Volume confirmation: retest candle volume below average
    const recentVolumes = candles.slice(-20).map((c) => c.volume);
    const avgVol =
      recentVolumes.reduce((s, v) => s + v, 0) / recentVolumes.length;
    const volumeConfirmed = avgVol > 0 && lastCandle.volume / avgVol < 1.0;

    const direction: "bullish" | "bearish" =
      zone.type === "demand" ? "bullish" : "bearish";

    const strength = scoreOBRetest(
      zone,
      proximityPercent,
      volumeConfirmed,
      lastCandle,
      candles
    );

    if (strength > bestStrength) {
      bestStrength = strength;
      bestResult = {
        detected: true,
        direction,
        zone: {
          type: zone.type,
          high: zone.priceHigh,
          low: zone.priceLow,
          strength: zone.strength,
        },
        displacementMagnitude: zone.impulseMagnitude,
        proximityPercent,
        volumeConfirmed,
        strength,
      };
    }
  }

  return bestResult ?? noSignal;
}
