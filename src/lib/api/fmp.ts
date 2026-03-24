import { checkRateLimit } from "@/lib/api/rate-limiter";
import type { OHLCV } from "@/lib/types/market";

const BASE_URL = "https://financialmodelingprep.com/api/v3";

function getApiKey(): string {
  return process.env.FMP_API_KEY || "";
}

// ── Instrument ID → FMP symbol ──
const FMP_TICKER_MAP: Record<string, string> = {
  US30: "^DJI",
  USOIL: "WTIUSD",
  US100: "^IXIC",
  BTC_USD: "BTCUSD",
  ETH_USD: "ETHUSD",
  XAU_USD: "XAUUSD",
};

export function getFMPTicker(instrumentId: string): string | null {
  return FMP_TICKER_MAP[instrumentId] || null;
}

// ── Quote types ──
interface FMPQuoteRaw {
  symbol: string;
  price: number;
  change: number;
  changesPercentage: number;
  dayHigh: number;
  dayLow: number;
  open: number;
  previousClose: number;
  timestamp: number;
}

export interface FMPQuote {
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
 * Fetch a single quote from FMP.
 */
export async function fetchFMPQuote(symbol: string): Promise<FMPQuote | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const { allowed } = checkRateLimit("fmp");
  if (!allowed) {
    console.warn("[FMP] Rate limited");
    return null;
  }

  try {
    const url = `${BASE_URL}/quote/${encodeURIComponent(symbol)}?apikey=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;

    const data: FMPQuoteRaw[] = await res.json();
    if (!data?.[0]?.price) return null;

    const q = data[0];
    return {
      price: q.price,
      change: q.change,
      changePercent: q.changesPercentage,
      bid: q.price,
      ask: q.price,
      high24h: q.dayHigh || q.price,
      low24h: q.dayLow || q.price,
      timestamp: q.timestamp ? q.timestamp * 1000 : Date.now(),
    };
  } catch (err) {
    console.warn(`[FMP] Quote failed for ${symbol}:`, err);
    return null;
  }
}

/**
 * Batch fetch quotes for multiple instrument IDs.
 * Returns instrument ID → FMPQuote mapping.
 */
export async function fetchFMPQuotes(
  instrumentIds: string[]
): Promise<Record<string, FMPQuote>> {
  const apiKey = getApiKey();
  if (!apiKey) return {};

  // Build symbol list for instruments that have FMP tickers
  const idToSymbol: Record<string, string> = {};
  for (const id of instrumentIds) {
    const symbol = getFMPTicker(id);
    if (symbol) idToSymbol[id] = symbol;
  }

  const symbols = Object.values(idToSymbol);
  if (symbols.length === 0) return {};

  const { allowed } = checkRateLimit("fmp");
  if (!allowed) return {};

  try {
    // FMP supports comma-separated batch quotes
    const url = `${BASE_URL}/quote/${symbols.map(encodeURIComponent).join(",")}?apikey=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return {};

    const data: FMPQuoteRaw[] = await res.json();
    if (!Array.isArray(data)) return {};

    const symbolToQuote = new Map<string, FMPQuoteRaw>();
    for (const q of data) {
      if (q.price > 0) symbolToQuote.set(q.symbol, q);
    }

    const result: Record<string, FMPQuote> = {};
    for (const [id, symbol] of Object.entries(idToSymbol)) {
      const q = symbolToQuote.get(symbol);
      if (q) {
        result[id] = {
          price: q.price,
          change: q.change,
          changePercent: q.changesPercentage,
          bid: q.price,
          ask: q.price,
          high24h: q.dayHigh || q.price,
          low24h: q.dayLow || q.price,
          timestamp: q.timestamp ? q.timestamp * 1000 : Date.now(),
        };
      }
    }

    return result;
  } catch (err) {
    console.warn("[FMP] Batch quote failed:", err);
    return {};
  }
}

// ── FMP timeframe → chart period mapping ──
const FMP_PERIOD_MAP: Record<string, string> = {
  "1min": "1min",
  "5min": "5min",
  "15m": "15min",
  "15min": "15min",
  "30min": "30min",
  "1h": "1hour",
  "4h": "4hour",
  "1d": "daily",
  "1day": "daily",
};

/**
 * Fetch OHLCV candles from FMP for a given instrument.
 */
export async function fetchFMPCandles(
  instrumentId: string,
  timeframe: string,
  limit: number = 200
): Promise<OHLCV[]> {
  const apiKey = getApiKey();
  if (!apiKey) return [];

  const symbol = getFMPTicker(instrumentId);
  if (!symbol) return [];

  const { allowed } = checkRateLimit("fmp");
  if (!allowed) return [];

  const period = FMP_PERIOD_MAP[timeframe];
  if (!period) return [];

  try {
    const isDaily = period === "daily";
    const url = isDaily
      ? `${BASE_URL}/historical-price-full/${encodeURIComponent(symbol)}?apikey=${apiKey}&timeseries=${limit}`
      : `${BASE_URL}/historical-chart/${period}/${encodeURIComponent(symbol)}?apikey=${apiKey}`;

    const res = await fetch(url, { next: { revalidate: 120 } });
    if (!res.ok) return [];

    const data = await res.json();

    // Daily returns { historical: [...] }, intraday returns [...]
    const rows: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }> =
      isDaily ? data.historical || [] : Array.isArray(data) ? data : [];

    if (rows.length === 0) return [];

    // FMP returns newest first — reverse to oldest first
    const sorted = [...rows].reverse();

    return sorted.slice(-limit).map((r) => ({
      timestamp: new Date(r.date).getTime(),
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume || 0,
    }));
  } catch (err) {
    console.warn(`[FMP] Candles failed for ${symbol}:`, err);
    return [];
  }
}
