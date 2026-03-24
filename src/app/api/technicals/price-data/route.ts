import { NextRequest, NextResponse } from "next/server";
import { fetchForexCandleData, fetchCandles } from "@/lib/api/finnhub";
import { fetchCryptoOHLC } from "@/lib/api/coingecko";
import { fetchForexDaily, fetchForexIntraday } from "@/lib/api/alpha-vantage";
import { fetchTwelveDataCandles, TWELVE_DATA_INTERVALS } from "@/lib/api/twelve-data";
import { INSTRUMENTS } from "@/lib/utils/constants";
import type { OHLCV } from "@/lib/types/market";

const RESOLUTION_MAP: Record<string, string> = {
  "1min": "1",
  "5min": "5",
  "15m": "15",
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
      // Primary: Twelve Data (paid, 55 req/min)
      try {
        const tdInterval = TWELVE_DATA_INTERVALS[timeframe] || "1h";
        const tdSymbol = instrument.twelveDataSymbol || instrument.symbol;
        candles = await fetchTwelveDataCandles(tdSymbol, tdInterval, limit);
      } catch (err) {
        console.warn(`[PriceData] TwelveData failed for ${instrument.symbol}:`, err);
        candles = [];
      }

      // Fallback 2: Finnhub /forex/candle
      if (candles.length === 0) {
        const finnhubSym = instrument.finnhubSymbol || "";
        const resolution = RESOLUTION_MAP[timeframe] || "60";
        try {
          candles = await fetchForexCandleData(finnhubSym, resolution, from, now);
        } catch (err) {
          console.warn(`[PriceData] Finnhub failed for ${finnhubSym}:`, err);
          candles = [];
        }
      }

      // Fallback 3: Alpha Vantage (5 calls/min)
      if (candles.length === 0) {
        try {
          if (timeframe === "1d" || timeframe === "1w") {
            candles = await fetchForexDaily(
              instrument.alphavantageSymbol,
              instrument.alphavantageToSymbol || "USD"
            );
          } else {
            candles = await fetchForexIntraday(
              instrument.alphavantageSymbol,
              instrument.alphavantageToSymbol || "USD",
              "60min"
            );
            if (timeframe === "4h") {
              candles = aggregateCandles(candles, 4);
            }
          }
        } catch (err) {
          console.warn(`[PriceData] AlphaVantage failed for ${instrument.alphavantageSymbol}:`, err);
          candles = [];
        }
      }
    } else {
      // Index — try Twelve Data first, then Finnhub
      try {
        const tdInterval = TWELVE_DATA_INTERVALS[timeframe] || "1h";
        const tdSymbol = instrument.twelveDataSymbol || instrument.symbol;
        candles = await fetchTwelveDataCandles(tdSymbol, tdInterval, limit);
      } catch (err) {
        console.warn(`[PriceData] TwelveData failed for index ${instrument.symbol}:`, err);
        candles = [];
      }
      if (candles.length === 0) {
        try {
          const fhSymbol = instrument.finnhubSymbol || "";
          const resolution = RESOLUTION_MAP[timeframe] || "D";
          // FOREXCOM symbols use /stock/candle, OANDA symbols use /forex/candle
          candles = fhSymbol.startsWith("OANDA:")
            ? await fetchForexCandleData(fhSymbol, resolution, from, now)
            : await fetchCandles(fhSymbol, resolution, from, now);
        } catch (err) {
          console.warn(`[PriceData] Finnhub failed for index ${instrument.finnhubSymbol}:`, err);
          candles = [];
        }
      }
    }

    candles = candles.slice(-limit);

    return NextResponse.json(
      { candles, instrument: instrumentId, timeframe },
      { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=60" } }
    );
  } catch (error) {
    console.error("Price data error:", error);
    return NextResponse.json(
      { candles: [], instrument: "", timeframe: "" },
      { status: 200 }
    );
  }
}
