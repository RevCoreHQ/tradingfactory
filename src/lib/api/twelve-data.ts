import { checkRateLimit } from "./rate-limiter";
import type { OHLCV } from "@/lib/types/market";

const BASE_URL = "https://api.twelvedata.com";

function getApiKey(): string {
  return process.env.TWELVE_DATA_API_KEY || "";
}

/**
 * Twelve Data forex candles. Free tier: 800 calls/day, 8/min.
 * Symbols use format "EUR/USD", "XAU/USD", etc.
 */
export async function fetchTwelveDataCandles(
  symbol: string,
  interval: string,
  outputsize: number = 200
): Promise<OHLCV[]> {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  const { allowed } = checkRateLimit("twelvedata");
  if (!allowed) return [];

  const url = new URL(`${BASE_URL}/time_series`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("outputsize", String(outputsize));
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url.toString(), { next: { revalidate: 300 } });
  if (!res.ok) return [];

  const data = await res.json();

  if (data.status === "error" || !data.values) return [];

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
  if (!apiKey) return null;

  const { allowed } = checkRateLimit("twelvedata");
  if (!allowed) return null;

  const url = new URL(`${BASE_URL}/price`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", apiKey);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.price) return parseFloat(data.price);
    return null;
  } catch {
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
