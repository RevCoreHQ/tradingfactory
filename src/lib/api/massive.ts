import type { OHLCV } from "@/lib/types/market";

const BASE_URL = "https://api.polygon.io";

function getApiKey(): string {
  return process.env.MASSIVE_API_KEY || "";
}

// ── Instrument ID → Massive/Polygon ticker ──
const TICKER_MAP: Record<string, string> = {
  // Forex
  EUR_USD: "C:EURUSD",
  GBP_USD: "C:GBPUSD",
  AUD_USD: "C:AUDUSD",
  NZD_USD: "C:NZDUSD",
  USD_JPY: "C:USDJPY",
  USD_CAD: "C:USDCAD",
  USD_CHF: "C:USDCHF",
  // Commodities
  XAU_USD: "C:XAUUSD",
  XAG_USD: "C:XAGUSD",
  USOIL: "C:USOIL",
  // Crypto
  BTC_USD: "X:BTCUSD",
  ETH_USD: "X:ETHUSD",
  // Indices
  US100: "I:NDX",
  US30: "I:DJI",
};

export function getMassiveTicker(instrumentId: string): string | null {
  return TICKER_MAP[instrumentId] || null;
}

// ── Timeframe → minutes per candle (for aggregation from 1-min data) ──
const MINUTES_PER_CANDLE: Record<string, number> = {
  "1min": 1,
  "5min": 5,
  "15m": 15,
  "15min": 15,
  "30min": 30,
  "1h": 60,
  "4h": 240,
};

/**
 * Aggregate 1-minute candles into larger timeframes.
 */
function aggregateMinuteCandles(candles: OHLCV[], minutesPerCandle: number): OHLCV[] {
  if (minutesPerCandle <= 1 || candles.length === 0) return candles;
  const msPerCandle = minutesPerCandle * 60 * 1000;
  const result: OHLCV[] = [];
  let bucket: OHLCV[] = [];
  let bucketStart = 0;

  for (const c of candles) {
    const cBucket = Math.floor(c.timestamp / msPerCandle);
    if (bucket.length === 0) {
      bucketStart = cBucket;
      bucket.push(c);
    } else if (cBucket === bucketStart) {
      bucket.push(c);
    } else {
      result.push({
        timestamp: bucket[0].timestamp,
        open: bucket[0].open,
        high: Math.max(...bucket.map((b) => b.high)),
        low: Math.min(...bucket.map((b) => b.low)),
        close: bucket[bucket.length - 1].close,
        volume: bucket.reduce((sum, b) => sum + b.volume, 0),
      });
      bucket = [c];
      bucketStart = cBucket;
    }
  }
  // Flush last bucket
  if (bucket.length > 0) {
    result.push({
      timestamp: bucket[0].timestamp,
      open: bucket[0].open,
      high: Math.max(...bucket.map((b) => b.high)),
      low: Math.min(...bucket.map((b) => b.low)),
      close: bucket[bucket.length - 1].close,
      volume: bucket.reduce((sum, b) => sum + b.volume, 0),
    });
  }
  return result;
}

/**
 * Raw fetch from Polygon aggregates endpoint.
 */
async function fetchRawAggs(
  ticker: string,
  multiplier: number,
  timespan: string,
  from: number,
  to: number,
  limit: number
): Promise<OHLCV[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[Massive] No API key configured");
    return [];
  }

  // Use raw ticker in URL path — do NOT encodeURIComponent (colons are valid in paths)
  const url = `${BASE_URL}/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}?apiKey=${apiKey}&limit=${limit}&sort=asc`;

  const res = await fetch(url, { next: { revalidate: 120 } });
  if (!res.ok) {
    console.warn(`[Massive] HTTP ${res.status} for ${ticker} (${multiplier}/${timespan})`);
    return [];
  }

  const data = await res.json();
  if (data.status !== "OK" && data.status !== "DELAYED") {
    console.warn(`[Massive] API status "${data.status}" for ${ticker}:`, data.error || data.message || "");
    return [];
  }

  if (!data.results || data.results.length === 0) {
    console.warn(`[Massive] No results for ${ticker} (${multiplier}/${timespan})`);
    return [];
  }

  return data.results.map((r: { o: number; h: number; l: number; c: number; v: number; t: number }) => ({
    timestamp: r.t,
    open: r.o,
    high: r.h,
    low: r.l,
    close: r.c,
    volume: r.v || 0,
  }));
}

