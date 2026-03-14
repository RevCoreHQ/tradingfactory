import { NextRequest, NextResponse } from "next/server";
import { fetchForexRates, fetchForexCandles } from "@/lib/api/finnhub";
import { fetchCryptoPrice } from "@/lib/api/coingecko";
import { INSTRUMENTS } from "@/lib/utils/constants";
import type { PriceQuote } from "@/lib/types/market";

export async function GET(req: NextRequest) {
  try {
    const requestedIds = req.nextUrl.searchParams.get("instruments")?.split(",") || INSTRUMENTS.map((i) => i.id);

    const quotes: Record<string, PriceQuote> = {};

    // Fetch forex rates
    const forexInstruments = INSTRUMENTS.filter(
      (i) => i.category === "forex" && requestedIds.includes(i.id)
    );
    if (forexInstruments.length > 0) {
      const rates = await fetchForexRates("USD");
      for (const inst of forexInstruments) {
        const from = inst.alphavantageSymbol;
        const to = inst.alphavantageToSymbol || "USD";

        let mid: number;
        if (from === "USD") {
          mid = rates[to] || 0;
        } else if (to === "USD") {
          mid = rates[from] ? 1 / rates[from] : 0;
        } else {
          mid = rates[from] && rates[to] ? rates[to] / rates[from] : 0;
        }

        if (mid > 0) {
          quotes[inst.id] = {
            instrument: inst.id,
            bid: mid - inst.pipSize,
            ask: mid + inst.pipSize,
            mid,
            timestamp: Date.now(),
            change: 0,
            changePercent: 0,
            high24h: mid,
            low24h: mid,
          };
        }
      }
    }

    // Fetch crypto prices
    const cryptoInstruments = INSTRUMENTS.filter(
      (i) => i.category === "crypto" && requestedIds.includes(i.id)
    );
    for (const inst of cryptoInstruments) {
      try {
        quotes[inst.id] = await fetchCryptoPrice(inst.coingeckoId || "bitcoin", inst.id);
      } catch {
        // Silent fail
      }
    }

    // Fetch commodity prices via Finnhub candles
    const commodityInstruments = INSTRUMENTS.filter(
      (i) => i.category === "commodity" && requestedIds.includes(i.id)
    );
    for (const inst of commodityInstruments) {
      try {
        const now = Math.floor(Date.now() / 1000);
        const from = now - 24 * 60 * 60;
        const candles = await fetchForexCandles(inst.finnhubSymbol || "", "60", from, now);
        if (candles.length > 0) {
          const latest = candles[candles.length - 1];
          const first = candles[0];
          const change = latest.close - first.open;
          const changePercent = (change / first.open) * 100;
          quotes[inst.id] = {
            instrument: inst.id,
            bid: latest.close - inst.pipSize,
            ask: latest.close + inst.pipSize,
            mid: latest.close,
            timestamp: latest.timestamp,
            change,
            changePercent,
            high24h: Math.max(...candles.map((c) => c.high)),
            low24h: Math.min(...candles.map((c) => c.low)),
          };
        }
      } catch {
        // Silent fail for commodity prices
      }
    }

    // For indices, we use Finnhub candle data as a proxy
    const indexInstruments = INSTRUMENTS.filter(
      (i) => i.category === "index" && requestedIds.includes(i.id)
    );
    for (const inst of indexInstruments) {
      // Placeholder - indices need candle data for price
      quotes[inst.id] = {
        instrument: inst.id,
        bid: 0,
        ask: 0,
        mid: 0,
        timestamp: Date.now(),
        change: 0,
        changePercent: 0,
        high24h: 0,
        low24h: 0,
      };
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
