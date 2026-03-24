import { checkRateLimit } from "@/lib/api/rate-limiter";

const BASE_URL = "https://financialmodelingprep.com/stable";

function getApiKey(): string {
  return process.env.FMP_API_KEY || "";
}

// ── Instrument ID → FMP symbol (free tier: indices + crypto only) ──
const FMP_TICKER_MAP: Record<string, string> = {
  US30: "^DJI",
  US100: "^IXIC",
  BTC_USD: "BTCUSD",
  ETH_USD: "ETHUSD",
};

// ── Yahoo Finance symbols (no API key needed, covers commodities) ──
const YAHOO_TICKER_MAP: Record<string, string> = {
  USOIL: "CL=F",
  US30: "^DJI",
  US100: "^IXIC",
  BTC_USD: "BTC-USD",
  ETH_USD: "ETH-USD",
  XAU_USD: "GC=F",
  XAG_USD: "SI=F",
};

export function getFMPTicker(instrumentId: string): string | null {
  return FMP_TICKER_MAP[instrumentId] || null;
}

export function getYahooTicker(instrumentId: string): string | null {
  return YAHOO_TICKER_MAP[instrumentId] || null;
}

// ── Quote types ──
interface FMPQuoteRaw {
  symbol: string;
  price: number;
  change: number;
  changePercentage: number;
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
  provider: "fmp" | "yahoo";
}

/**
 * Fetch quotes from FMP stable API (free tier: indices + crypto).
 */
export async function fetchFMPQuotes(
  instrumentIds: string[]
): Promise<Record<string, FMPQuote>> {
  const apiKey = getApiKey();
  const result: Record<string, FMPQuote> = {};

  // ── FMP batch for instruments with FMP tickers ──
  if (apiKey) {
    const fmpIds: Record<string, string> = {};
    for (const id of instrumentIds) {
      const symbol = getFMPTicker(id);
      if (symbol) fmpIds[id] = symbol;
    }

    const symbols = Object.values(fmpIds);
    if (symbols.length > 0) {
      const { allowed } = checkRateLimit("fmp");
      if (allowed) {
        try {
          const url = `${BASE_URL}/quote?symbol=${symbols.map(encodeURIComponent).join(",")}&apikey=${apiKey}`;
          const res = await fetch(url, { next: { revalidate: 60 } });
          if (res.ok) {
            const data: FMPQuoteRaw[] = await res.json();
            if (Array.isArray(data)) {
              const symbolMap = new Map<string, FMPQuoteRaw>();
              for (const q of data) {
                if (q.price > 0) symbolMap.set(q.symbol, q);
              }
              for (const [id, symbol] of Object.entries(fmpIds)) {
                const q = symbolMap.get(symbol);
                if (q) {
                  result[id] = {
                    price: q.price,
                    change: q.change,
                    changePercent: q.changePercentage,
                    bid: q.price,
                    ask: q.price,
                    high24h: q.dayHigh || q.price,
                    low24h: q.dayLow || q.price,
                    timestamp: q.timestamp ? q.timestamp * 1000 : Date.now(),
                    provider: "fmp",
                  };
                }
              }
            }
          }
        } catch (err) {
          console.warn("[FMP] Quote failed:", err);
        }
      }
    }
  }

  // ── Yahoo Finance fallback for anything still missing ──
  const stillMissing = instrumentIds.filter((id) => !result[id]);
  if (stillMissing.length > 0) {
    await Promise.allSettled(
      stillMissing.map(async (id) => {
        const quote = await fetchYahooQuote(id);
        if (quote) result[id] = quote;
      })
    );
  }

  return result;
}

/**
 * Fetch a quote from Yahoo Finance (no API key required).
 */
async function fetchYahooQuote(instrumentId: string): Promise<FMPQuote | null> {
  const symbol = getYahooTicker(instrumentId);
  if (!symbol) return null;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;

    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose || price;
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

    return {
      price,
      change,
      changePercent,
      bid: price,
      ask: price,
      high24h: meta.regularMarketDayHigh || price,
      low24h: meta.regularMarketDayLow || price,
      timestamp: (meta.regularMarketTime || Math.floor(Date.now() / 1000)) * 1000,
      provider: "yahoo",
    };
  } catch (err) {
    console.warn(`[Yahoo] Quote failed for ${instrumentId}:`, err);
    return null;
  }
}