/**
 * Polygon timespan mapping — fetch candles directly using native timespans
 * instead of fetching 1-minute data and aggregating client-side.
 */
const TIMEFRAME_CONFIG: Record<string, { multiplier: number; timespan: string; daysBack: number }> = {
  "1min":  { multiplier: 1,  timespan: "minute", daysBack: 2 },
  "5min":  { multiplier: 5,  timespan: "minute", daysBack: 5 },
  "15m":   { multiplier: 15, timespan: "minute", daysBack: 10 },
  "15min": { multiplier: 15, timespan: "minute", daysBack: 10 },
  "30min": { multiplier: 30, timespan: "minute", daysBack: 15 },
  "1h":    { multiplier: 1,  timespan: "hour",   daysBack: 30 },
  "4h":    { multiplier: 4,  timespan: "hour",   daysBack: 90 },
  "1d":    { multiplier: 1,  timespan: "day",    daysBack: 365 },
  "1day":  { multiplier: 1,  timespan: "day",    daysBack: 365 },
  "1w":    { multiplier: 1,  timespan: "week",   daysBack: 730 },
};

/**
 * Fetch OHLCV candles for any timeframe.
 * Uses native Polygon timespans (hour, day, week) directly — no client-side aggregation needed.
 * Falls back to 1-minute aggregation only if native fetch returns empty.
 */
export async function fetchMassiveCandles(
  ticker: string,
  timeframe: string,
  limit: number = 200
): Promise<OHLCV[]> {
  const config = TIMEFRAME_CONFIG[timeframe] || { multiplier: 1, timespan: "hour", daysBack: 30 };
  const to = Date.now();
  const from = to - config.daysBack * 24 * 60 * 60 * 1000;

  // Try native timespan first
  const native = await fetchRawAggs(ticker, config.multiplier, config.timespan, from, to, limit);
  if (native.length >= 20) {
    return native.slice(-limit);
  }

  // Fallback: fetch 1-minute candles and aggregate (for plans that restrict timespans)
  const minsPerCandle = MINUTES_PER_CANDLE[timeframe] || 60;
  if (minsPerCandle > 1 && config.timespan !== "minute") {
    console.warn(`[Massive] Native ${config.timespan} returned ${native.length} for ${ticker}, falling back to minute aggregation`);
    const minutesNeeded = minsPerCandle * limit;
    const daysBackFallback = Math.ceil(minutesNeeded / (24 * 60)) + 2;
    const fromFallback = to - daysBackFallback * 24 * 60 * 60 * 1000;
    const fetchLimit = Math.min(minutesNeeded + 500, 50000);
    const minuteCandles = await fetchRawAggs(ticker, 1, "minute", fromFallback, to, fetchLimit);
    const aggregated = aggregateMinuteCandles(minuteCandles, minsPerCandle);
    return aggregated.slice(-limit);
  }

  return native.slice(-limit);
}

/**
 * Fetch candles by instrument ID using Polygon.
 */
export async function fetchCandlesForInstrument(
  instrumentId: string,
  timeframe: string,
  limit: number = 200
): Promise<OHLCV[]> {
  const ticker = getMassiveTicker(instrumentId);
  if (!ticker) return [];
  return fetchMassiveCandles(ticker, timeframe, limit);
}

// ── Snapshot types ──
interface SnapshotQuote {
  price: number;
  change: number;
  changePercent: number;
  bid: number;
  ask: number;
  high24h: number;
  low24h: number;
  timestamp: number;
}

/**
 * Fetch forex/crypto snapshot for latest quotes.
 * Market must be "forex" or "crypto".
 */
