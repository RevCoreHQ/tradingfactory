import { checkRateLimit } from "./rate-limiter";
import type { OHLCV } from "@/lib/types/market";

const BASE_URL = "https://api.twelvedata.com";

function getApiKey(): string {
  return process.env.TWELVE_DATA_API_KEY || "";
}

/**
 * Twelve Data forex candles. Paid tier: 55 req/min.
 * Symbols use format "EUR/USD", "XAU/USD", etc.
 */
export async function fetchTwelveDataCandles(
  symbol: string,
  interval: string,
  outputsize: number = 200
): Promise<OHLCV[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[TwelveData] No API key — skipping candles for", symbol);
    return [];
  }

  const { allowed } = checkRateLimit("twelvedata");
  if (!allowed) {
    console.warn("[TwelveData] Rate limited — skipping candles for", symbol);
    return [];
  }

  const url = new URL(`${BASE_URL}/time_series`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("outputsize", String(outputsize));
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url.toString(), { next: { revalidate: 300 } });
  if (!res.ok) {
    console.warn(`[TwelveData] HTTP ${res.status} for candles ${symbol}`);
    return [];
  }

  const data = await res.json();

  if (data.status === "error" || !data.values) {
    console.warn(`[TwelveData] API error for ${symbol}:`, data.message || data.status || "no values");
    return [];
  }

  return data.values
    .map((v: { datetime: string; open: string; high: string; low: string; close: string; volume: string }) => ({
      timestamp: new Date(v.datetime).getTime(),
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: parseInt(v.volume) || 0,
    }))
    .reverse(); // Twelve Data returns newest first
}

/**
 * Fetch latest price for a single symbol from Twelve Data /price endpoint.
 * Returns the current price or null on failure.
 */
export async function fetchTwelveDataPrice(symbol: string): Promise<number | null> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[TwelveData] No API key — skipping price for", symbol);
    return null;
  }

  const { allowed } = checkRateLimit("twelvedata");
  if (!allowed) {
    console.warn("[TwelveData] Rate limited — skipping price for", symbol);
    return null;
  }

  const url = new URL(`${BASE_URL}/price`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", apiKey);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 60 } });
    if (!res.ok) {
      console.warn(`[TwelveData] HTTP ${res.status} for price ${symbol}`);
      return null;
    }
    const data = await res.json();
    if (data.price) return parseFloat(data.price);
    console.warn(`[TwelveData] No price data for ${symbol}:`, data.message || "empty");
    return null;
  } catch (err) {
    console.warn(`[TwelveData] Price fetch failed for ${symbol}:`, err);
    return null;
  }
}

// Twelve Data interval map (matches our timeframe strings)
export const TWELVE_DATA_INTERVALS: Record<string, string> = {
  "1min": "1min",
  "5min": "5min",
  "15min": "15min",
  "30min": "30min",
  "1h": "1h",
  "4h": "4h",
  "1d": "1day",
  "1w": "1week",
};
