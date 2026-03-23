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

/**
 * Batch fetch latest prices for multiple symbols in a single API call.
 * Twelve Data /price supports comma-separated symbols (counts as 1 API credit).
 * Returns a map of symbol -> price.
 */
export interface TwelveDataQuote {
  price: number;
  change: number;
  changePercent: number;
  high24h: number;
  low24h: number;
  previousClose: number;
}

export async function fetchTwelveDataBatchPrices(symbols: string[]): Promise<Record<string, number>> {
  const quotes = await fetchTwelveDataBatchQuotes(symbols);
  const result: Record<string, number> = {};
  for (const [sym, q] of Object.entries(quotes)) {
    result[sym] = q.price;
  }
  return result;
}

/**
 * Fetch batch quotes from Twelve Data /quote endpoint.
 * Returns price, change, percent_change, previous_close, high, low per symbol.
 * Same rate-limit cost as /price but includes daily change data.
 */
export async function fetchTwelveDataBatchQuotes(symbols: string[]): Promise<Record<string, TwelveDataQuote>> {
  const apiKey = getApiKey();
  if (!apiKey || symbols.length === 0) return {};

  const { allowed } = checkRateLimit("twelvedata");
  if (!allowed) {
    console.warn("[TwelveData] Rate limited — skipping batch quotes");
    return {};
  }

  const url = new URL(`${BASE_URL}/quote`);
  url.searchParams.set("symbol", symbols.join(","));
  url.searchParams.set("apikey", apiKey);

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 60 } });
    if (!res.ok) {
      console.warn(`[TwelveData] HTTP ${res.status} for batch quotes`);
      return {};
    }
    const data = await res.json();

    const result: Record<string, TwelveDataQuote> = {};

    const parseEntry = (entry: Record<string, string | number | undefined>): TwelveDataQuote | null => {
      const price = parseFloat(String(entry.close ?? entry.price ?? "0"));
      if (!price || price <= 0) return null;
      return {
        price,
        change: parseFloat(String(entry.change ?? "0")),
        changePercent: parseFloat(String(entry.percent_change ?? "0")),
        high24h: parseFloat(String(entry.high ?? price)),
        low24h: parseFloat(String(entry.low ?? price)),
        previousClose: parseFloat(String(entry.previous_close ?? price)),
      };
    };

    // Single symbol returns flat object, multiple returns { "SYM": {...}, ... }
    if (symbols.length === 1 && (data.close || data.price)) {
      const q = parseEntry(data);
      if (q) result[symbols[0]] = q;
    } else {
      for (const sym of symbols) {
        const entry = data[sym];
        if (entry) {
          const q = parseEntry(entry);
          if (q) result[sym] = q;
        }
      }
    }

    return result;
  } catch (err) {
    console.warn("[TwelveData] Batch quote fetch failed:", err);
    return {};
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
