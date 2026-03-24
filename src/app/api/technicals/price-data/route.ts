import { NextRequest, NextResponse } from "next/server";
import { fetchCandlesForInstrument } from "@/lib/api/massive";
import { INSTRUMENTS } from "@/lib/utils/constants";
import type { OHLCV } from "@/lib/types/market";

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

    let candles = await fetchCandlesForInstrument(instrumentId, timeframe, limit);

    // If 4h not directly available, aggregate from 1h
    if (candles.length === 0 && timeframe === "4h") {
      const hourly = await fetchCandlesForInstrument(instrumentId, "1h", limit * 4);
      candles = aggregateCandles(hourly, 4);
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
