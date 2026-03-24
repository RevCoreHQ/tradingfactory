import { NextResponse } from "next/server";
import { fetchMassiveCandles } from "@/lib/api/massive";
import type { OHLCV } from "@/lib/types/market";

export const dynamic = "force-dynamic";

type TrendResult = { direction: "bullish" | "bearish" | "ranging"; strength: number };
const RANGING: TrendResult = { direction: "ranging", strength: 0 };

// Simple trend detection from candle series
function detectTrend(closes: number[]): TrendResult {
  if (closes.length < 10) return RANGING;

  const len = closes.length;
  const sma10 = closes.slice(-10).reduce((s, v) => s + v, 0) / 10;
  const sma20 = closes.length >= 20
    ? closes.slice(-20).reduce((s, v) => s + v, 0) / 20
    : sma10;

  const current = closes[len - 1];
  const pctFromSma10 = ((current - sma10) / sma10) * 100;
  const smaSpread = ((sma10 - sma20) / sma20) * 100;

  // Count higher highs / lower lows in recent candles
  let upMoves = 0;
  let downMoves = 0;
  const lookback = Math.min(10, len - 1);
  for (let i = len - lookback; i < len; i++) {
    if (closes[i] > closes[i - 1]) upMoves++;
    else if (closes[i] < closes[i - 1]) downMoves++;
  }
  const moveRatio = lookback > 0 ? (upMoves - downMoves) / lookback : 0;

  // Combine signals
  const bullSignals = (pctFromSma10 > 0.05 ? 1 : 0) + (smaSpread > 0.03 ? 1 : 0) + (moveRatio > 0.2 ? 1 : 0);
  const bearSignals = (pctFromSma10 < -0.05 ? 1 : 0) + (smaSpread < -0.03 ? 1 : 0) + (moveRatio < -0.2 ? 1 : 0);

  if (bullSignals >= 2) {
    return { direction: "bullish", strength: Math.min(bullSignals / 3, 1) };
  }
  if (bearSignals >= 2) {
    return { direction: "bearish", strength: Math.min(bearSignals / 3, 1) };
  }
  return RANGING;
}

// Invert EUR/USD closes to approximate DXY direction
function invertCloses(candles: OHLCV[]): number[] {
  return candles.map((c) => c.close > 0 ? 1 / c.close : 0).filter((v) => v > 0);
}

export async function GET() {
  try {
    // Fetch EUR/USD candles at multiple timeframes (DXY is ~57.6% inverse EUR/USD)
    // Use Promise.allSettled so one failed timeframe doesn't kill the others
    const [h1Result, h4Result, d1Result] = await Promise.allSettled([
      fetchMassiveCandles("C:EURUSD", "1h", 50),
      fetchMassiveCandles("C:EURUSD", "4h", 50),
      fetchMassiveCandles("C:EURUSD", "1d", 50),
    ]);

    const h1Candles = h1Result.status === "fulfilled" ? h1Result.value : [];
    const h4Candles = h4Result.status === "fulfilled" ? h4Result.value : [];
    const d1Candles = d1Result.status === "fulfilled" ? d1Result.value : [];

    // Log failures for debugging
    if (h1Result.status === "rejected") console.warn("[DXY] 1h candle fetch failed:", h1Result.reason);
    if (h4Result.status === "rejected") console.warn("[DXY] 4h candle fetch failed:", h4Result.reason);
    if (d1Result.status === "rejected") console.warn("[DXY] 1d candle fetch failed:", d1Result.reason);

    // DXY is INVERSE of EUR/USD (when EUR falls, DXY rises)
    const h1Trend = detectTrend(invertCloses(h1Candles));
    const h4Trend = detectTrend(invertCloses(h4Candles));
    const d1Trend = detectTrend(invertCloses(d1Candles));

    // Compute overall DXY bias
    const trendScore =
      (h1Trend.direction === "bullish" ? 1 : h1Trend.direction === "bearish" ? -1 : 0) * 0.25 +
      (h4Trend.direction === "bullish" ? 1 : h4Trend.direction === "bearish" ? -1 : 0) * 0.35 +
      (d1Trend.direction === "bullish" ? 1 : d1Trend.direction === "bearish" ? -1 : 0) * 0.40;

    const overallBias: "bullish" | "bearish" | "neutral" =
      trendScore > 0.2 ? "bullish" : trendScore < -0.2 ? "bearish" : "neutral";

    return NextResponse.json({
      trends: {
        "1h": h1Trend,
        "4h": h4Trend,
        "1d": d1Trend,
      },
      overallBias,
      trendScore,
      impact: {
        gold: overallBias === "bullish" ? "bearish" : overallBias === "bearish" ? "bullish" : "neutral",
        commodities: overallBias === "bullish" ? "bearish" : overallBias === "bearish" ? "bullish" : "neutral",
        eurUsd: overallBias === "bullish" ? "bearish" : overallBias === "bearish" ? "bullish" : "neutral",
        usdJpy: overallBias,
      },
    });
  } catch (error) {
    console.error("[DXY Analysis] Error:", error);
    return NextResponse.json({
      trends: {
        "1h": RANGING,
        "4h": RANGING,
        "1d": RANGING,
      },
      overallBias: "neutral",
      trendScore: 0,
      impact: { gold: "neutral", commodities: "neutral", eurUsd: "neutral", usdJpy: "neutral" },
    });
  }
}
