import { NextResponse } from "next/server";
import { fetchForexCandles } from "@/lib/api/finnhub";
import { fetchCryptoOHLC } from "@/lib/api/coingecko";
import { fetchForexDaily } from "@/lib/api/alpha-vantage";
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

// Server-side cache: refresh every 30 minutes
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

    const results: Record<string, { pips: number; percent: number }> = {};
    const now = Math.floor(Date.now() / 1000);
    const from = now - 30 * 24 * 60 * 60; // 30 days of daily data

    // Fetch daily candles for all instruments in parallel
    const promises = INSTRUMENTS.map(async (inst) => {
      try {
        let candles: OHLCV[] = [];

        if (inst.category === "crypto") {
          candles = await fetchCryptoOHLC(inst.coingeckoId || "bitcoin", 30);
        } else if (inst.category === "forex" || inst.category === "commodity") {
          try {
            candles = await fetchForexCandles(inst.finnhubSymbol || "", "D", from, now);
          } catch {
            candles = await fetchForexDaily(inst.alphavantageSymbol, inst.alphavantageToSymbol || "USD");
          }
        } else {
          // Index
          try {
            candles = await fetchForexCandles(inst.finnhubSymbol || "", "D", from, now);
          } catch {
            candles = [];
          }
        }

        const adr = computeADR(candles, inst.pipSize);
        if (adr) {
          results[inst.id] = adr;
        }
      } catch (error) {
        console.error(`ADR fetch failed for ${inst.id}:`, error);
      }
    });

    await Promise.allSettled(promises);

    cache = { data: results, timestamp: Date.now() };

    return NextResponse.json(
      { adr: results },
      { headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=900" } }
    );
  } catch (error) {
    console.error("ADR route error:", error);
    return NextResponse.json({ adr: {} }, { status: 200 });
  }
}
