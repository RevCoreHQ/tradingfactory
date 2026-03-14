import { checkRateLimit } from "./rate-limiter";
import type { OHLCV, PriceQuote } from "@/lib/types/market";

const BASE_URL = "https://www.alphavantage.co/query";

const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 3600_000; // 1 hour

function getApiKey(): string {
  return process.env.ALPHA_VANTAGE_API_KEY || "";
}

async function avFetch<T>(params: Record<string, string>): Promise<T> {
  const cacheKey = JSON.stringify(params);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }

  const { allowed } = checkRateLimit("alphavantage");
  if (!allowed) {
    if (cached) return cached.data as T;
    throw new Error("Alpha Vantage rate limit exceeded and no cached data");
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("apikey", getApiKey());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Alpha Vantage error: ${res.status}`);

  const data = await res.json();
  if (data["Note"] || data["Information"]) {
    if (cached) return cached.data as T;
    throw new Error("Alpha Vantage rate limit exceeded");
  }

  cache.set(cacheKey, { data, timestamp: Date.now() });
  return data as T;
}

export async function fetchForexRate(from: string, to: string): Promise<PriceQuote> {
  const data = await avFetch<{
    "Realtime Currency Exchange Rate": {
      "1. From_Currency Code": string;
      "5. Exchange Rate": string;
      "8. Bid Price": string;
      "9. Ask Price": string;
      "6. Last Refreshed": string;
    };
  }>({
    function: "CURRENCY_EXCHANGE_RATE",
    from_currency: from,
    to_currency: to,
  });

  const rate = data["Realtime Currency Exchange Rate"];
  const mid = parseFloat(rate["5. Exchange Rate"]);
  const bid = parseFloat(rate["8. Bid Price"]) || mid;
  const ask = parseFloat(rate["9. Ask Price"]) || mid;

  return {
    instrument: `${from}_${to}`,
    bid,
    ask,
    mid,
    timestamp: Date.now(),
    change: 0,
    changePercent: 0,
    high24h: mid,
    low24h: mid,
  };
}

export async function fetchForexDaily(from: string, to: string): Promise<OHLCV[]> {
  const data = await avFetch<Record<string, Record<string, Record<string, string>>>>({
    function: "FX_DAILY",
    from_symbol: from,
    to_symbol: to,
    outputsize: "compact",
  });

  const timeSeries = data["Time Series FX (Daily)"];
  if (!timeSeries) return [];

  return Object.entries(timeSeries)
    .map(([date, values]) => ({
      timestamp: new Date(date).getTime(),
      open: parseFloat(values["1. open"]),
      high: parseFloat(values["2. high"]),
      low: parseFloat(values["3. low"]),
      close: parseFloat(values["4. close"]),
      volume: 0,
    }))
    .reverse();
}

export async function fetchForexIntraday(
  from: string,
  to: string,
  interval: string = "15min"
): Promise<OHLCV[]> {
  const data = await avFetch<Record<string, Record<string, Record<string, string>>>>({
    function: "FX_INTRADAY",
    from_symbol: from,
    to_symbol: to,
    interval,
    outputsize: "compact",
  });

  const key = Object.keys(data).find((k) => k.startsWith("Time Series"));
  if (!key) return [];

  const timeSeries = data[key];
  return Object.entries(timeSeries)
    .map(([date, values]) => ({
      timestamp: new Date(date).getTime(),
      open: parseFloat(values["1. open"]),
      high: parseFloat(values["2. high"]),
      low: parseFloat(values["3. low"]),
      close: parseFloat(values["4. close"]),
      volume: 0,
    }))
    .reverse();
}

export async function fetchCryptoDaily(symbol: string): Promise<OHLCV[]> {
  const data = await avFetch<Record<string, Record<string, Record<string, string>>>>({
    function: "DIGITAL_CURRENCY_DAILY",
    symbol,
    market: "USD",
  });

  const timeSeries = data["Time Series (Digital Currency Daily)"];
  if (!timeSeries) return [];

  return Object.entries(timeSeries)
    .slice(0, 100)
    .map(([date, values]) => ({
      timestamp: new Date(date).getTime(),
      open: parseFloat(values["1a. open (USD)"] || values["1. open"]),
      high: parseFloat(values["2a. high (USD)"] || values["2. high"]),
      low: parseFloat(values["3a. low (USD)"] || values["3. low"]),
      close: parseFloat(values["4a. close (USD)"] || values["4. close"]),
      volume: parseFloat(values["5. volume"] || "0"),
    }))
    .reverse();
}
