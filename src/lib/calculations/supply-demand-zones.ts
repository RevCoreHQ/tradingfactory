import type { OHLCV } from "@/lib/types/market";
import type { SupplyDemandZone } from "@/lib/types/deep-analysis";

const MIN_IMPULSE_ATR = 1.5;
const MIN_BODY_RATIO = 0.5;
const MAX_IMPULSE_CANDLES = 3;
const MAX_ZONES = 10;

// ICT Order Block thresholds — stricter than regular S/D zones
const MIN_OB_IMPULSE_ATR = 2.0;
const MIN_OB_BODY_RATIO = 0.6;

function bodyRatio(c: OHLCV): number {
  const range = c.high - c.low;
  if (range === 0) return 0;
  return Math.abs(c.close - c.open) / range;
}

function isBearish(c: OHLCV): boolean {
  return c.close < c.open;
}

function isBullish(c: OHLCV): boolean {
  return c.close > c.open;
}

/**
 * Detect supply and demand zones from OHLCV candles.
 *
 * Demand zone: large bearish candle → strong bullish impulse away
 * Supply zone: large bullish candle → strong bearish impulse away
 */
export function detectSupplyDemandZones(
  candles: OHLCV[],
  atrValue: number,
  maxAgeBars?: number
): { supplyZones: SupplyDemandZone[]; demandZones: SupplyDemandZone[] } {
  if (candles.length < 10 || atrValue <= 0) {
    return { supplyZones: [], demandZones: [] };
  }

  const rawDemand: SupplyDemandZone[] = [];
  const rawSupply: SupplyDemandZone[] = [];

  for (let i = 1; i < candles.length - MAX_IMPULSE_CANDLES; i++) {
    const base = candles[i];
    const br = bodyRatio(base);

    // --- Demand zone: bearish base → bullish impulse ---
    if (isBearish(base) && br >= MIN_BODY_RATIO) {
      let impulseHigh = -Infinity;
      let impulseValid = false;

      for (let j = 1; j <= MAX_IMPULSE_CANDLES && i + j < candles.length; j++) {
        const impulseCandle = candles[i + j];
        if (!isBullish(impulseCandle)) break;
        impulseHigh = Math.max(impulseHigh, impulseCandle.high);
        const impulseRange = impulseHigh - base.low;
        if (impulseRange >= MIN_IMPULSE_ATR * atrValue) {
          impulseValid = true;
          break;
        }
      }

      if (impulseValid) {
        const zoneHigh = Math.max(base.open, base.close);
        const zoneLow = Math.min(base.open, base.close);
        const magnitude = (impulseHigh - base.low) / atrValue;

        const { testCount, freshness } = checkZoneFreshness(
          candles, i, zoneHigh, zoneLow, "demand"
        );

        rawDemand.push({
          type: "demand",
          priceHigh: zoneHigh,
          priceLow: zoneLow,
          timestamp: base.timestamp,
          candleIndex: i,
          strength: 0, // scored below
          freshness,
          testCount,
          impulseMagnitude: magnitude,
          isOrderBlock: magnitude >= MIN_OB_IMPULSE_ATR && br >= MIN_OB_BODY_RATIO,
        });
      }
    }

    // --- Supply zone: bullish base → bearish impulse ---
    if (isBullish(base) && br >= MIN_BODY_RATIO) {
      let impulseLow = Infinity;
      let impulseValid = false;

      for (let j = 1; j <= MAX_IMPULSE_CANDLES && i + j < candles.length; j++) {
        const impulseCandle = candles[i + j];
        if (!isBearish(impulseCandle)) break;
        impulseLow = Math.min(impulseLow, impulseCandle.low);
        const impulseRange = base.high - impulseLow;
        if (impulseRange >= MIN_IMPULSE_ATR * atrValue) {
          impulseValid = true;
          break;
        }
      }

      if (impulseValid) {
        const zoneHigh = Math.max(base.open, base.close);
        const zoneLow = Math.min(base.open, base.close);
        const magnitude = (base.high - impulseLow) / atrValue;

        const { testCount, freshness } = checkZoneFreshness(
          candles, i, zoneHigh, zoneLow, "supply"
        );

        rawSupply.push({
          type: "supply",
          priceHigh: zoneHigh,
          priceLow: zoneLow,
          timestamp: base.timestamp,
          candleIndex: i,
          strength: 0,
          freshness,
          testCount,
          impulseMagnitude: magnitude,
          isOrderBlock: magnitude >= MIN_OB_IMPULSE_ATR && br >= MIN_OB_BODY_RATIO,
        });
      }
    }
  }

  // Score and filter
  const totalCandles = candles.length;
  const scoredDemand = scoreAndFilter(rawDemand, totalCandles, maxAgeBars);
  const scoredSupply = scoreAndFilter(rawSupply, totalCandles, maxAgeBars);

  return { supplyZones: scoredSupply, demandZones: scoredDemand };
}

function checkZoneFreshness(
  candles: OHLCV[],
  baseIndex: number,
  zoneHigh: number,
  zoneLow: number,
  type: "supply" | "demand"
): { testCount: number; freshness: "fresh" | "tested" | "broken" } {
  let testCount = 0;
  let broken = false;

  // Check candles after the impulse
  for (let k = baseIndex + MAX_IMPULSE_CANDLES + 1; k < candles.length; k++) {
    const c = candles[k];
    const enters = c.low <= zoneHigh && c.high >= zoneLow;
    if (!enters) continue;

    testCount++;

    // Broken if price closes through the zone
    if (type === "demand" && c.close < zoneLow) {
      broken = true;
      break;
    }
    if (type === "supply" && c.close > zoneHigh) {
      broken = true;
      break;
    }
  }

  const freshness = broken ? "broken" : testCount === 0 ? "fresh" : "tested";
  return { testCount, freshness };
}

function scoreAndFilter(
  zones: SupplyDemandZone[],
  totalCandles: number,
  maxAgeBars?: number
): SupplyDemandZone[] {
  // Remove broken zones and zones older than maxAgeBars (5-day freshness cutoff)
  const valid = zones.filter((z) => {
    if (z.freshness === "broken") return false;
    if (maxAgeBars && (totalCandles - z.candleIndex) > maxAgeBars) return false;
    return true;
  });

  // Deduplicate overlapping zones (keep stronger one)
  const deduped: SupplyDemandZone[] = [];
  for (const zone of valid) {
    const overlapping = deduped.findIndex(
      (z) => z.priceLow <= zone.priceHigh && z.priceHigh >= zone.priceLow
    );
    if (overlapping >= 0) {
      // Keep the one with greater impulse magnitude
      if (zone.impulseMagnitude > deduped[overlapping].impulseMagnitude) {
        deduped[overlapping] = zone;
      }
    } else {
      deduped.push(zone);
    }
  }

  // Score each zone
  for (const zone of deduped) {
    const impulsScore = Math.min(100, (zone.impulseMagnitude / 4) * 100);
    const freshnessScore = zone.freshness === "fresh" ? 100 : Math.max(30, 60 - zone.testCount * 10);
    const recencyScore = totalCandles > 0 ? 100 * (zone.candleIndex / totalCandles) : 50;
    const bodyScore = 80; // already filtered by MIN_BODY_RATIO

    zone.strength = Math.round(
      impulsScore * 0.35 +
      freshnessScore * 0.30 +
      recencyScore * 0.20 +
      bodyScore * 0.15
    );
  }

  return deduped
    .sort((a, b) => b.strength - a.strength)
    .slice(0, MAX_ZONES);
}