async function fetchSnapshot(
  market: "forex" | "crypto",
  tickers: string[]
): Promise<Record<string, SnapshotQuote>> {
  const apiKey = getApiKey();
  if (!apiKey || tickers.length === 0) return {};

  const tickerParam = tickers.join(",");
  const url = `${BASE_URL}/v2/snapshot/locale/global/markets/${market}/tickers?tickers=${encodeURIComponent(tickerParam)}&apiKey=${apiKey}`;

  const res = await fetch(url, { next: { revalidate: 30 } });
  if (!res.ok) {
    console.warn(`[Massive] Snapshot HTTP ${res.status} for ${market}`);
    return {};
  }

  const data = await res.json();
  const result: Record<string, SnapshotQuote> = {};

  for (const t of data.tickers || []) {
    const mid = t.lastQuote?.a && t.lastQuote?.b
      ? (t.lastQuote.a + t.lastQuote.b) / 2
      : t.day?.c || t.prevDay?.c || 0;

    result[t.ticker] = {
      price: mid,
      change: t.todaysChange || 0,
      changePercent: t.todaysChangePerc || 0,
      bid: t.lastQuote?.b || mid,
      ask: t.lastQuote?.a || mid,
      high24h: t.day?.h || t.prevDay?.h || mid,
      low24h: t.day?.l || t.prevDay?.l || mid,
      timestamp: t.updated ? Math.floor(t.updated / 1_000_000) : Date.now(),
    };
  }

  return result;
}

/**
 * Fetch latest quotes for a list of instrument IDs.
 * Automatically routes forex/commodity to forex snapshot and crypto to crypto snapshot.
 */
export async function fetchMassiveQuotes(
  instrumentIds: string[]
): Promise<Record<string, SnapshotQuote>> {
  const forexTickers: string[] = [];
  const cryptoTickers: string[] = [];
  const idToTicker: Record<string, string> = {};

  for (const id of instrumentIds) {
    const ticker = getMassiveTicker(id);
    if (!ticker) continue;
    idToTicker[id] = ticker;
    if (ticker.startsWith("X:")) {
      cryptoTickers.push(ticker);
    } else if (!ticker.startsWith("I:")) {
      // Only send forex/commodity tickers to forex snapshot — indices need candle fallback
      forexTickers.push(ticker);
    }
  }

  const [forexSnaps, cryptoSnaps] = await Promise.all([
    forexTickers.length > 0 ? fetchSnapshot("forex", forexTickers) : {},
    cryptoTickers.length > 0 ? fetchSnapshot("crypto", cryptoTickers) : {},
  ]);

  const allSnaps: Record<string, SnapshotQuote> = { ...forexSnaps, ...cryptoSnaps };
  const result: Record<string, SnapshotQuote> = {};

  for (const [id, ticker] of Object.entries(idToTicker)) {
    const snap = allSnaps[ticker];
    if (snap && snap.price > 0) {
      result[id] = snap;
    }
  }

  // Fallback: for instruments missing from snapshots (indices, oil, etc.),
  // derive quotes from the latest daily candles
  const missingIds = instrumentIds.filter((id) => !result[id] && idToTicker[id]);
  if (missingIds.length > 0) {
    const fallbacks = await Promise.allSettled(
      missingIds.map(async (id) => {
        const candles = await fetchMassiveCandles(idToTicker[id], "1h", 25);
        if (candles.length < 2) return { id, quote: null };
        const latest = candles[candles.length - 1];
        const prevDayCandle = candles[0];
        const change = latest.close - prevDayCandle.open;
        const changePercent = prevDayCandle.open > 0 ? (change / prevDayCandle.open) * 100 : 0;
        return {
          id,
          quote: {
            price: latest.close,
            change,
            changePercent,
            bid: latest.close,
            ask: latest.close,
            high24h: Math.max(...candles.map((c) => c.high)),
            low24h: Math.min(...candles.map((c) => c.low)),
            timestamp: latest.timestamp,
          } as SnapshotQuote,
        };
      })
    );

    for (const f of fallbacks) {
      if (f.status === "fulfilled" && f.value.quote) {
        result[f.value.id] = f.value.quote;
      }
    }
  }

  return result;
}

