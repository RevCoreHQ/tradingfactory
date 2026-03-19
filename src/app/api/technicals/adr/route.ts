import { NextResponse } from "next/server";
import { fetchForexCandles } from "@/lib/api/finnhub";
import { fetchCryptoOHLC } from "@/lib/api/coingecko";
import { fetchForexDaily } from "@/lib/api/alpha-vantage";
import { fetchTwelveDataCandles } from "@/lib/api/twelve-data";
import { getRateLimitStatus } from "@/lib/api/rate-limiter";
import { INSTRUMENTS } from "@/lib/utils/constants";
import type { OHLCV } from "@/lib/types/market";

const ADR_PERIOD = 14;

function computeADR(candles: OHLCV[], pipSize: number): { pips: number; percent: number } | null {
  if (candles.length < ADR_PERIOD) return null;
  const recent = candles.slice(-ADR_PERIOD);
  const totalRange = recent.reduce((sum, c) => sum + (c.high - c.low), 0);
  const avgRange = totalRange / ADR_PERIOD;
  const lastClose = recent[recent.length - 1].close;
  return {
    pips: Math.round(avgRange / pipSize),
    percent: Number(((avgRange / lastClose) * 100).toFixed(3)),
  };
}

// Accumulating cache — merges partial results across requests
let cache: { data: Record<string, { pips: number; percent: number }>; timestamp: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(
        { adr: cache.data },
        { headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=900" } }
      );
    }

    // Start with existing partial results so data accumulates across requests
    const results: Record<string, { pips: number; percent: number }> =
      cache?.data ? { ...cache.data } : {};
    const now = Math.floor(Date.now() / 1000);
    const from = now - 30 * 24 * 60 * 60;

    // 1. Crypto via CoinGecko — parallel, fast, reliable free tier
    const crypto = INSTRUMENTS.filter((i) => i.category === "crypto");
    await Promise.allSettled(
      crypto.map(async (inst) => {
        try {
          const candles = await fetchCryptoOHLC(inst.coingeckoId || "bitcoin", 30);
          const adr = computeADR(candles, inst.pipSize);
          if (adr) results[inst.id] = adr;
        } catch {
          // keep existing cached value if available
        }
      })
    );

    // 2. Forex + Commodity — Twelve Data primary (paid), Alpha Vantage fallback
    const forexCommodity = INSTRUMENTS.filter(
      (i) => i.category === "forex" || i.category === "commodity"
    );

    // Fetch from Twelve Data in parallel (paid tier, 55/min)
    const tdResults = await Promise.allSettled(
      forexCommodity
        .filter((inst) => !results[inst.id])
        .map(async (inst) => {
          const tdSymbol = inst.twelveDataSymbol || inst.symbol;
          const candles = await fetchTwelveDataCandles(tdSymbol, "1day", 30);
          const adr = computeADR(candles, inst.pipSize);
          if (adr) results[inst.id] = adr;
          return { id: inst.id, success: !!adr };
        })
    );

    // Fallback: Alpha Vantage for anything Twelve Data missed
    const missingForex = forexCommodity.filter((inst) => !results[inst.id]);
    const MAX_AV_CALLS = 3;
    let avCallsMade = 0;
    for (const inst of missingForex) {
      const { used, max } = getRateLimitStatus("alphavantage");
      if (used >= max - 2 || avCallsMade >= MAX_AV_CALLS) break;
      try {
        const candles = await fetchForexDaily(
          inst.alphavantageSymbol,
          inst.alphavantageToSymbol || "USD"
        );
        avCallsMade++;
        const adr = computeADR(candles, inst.pipSize);
        if (adr) results[inst.id] = adr;
      } catch {
        // Rate-limited or failed
      }
    }

    // 3. Indices — Twelve Data primary, Finnhub fallback
    const indices = INSTRUMENTS.filter((i) => i.category === "index");
    await Promise.allSettled(
      indices.map(async (inst) => {
        if (results[inst.id]) return;
        // Try Twelve Data first
        try {
          const tdSymbol = inst.twelveDataSymbol || inst.symbol;
          const candles = await fetchTwelveDataCandles(tdSymbol, "1day", 30);
          const adr = computeADR(candles, inst.pipSize);
          if (adr) { results[inst.id] = adr; return; }
        } catch {
          // fall through
        }
        // Fallback: Finnhub
        try {
          const candles = await fetchForexCandles(inst.finnhubSymbol || "", "D", from, now);
          const adr = computeADR(candles, inst.pipSize);
          if (adr) results[inst.id] = adr;
        } catch {
          // Both failed
        }
      })
    );

    cache = { data: results, timestamp: Date.now() };

    return NextResponse.json(
      { adr: results },
      { headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=900" } }
    );
  } catch (error) {
    console.error("ADR route error:", error);
    return NextResponse.json({ adr: cache?.data || {} }, { status: 200 });
  }
}
