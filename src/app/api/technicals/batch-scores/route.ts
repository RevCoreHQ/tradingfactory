import { NextResponse } from "next/server";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { fetchTwelveDataCandles, TWELVE_DATA_INTERVALS } from "@/lib/api/twelve-data";
import { fetchForexCandleData } from "@/lib/api/finnhub";
import { fetchCryptoOHLC } from "@/lib/api/coingecko";
import { calculateAllIndicators } from "@/lib/calculations/technical-indicators";
import { calculateTechnicalScore } from "@/lib/calculations/bias-engine";
import type { OHLCV } from "@/lib/types/market";
import type { TechnicalScore } from "@/lib/types/bias";

const TIMEFRAME = "1h";
const LIMIT = 200;

async function fetchCandles(inst: (typeof INSTRUMENTS)[number]): Promise<OHLCV[]> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 30 * 24 * 60 * 60;

  if (inst.category === "crypto") {
    try {
      return await fetchCryptoOHLC(inst.coingeckoId || "bitcoin", 30);
    } catch {
      return [];
    }
  }

  // Forex, commodity, index — Twelve Data first, Finnhub fallback
  try {
    const tdInterval = TWELVE_DATA_INTERVALS[TIMEFRAME] || "1h";
    const tdSymbol = inst.twelveDataSymbol || inst.symbol;
    const candles = await fetchTwelveDataCandles(tdSymbol, tdInterval, LIMIT);
    if (candles.length > 0) return candles;
  } catch {}

  try {
    const resolution = "60";
    return await fetchForexCandleData(inst.finnhubSymbol || "", resolution, from, now);
  } catch {}

  return [];
}

export async function GET() {
  try {
    const results: Record<string, { score: TechnicalScore; currentPrice: number }> = {};

    // Fetch all in parallel (batches of 8 to avoid rate limits)
    const batchSize = 8;
    for (let i = 0; i < INSTRUMENTS.length; i += batchSize) {
      const batch = INSTRUMENTS.slice(i, i + batchSize);
      const settled = await Promise.allSettled(
        batch.map(async (inst) => {
          const candles = (await fetchCandles(inst)).slice(-LIMIT);
          if (candles.length < 20) return { id: inst.id, score: null, currentPrice: 0 };
          const indicators = calculateAllIndicators(candles, inst.id, TIMEFRAME);
          const currentPrice = candles[candles.length - 1].close;
          const { score } = calculateTechnicalScore(indicators, currentPrice);
          return { id: inst.id, score, currentPrice };
        })
      );

      for (const s of settled) {
        if (s.status === "fulfilled" && s.value.score) {
          results[s.value.id] = { score: s.value.score, currentPrice: s.value.currentPrice };
        }
      }
    }

    return NextResponse.json(
      { scores: results },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=120" } }
    );
  } catch (error) {
    console.error("[BatchScores] Error:", error);
    return NextResponse.json({ scores: {} }, { status: 200 });
  }
}
