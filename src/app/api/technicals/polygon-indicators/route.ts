import { NextRequest, NextResponse } from "next/server";
import { fetchMassiveIndicator, getMassiveTicker } from "@/lib/api/massive";
import { INSTRUMENTS } from "@/lib/utils/constants";

/**
 * Fetch Polygon's pre-computed technical indicators (RSI, MACD, SMA, EMA)
 * for a single instrument. Used for cross-validation and enriched detail views.
 *
 * Query params:
 *   instrument - instrument ID (e.g. EUR_USD)
 *   timespan   - "day" | "hour" (default: "day")
 */
export async function GET(req: NextRequest) {
  try {
    const instrumentId = req.nextUrl.searchParams.get("instrument") || "EUR_USD";
    const timespan = req.nextUrl.searchParams.get("timespan") || "day";

    const inst = INSTRUMENTS.find((i) => i.id === instrumentId);
    const ticker = getMassiveTicker(instrumentId);
    if (!inst || !ticker) {
      return NextResponse.json(
        { instrument: instrumentId, indicators: {} },
        { status: 200 }
      );
    }

    // Fetch RSI-14, EMA-21, SMA-50, and MACD in parallel
    const [rsi, ema21, sma50, macd] = await Promise.all([
      fetchMassiveIndicator(ticker, "rsi", { timespan, window: 14, limit: 5 }),
      fetchMassiveIndicator(ticker, "ema", { timespan, window: 21, limit: 5 }),
      fetchMassiveIndicator(ticker, "sma", { timespan, window: 50, limit: 5 }),
      fetchMassiveIndicator(ticker, "macd", { timespan, limit: 5 }),
    ]);

    const latestRSI = rsi[rsi.length - 1];
    const latestEMA = ema21[ema21.length - 1];
    const latestSMA = sma50[sma50.length - 1];
    const latestMACD = macd[macd.length - 1];

    return NextResponse.json(
      {
        instrument: instrumentId,
        timespan,
        indicators: {
          rsi: latestRSI ? { value: latestRSI.value, timestamp: latestRSI.timestamp } : null,
          ema21: latestEMA ? { value: latestEMA.value, timestamp: latestEMA.timestamp } : null,
          sma50: latestSMA ? { value: latestSMA.value, timestamp: latestSMA.timestamp } : null,
          macd: latestMACD
            ? {
                value: latestMACD.value,
                signal: latestMACD.signal,
                histogram: latestMACD.histogram,
                timestamp: latestMACD.timestamp,
              }
            : null,
        },
      },
      { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=60" } }
    );
  } catch (error) {
    console.error("[PolygonIndicators] Error:", error);
    return NextResponse.json(
      { instrument: "", indicators: {} },
      { status: 200 }
    );
  }
}
