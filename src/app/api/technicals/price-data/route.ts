import { NextRequest, NextResponse } from "next/server";
import { fetchForexCandles } from "@/lib/api/finnhub";
import { fetchCryptoOHLC } from "@/lib/api/coingecko";
import { fetchForexDaily, fetchForexIntraday } from "@/lib/api/alpha-vantage";
import { INSTRUMENTS } from "@/lib/utils/constants";
import type { OHLCV } from "@/lib/types/market";

const RESOLUTION_MAP: Record<string, string> = {
  "1min": "1",
  "5min": "5",
  "15min": "15",
  "30min": "30",
  "1h": "60",
  "4h": "240",
  "1d": "D",
  "1w": "W",
};

export async function GET(req: NextRequest) {
  try {
    const instrumentId = req.nextUrl.searchParams.get("instrument") || "EUR_USD";
    const timeframe = req.nextUrl.searchParams.get("timeframe") || "1h";
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "200");

    const instrument = INSTRUMENTS.find((i) => i.id === instrumentId);
    if (!instrument) {
      return NextResponse.json({ candles: [], instrument: instrumentId, timeframe }, { status: 200 });
    }

    let candles: OHLCV[] = [];
    const now = Math.floor(Date.now() / 1000);
    const daysBack = timeframe === "1d" || timeframe === "1w" ? 365 : timeframe === "4h" ? 90 : 30;
    const from = now - daysBack * 24 * 60 * 60;

    if (instrument.category === "crypto") {
      const days = timeframe === "1d" || timeframe === "1w" ? 365 : timeframe === "4h" ? 90 : 30;
      const coingeckoId = instrument.coingeckoId || "bitcoin";
      candles = await fetchCryptoOHLC(coingeckoId, days);
    } else if (instrument.category === "forex") {
      // Try Finnhub first, fallback to Alpha Vantage
      try {
        const resolution = RESOLUTION_MAP[timeframe] || "60";
        candles = await fetchForexCandles(instrument.finnhubSymbol || "", resolution, from, now);
      } catch {
        // Fallback to Alpha Vantage
        if (timeframe === "1d" || timeframe === "1w") {
          candles = await fetchForexDaily(
            instrument.alphavantageSymbol,
            instrument.alphavantageToSymbol || "USD"
          );
        } else {
          candles = await fetchForexIntraday(
            instrument.alphavantageSymbol,
            instrument.alphavantageToSymbol || "USD",
            timeframe === "1h" ? "60min" : "15min"
          );
        }
      }
    } else {
      // Index - try Finnhub
      try {
        const resolution = RESOLUTION_MAP[timeframe] || "D";
        candles = await fetchForexCandles(instrument.finnhubSymbol || "", resolution, from, now);
      } catch {
        candles = [];
      }
    }

    candles = candles.slice(-limit);

    return NextResponse.json(
      { candles, instrument: instrumentId, timeframe },
      { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } }
    );
  } catch (error) {
    console.error("Price data error:", error);
    return NextResponse.json(
      { candles: [], instrument: "", timeframe: "" },
      { status: 200 }
    );
  }
}
