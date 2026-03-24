import { NextResponse } from "next/server";
import { fetchCandlesForInstrument } from "@/lib/api/massive";
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

    const results: Record<string, { pips: number; percent: number }> =
      cache?.data ? { ...cache.data } : {};

    // Fetch daily candles for all instruments via Massive
    const settled = await Promise.allSettled(
      INSTRUMENTS.map(async (inst) => {
        if (results[inst.id]) return; // already cached
        const candles = await fetchCandlesForInstrument(inst.id, "1d", 30);
        const adr = computeADR(candles, inst.pipSize);
        if (adr) results[inst.id] = adr;
      })
    );

    for (const s of settled) {
      if (s.status === "rejected") {
        console.error("[ADR] Fetch error:", s.reason);
      }
    }

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
