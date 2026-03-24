import { NextResponse } from "next/server";
import { fetchMassiveForexQuotes } from "@/lib/api/massive";
import { fetchMassiveCandles } from "@/lib/api/massive";

export const dynamic = "force-dynamic";

// DXY component weights (ICE Dollar Index)
const DXY_PAIRS = [
  { ticker: "C:EURUSD", weight: -0.576, label: "EUR/USD" },
  { ticker: "C:USDJPY", weight: 0.136, label: "USD/JPY" },
  { ticker: "C:GBPUSD", weight: -0.119, label: "GBP/USD" },
  { ticker: "C:USDCAD", weight: 0.091, label: "USD/CAD" },
  { ticker: "C:USDSEK", weight: 0.042, label: "USD/SEK" },
  { ticker: "C:USDCHF", weight: 0.036, label: "USD/CHF" },
];

// Simple trend detection from candle series
function detectTrend(closes: number[]): { direction: "bullish" | "bearish" | "ranging"; strength: number } {
  if (closes.length < 10) return { direction: "ranging", strength: 0 };

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
  return { direction: "ranging", strength: 0 };
}

export async function GET() {
  try {
    // Fetch current DXY quotes for spot price
    const tickers = DXY_PAIRS.map((p) => p.ticker);
    const quotes = await fetchMassiveForexQuotes(tickers);

    // Fetch EUR/USD candles at multiple timeframes (DXY is ~57.6% inverse EUR/USD)
    // We use EUR/USD as primary proxy since it dominates DXY
    const [h1Candles, h4Candles, d1Candles] = await Promise.all([
      fetchMassiveCandles("C:EURUSD", "1h", 50),
      fetchMassiveCandles("C:EURUSD", "4h", 50),
      fetchMassiveCandles("C:EURUSD", "1d", 50),
    ]);

    // DXY is INVERSE of EUR/USD (when EUR falls, DXY rises)
    const invertCloses = (candles: typeof h1Candles) =>
      candles.map((c) => c.close > 0 ? 1 / c.close : 0).filter((v) => v > 0);

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
        "1h": { direction: "ranging", strength: 0 },
        "4h": { direction: "ranging", strength: 0 },
        "1d": { direction: "ranging", strength: 0 },
      },
      overallBias: "neutral",
      trendScore: 0,
      impact: { gold: "neutral", commodities: "neutral", eurUsd: "neutral", usdJpy: "neutral" },
    });
  }
}
