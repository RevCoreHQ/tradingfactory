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

export async function fetchCryptoPrice(coingeckoId: string, instrumentId: string): Promise<PriceQuote> {
  const data = await cgFetch<Record<string, {
      usd: number;
      usd_24h_change: number;
      usd_24h_high: number;
      usd_24h_low: number;
      last_updated_at: number;
    }>>("/simple/price", {
    ids: coingeckoId,
    vs_currencies: "usd",
    include_24hr_change: "true",
    include_24hr_high: "true",
    include_24hr_low: "true",
    include_last_updated_at: "true",
  });

  const coin = data[coingeckoId];
  return {
    instrument: instrumentId,
    bid: coin.usd,
    ask: coin.usd,
    mid: coin.usd,
    timestamp: coin.last_updated_at * 1000,
    change: (coin.usd * coin.usd_24h_change) / 100,
    changePercent: coin.usd_24h_change,
    high24h: coin.usd_24h_high || coin.usd,
    low24h: coin.usd_24h_low || coin.usd,
  };
}

export async function fetchCryptoOHLC(coingeckoId: string, days: number = 30): Promise<OHLCV[]> {
  const data = await cgFetch<number[][]>(`/coins/${coingeckoId}/ohlc`, {
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

export async function fetchCryptoMarketData(coingeckoId: string): Promise<{
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
  }>(`/coins/${coingeckoId}`, { localization: "false", tickers: "false", community_data: "false", developer_data: "false" });

  const dominanceKeyMap: Record<string, string> = {
    bitcoin: "btc",
    ethereum: "eth",
  };
  const dominanceKey = dominanceKeyMap[coingeckoId] || coingeckoId.slice(0, 3);

  const global = await cgFetch<{
    data: { market_cap_percentage: Record<string, number> };
  }>("/global");

  return {
    marketCap: data.market_data.market_cap.usd,
    volume24h: data.market_data.total_volume.usd,
    dominance: global.data.market_cap_percentage[dominanceKey] || 0,
    circulatingSupply: data.market_data.circulating_supply,
    priceChange7d: data.market_data.price_change_percentage_7d,
    priceChange30d: data.market_data.price_change_percentage_30d,
  };
}