/**
 * Fetch quotes for specific Polygon tickers (e.g. DXY component pairs).
 * Returns raw ticker → quote mapping.
 */
export async function fetchMassiveForexQuotes(
  tickers: string[]
): Promise<Record<string, SnapshotQuote>> {
  return fetchSnapshot("forex", tickers);
}

// ── Gainers / Losers ──

export interface MoverEntry {
  ticker: string;
  change: number;
  changePercent: number;
  price: number;
  updated: number;
}

/**
 * Fetch top forex gainers or losers from Polygon snapshot.
 */
export async function fetchMassiveMovers(
  direction: "gainers" | "losers"
): Promise<MoverEntry[]> {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  const url = `${BASE_URL}/v2/snapshot/locale/global/markets/forex/${direction}?apiKey=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return [];

  const data = await res.json();
  return (data.tickers || []).map((t: Record<string, unknown>) => ({
    ticker: t.ticker as string,
    change: (t.todaysChange as number) || 0,
    changePercent: (t.todaysChangePerc as number) || 0,
    price: ((t as Record<string, Record<string, number>>).lastQuote?.a + (t as Record<string, Record<string, number>>).lastQuote?.b) / 2 || 0,
    updated: typeof t.updated === "number" ? Math.floor(t.updated as number / 1_000_000) : Date.now(),
  }));
}

// ── Technical Indicators (server-side from Polygon) ──

export interface IndicatorValue {
  timestamp: number;
  value: number;
  signal?: number;
  histogram?: number;
}

/**
 * Fetch a Polygon technical indicator (sma, ema, rsi, macd).
 */
export async function fetchMassiveIndicator(
  ticker: string,
  indicator: "sma" | "ema" | "rsi" | "macd",
  options: { timespan?: string; window?: number; limit?: number } = {}
): Promise<IndicatorValue[]> {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  const { timespan = "day", window = 14, limit = 50 } = options;
  const params = new URLSearchParams({
    apiKey,
    timespan,
    limit: String(limit),
    ...(indicator !== "macd" ? { window: String(window) } : {}),
  });

  const url = `${BASE_URL}/v1/indicators/${indicator}/${ticker}?${params}`;
  const res = await fetch(url, { next: { revalidate: 120 } });
  if (!res.ok) return [];

  const data = await res.json();
  const values = data.results?.values || [];

  return values.map((v: Record<string, number>) => ({
    timestamp: v.timestamp,
    value: v.value,
    ...(indicator === "macd" ? { signal: v.signal, histogram: v.histogram } : {}),
  }));
}

// ── Universal Snapshot ──

export interface UniversalSnapshotEntry {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number;
  volume: number;
  updated: number;
}

/**
 * Fetch enhanced multi-asset quotes via Polygon Universal Snapshot.
 */
export async function fetchUniversalSnapshot(
  tickers: string[]
): Promise<UniversalSnapshotEntry[]> {
  const apiKey = getApiKey();
  if (!apiKey || tickers.length === 0) return [];

  const url = `${BASE_URL}/v3/snapshot?ticker.any_of=${tickers.join(",")}&apiKey=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 30 } });
  if (!res.ok) return [];

  const data = await res.json();
  return (data.results || []).map((r: Record<string, unknown>) => {
    const session = r.session as Record<string, number> | undefined;
    return {
      ticker: r.ticker as string,
      price: session?.close || 0,
      change: session?.change || 0,
      changePercent: session?.change_percent || 0,
      open: session?.open || 0,
      high: session?.high || 0,
      low: session?.low || 0,
      close: session?.close || 0,
      prevClose: session?.previous_close || 0,
      volume: session?.volume || 0,
      updated: typeof r.last_updated === "number" ? r.last_updated as number : Date.now(),
    };
  });
}
