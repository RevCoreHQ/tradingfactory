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
  // Commodities (under Currencies plan)
  XAU_USD: "C:XAUUSD",
  XAG_USD: "C:XAGUSD",
  USOIL: "C:USOIL",
  // Crypto (under Currencies plan)
  BTC_USD: "X:BTCUSD",
  ETH_USD: "X:ETHUSD",
  // Indices (requires Indices plan)
  US100: "I:NDX",
  US30: "I:DJI",
  SPX500: "I:SPX",
  US2000: "I:RUT",
};

export function getMassiveTicker(instrumentId: string): string | null {
  return TICKER_MAP[instrumentId] || null;
}

// ── Timeframe → Polygon multiplier + timespan ──
const TIMEFRAME_MAP: Record<string, { multiplier: number; timespan: string }> = {
  "1min": { multiplier: 1, timespan: "minute" },
  "5min": { multiplier: 5, timespan: "minute" },
  "15m": { multiplier: 15, timespan: "minute" },
  "15min": { multiplier: 15, timespan: "minute" },
  "30min": { multiplier: 30, timespan: "minute" },
  "1h": { multiplier: 1, timespan: "hour" },
  "4h": { multiplier: 4, timespan: "hour" },
  "1d": { multiplier: 1, timespan: "day" },
  "1day": { multiplier: 1, timespan: "day" },
  "1w": { multiplier: 1, timespan: "week" },
};

/**
 * Fetch OHLCV candles from Massive (Polygon.io) aggregates endpoint.
 */
export async function fetchMassiveCandles(
  ticker: string,
  timeframe: string,
  limit: number = 200
): Promise<OHLCV[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn("[Massive] No API key configured");
    return [];
  }

  const tf = TIMEFRAME_MAP[timeframe] || { multiplier: 1, timespan: "hour" };
  const to = Date.now();
  const daysBack =
    tf.timespan === "day" || tf.timespan === "week" ? 365 :
    tf.timespan === "hour" && tf.multiplier >= 4 ? 90 : 30;
  const from = to - daysBack * 24 * 60 * 60 * 1000;

  const url = `${BASE_URL}/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/${tf.multiplier}/${tf.timespan}/${from}/${to}?apiKey=${apiKey}&limit=${limit}&sort=asc`;

  const res = await fetch(url, { next: { revalidate: 120 } });
  if (!res.ok) {
    console.warn(`[Massive] HTTP ${res.status} for ${ticker} (${timeframe})`);
    return [];
  }

  const data = await res.json();
  if (data.status !== "OK" && data.status !== "DELAYED") {
    console.warn(`[Massive] API status "${data.status}" for ${ticker}:`, data.error || data.message || "");
    return [];
  }

  if (!data.results || data.results.length === 0) {
    console.warn(`[Massive] No results for ${ticker} (${timeframe})`);
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
 * Convenience: fetch candles by instrument ID and timeframe.
 */
export async function fetchCandlesForInstrument(
  instrumentId: string,
  timeframe: string,
  limit: number = 200
): Promise<OHLCV[]> {
  const ticker = getMassiveTicker(instrumentId);
  if (!ticker) {
    console.warn(`[Massive] No ticker mapping for ${instrumentId}`);
    return [];
  }
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
    } else {
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
