import { NextRequest, NextResponse } from "next/server";
import { fetchMassiveQuotes } from "@/lib/api/massive";
import { fetchCryptoPrice } from "@/lib/api/coingecko";
import { INSTRUMENTS } from "@/lib/utils/constants";
import type { PriceQuote } from "@/lib/types/market";

export async function GET(req: NextRequest) {
  try {
    const requestedIds = req.nextUrl.searchParams.get("instruments")?.split(",") || INSTRUMENTS.map((i) => i.id);
    const requested = INSTRUMENTS.filter((i) => requestedIds.includes(i.id));

    const quotes: Record<string, PriceQuote> = {};

    // ── Fetch all quotes from Massive in batch ──
    const massiveQuotes = await fetchMassiveQuotes(requestedIds);

    for (const inst of requested) {
      const q = massiveQuotes[inst.id];
      if (q && q.price > 0) {
        quotes[inst.id] = {
          instrument: inst.id,
          bid: q.bid || q.price - inst.pipSize,
          ask: q.ask || q.price + inst.pipSize,
          mid: q.price,
          timestamp: q.timestamp,
          change: q.change,
          changePercent: q.changePercent,
          high24h: q.high24h,
          low24h: q.low24h,
        };
      }
    }

    // ── Fallback: CoinGecko for missing crypto ──
    const cryptoMissing = requested.filter(
      (i) => i.category === "crypto" && !quotes[i.id]
    );
    for (const inst of cryptoMissing) {
      try {
        quotes[inst.id] = await fetchCryptoPrice(inst.coingeckoId || "bitcoin", inst.id);
      } catch {
        // Silent fail
      }
    }

    return NextResponse.json(
      { quotes },
      { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=10" } }
    );
  } catch (error) {
    console.error("Rates API error:", error);
    return NextResponse.json({ quotes: {} }, { status: 200 });
  }
}
