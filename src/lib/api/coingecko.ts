import { checkRateLimit } from "./rate-limiter";
import type { PriceQuote, OHLCV } from "@/lib/types/market";

const BASE_URL = "https://api.coingecko.com/api/v3";

async function cgFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const { allowed } = checkRateLimit("coingecko");
  if (!allowed) throw new Error("CoinGecko rate limit exceeded");

  const url = new URL(`${BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
  return res.json();
}

export async function fetchBitcoinPrice(): Promise<PriceQuote> {
  const data = await cgFetch<{
    bitcoin: {
      usd: number;
      usd_24h_change: number;
      usd_24h_high: number;
      usd_24h_low: number;
      last_updated_at: number;
    };
  }>("/simple/price", {
    ids: "bitcoin",
    vs_currencies: "usd",
    include_24hr_change: "true",
    include_24hr_high: "true",
    include_24hr_low: "true",
    include_last_updated_at: "true",
  });

  const btc = data.bitcoin;
  return {
    instrument: "BTC_USD",
    bid: btc.usd,
    ask: btc.usd,
    mid: btc.usd,
    timestamp: btc.last_updated_at * 1000,
    change: (btc.usd * btc.usd_24h_change) / 100,
    changePercent: btc.usd_24h_change,
    high24h: btc.usd_24h_high || btc.usd,
    low24h: btc.usd_24h_low || btc.usd,
  };
}

export async function fetchBitcoinOHLC(days: number = 30): Promise<OHLCV[]> {
  const data = await cgFetch<number[][]>(`/coins/bitcoin/ohlc`, {
    vs_currency: "usd",
    days: String(days),
  });

  return (data || []).map(([timestamp, open, high, low, close]) => ({
    timestamp,
    open,
    high,
    low,
    close,
    volume: 0,
  }));
}

export async function fetchBitcoinMarketData(): Promise<{
  marketCap: number;
  volume24h: number;
  dominance: number;
  circulatingSupply: number;
  priceChange7d: number;
  priceChange30d: number;
}> {
  const data = await cgFetch<{
    market_data: {
      market_cap: { usd: number };
      total_volume: { usd: number };
      circulating_supply: number;
      price_change_percentage_7d: number;
      price_change_percentage_30d: number;
    };
  }>("/coins/bitcoin", { localization: "false", tickers: "false", community_data: "false", developer_data: "false" });

  const global = await cgFetch<{
    data: { market_cap_percentage: { btc: number } };
  }>("/global");

  return {
    marketCap: data.market_data.market_cap.usd,
    volume24h: data.market_data.total_volume.usd,
    dominance: global.data.market_cap_percentage.btc,
    circulatingSupply: data.market_data.circulating_supply,
    priceChange7d: data.market_data.price_change_percentage_7d,
    priceChange30d: data.market_data.price_change_percentage_30d,
  };
}
