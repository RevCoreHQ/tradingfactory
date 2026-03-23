// ==================== DATA QUALITY ====================
// Stale data detection and quality checks.

import type { OHLCV } from "@/lib/types/market";

export interface DataQualityCheck {
  isStale: boolean;
  staleDuration: number | null; // ms since last candle
  isFallbackProvider: boolean;
  warnings: string[];
}

const STALE_THRESHOLDS: Record<string, number> = {
  "5m": 10 * 60 * 1000,          // 10 min
  "15m": 30 * 60 * 1000,         // 30 min
  "1h": 2 * 60 * 60 * 1000,      // 2 hours
  "4h": 8 * 60 * 60 * 1000,      // 8 hours
  "1d": 48 * 60 * 60 * 1000,     // 48 hours (weekends)
  "1w": 14 * 24 * 60 * 60 * 1000, // 2 weeks
};

/**
 * Check if candle data is stale for the given timeframe.
 */
export function isDataStale(candles: OHLCV[], timeframe: string): boolean {
  if (candles.length === 0) return true;
  const lastTimestamp = candles[candles.length - 1].timestamp;
  // Timestamps may be in seconds (unix) — normalize to ms
  const lastMs = lastTimestamp < 1e12 ? lastTimestamp * 1000 : lastTimestamp;
  const threshold = STALE_THRESHOLDS[timeframe] ?? 2 * 60 * 60 * 1000;
  return Date.now() - lastMs > threshold;
}

/**
 * Full data quality check.
 */
export function checkDataQuality(
  candles: OHLCV[],
  timeframe: string,
  isFallback: boolean = false,
): DataQualityCheck {
  const warnings: string[] = [];
  const stale = isDataStale(candles, timeframe);
  let staleDuration: number | null = null;

  if (stale && candles.length > 0) {
    const lastTs = candles[candles.length - 1].timestamp;
    const lastMs = lastTs < 1e12 ? lastTs * 1000 : lastTs;
    staleDuration = Date.now() - lastMs;
    warnings.push(`Data stale: last candle ${Math.round(staleDuration / 60000)}min ago`);
  }

  if (isFallback) {
    warnings.push("Using fallback data provider");
  }

  if (candles.length < 50) {
    warnings.push(`Insufficient history: ${candles.length} candles (need 50+)`);
  }

  return { isStale: stale, staleDuration, isFallbackProvider: isFallback, warnings };
}
