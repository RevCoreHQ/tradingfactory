import { checkRateLimit } from "./rate-limiter";
import type { NewsItem, EconomicEvent, OHLCV } from "@/lib/types/market";

const BASE_URL = "https://finnhub.io/api/v1";

function getApiKey(): string {
  return process.env.FINNHUB_API_KEY || "";
}

async function finnhubFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const { allowed, retryAfterMs } = checkRateLimit("finnhub");
  if (!allowed) throw new Error(`Finnhub rate limit exceeded. Retry after ${retryAfterMs}ms`);

  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set("token", getApiKey());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Finnhub error: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchMarketNews(category: string = "general"): Promise<NewsItem[]> {
  const data = await finnhubFetch<Array<{
    id: number;
    headline: string;
    summary: string;
    source: string;
    url: string;
    datetime: number;
    category: string;
    related: string;
  }>>("/news", { category });

  return (data || []).slice(0, 50).map((item) => ({
    id: String(item.id),
    headline: item.headline,
    summary: item.summary || "",
    source: item.source,
    url: item.url,
    publishedAt: new Date(item.datetime * 1000).toISOString(),
    category: item.category,
    relatedInstruments: item.related ? item.related.split(",") : [],
    sentimentScore: 0,
    sentimentLabel: "neutral" as const,
  }));
}

export async function fetchEconomicCalendar(from: string, to: string): Promise<EconomicEvent[]> {
  const data = await finnhubFetch<{
    economicCalendar?: Array<{
      country: string;
      event: string;
      date: string;
      time: string;
      impact: string | number;
      forecast?: number;
      prev?: number;
      actual?: number;
      currency: string;
      unit?: string;
    }>;
  }>("/calendar/economic", { from, to });

  return (data.economicCalendar || []).map((item, i) => ({
    id: `ec-${i}-${item.date}`,
    country: item.country,
    event: item.event,
    date: item.date,
    time: item.time || "00:00",
    impact: (() => {
      const v = String(item.impact).toLowerCase();
      if (v === "high" || v === "3") return "high" as const;
      if (v === "medium" || v === "2") return "medium" as const;
      return "low" as const;
    })(),
    forecast: item.forecast,
    previous: item.prev,
    actual: item.actual,
    currency: item.currency,
    unit: item.unit,
  }));
}

export async function fetchForexRates(base: string = "USD"): Promise<Record<string, number>> {
  const data = await finnhubFetch<{ base: string; quote: Record<string, number> }>("/forex/rates", { base });
  return data.quote || {};
}

export async function fetchCandles(
  symbol: string,
  resolution: string,
  from: number,
  to: number
): Promise<OHLCV[]> {
  const data = await finnhubFetch<{
    c: number[];
    h: number[];
    l: number[];
    o: number[];
    t: number[];
    v: number[];
    s: string;
  }>("/stock/candle", {
    symbol,
    resolution,
    from: String(from),
    to: String(to),
  });

  if (data.s === "no_data" || !data.c) return [];

  return data.c.map((_, i) => ({
    timestamp: data.t[i] * 1000,
    open: data.o[i],
    high: data.h[i],
    low: data.l[i],
    close: data.c[i],
    volume: data.v[i],
  }));
}

export async function fetchForexCandles(
  symbol: string,
  resolution: string,
  from: number,
  to: number
): Promise<OHLCV[]> {
  return fetchCandles(symbol, resolution, from, to);
}

/**
 * Fetch forex candles via /forex/candle endpoint (different from /stock/candle).
 * Works for OANDA symbols like "OANDA:EUR_USD" on Finnhub free tier.
 */
export async function fetchForexCandleData(
  symbol: string,
  resolution: string,
  from: number,
  to: number
): Promise<OHLCV[]> {
  const data = await finnhubFetch<{
    c: number[];
    h: number[];
    l: number[];
    o: number[];
    t: number[];
    v: number[];
    s: string;
  }>("/forex/candle", {
    symbol,
    resolution,
    from: String(from),
    to: String(to),
  });

  if (data.s === "no_data" || !data.c) return [];

  return data.c.map((_, i) => ({
    timestamp: data.t[i] * 1000,
    open: data.o[i],
    high: data.h[i],
    low: data.l[i],
    close: data.c[i],
    volume: data.v?.[i] ?? 0,
  }));
}
