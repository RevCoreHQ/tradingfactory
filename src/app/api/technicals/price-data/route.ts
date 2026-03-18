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

/**
 * Aggregate smaller candles into larger ones.
 * E.g. 60min candles → 4h candles (4 candles per group).
 */
function aggregateCandles(candles: OHLCV[], groupSize: number): OHLCV[] {
  if (groupSize <= 1 || candles.length === 0) return candles;
  const result: OHLCV[] = [];
  for (let i = 0; i < candles.length; i += groupSize) {
    const group = candles.slice(i, i + groupSize);
    if (group.length === 0) break;
    result.push({
      timestamp: group[0].timestamp,
      open: group[0].open,
      high: Math.max(...group.map((c) => c.high)),
      low: Math.min(...group.map((c) => c.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((sum, c) => sum + c.volume, 0),
    });
  }
  return result;
}

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
    } else if (instrument.category === "forex" || instrument.category === "commodity") {
      // Finnhub free tier returns empty for OANDA forex symbols — go straight to Alpha Vantage
      try {
        if (timeframe === "1d" || timeframe === "1w") {
          candles = await fetchForexDaily(
            instrument.alphavantageSymbol,
            instrument.alphavantageToSymbol || "USD"
          );
        } else {
          // Always fetch 60min — for 4h, we aggregate 60min → 4h candles.
          // This reuses the AV cache from 1h requests, saving rate limit budget.
          candles = await fetchForexIntraday(
            instrument.alphavantageSymbol,
            instrument.alphavantageToSymbol || "USD",
            "60min"
          );
          if (timeframe === "4h") {
            candles = aggregateCandles(candles, 4);
          }
        }
      } catch {
        candles = [];
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

    // Forex/commodity: cache longer (5 min) to reduce AV rate limit pressure
    const isForexOrCommodity = instrument.category === "forex" || instrument.category === "commodity";
    const cacheHeader = isForexOrCommodity
      ? "s-maxage=300, stale-while-revalidate=120"
      : "s-maxage=60, stale-while-revalidate=30";

    return NextResponse.json(
      { candles, instrument: instrumentId, timeframe },
      { headers: { "Cache-Control": cacheHeader } }
    );
  } catch (error) {
    console.error("Price data error:", error);
    return NextResponse.json(
      { candles: [], instrument: "", timeframe: "" },
      { status: 200 }
    );
  }
}
