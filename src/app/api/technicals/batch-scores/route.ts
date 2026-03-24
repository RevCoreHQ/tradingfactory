import { NextResponse } from "next/server";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { fetchCandlesForInstrument } from "@/lib/api/massive";
import { calculateAllIndicators } from "@/lib/calculations/technical-indicators";
import { calculateTechnicalScore } from "@/lib/calculations/bias-engine";
import type { TechnicalScore } from "@/lib/types/bias";

const TIMEFRAME = "1h";
const LIMIT = 200;

export async function GET() {
  try {
    const results: Record<string, { score: TechnicalScore; currentPrice: number }> = {};

    // Fetch all in parallel (batches of 8 to be polite)
    const batchSize = 8;
    for (let i = 0; i < INSTRUMENTS.length; i += batchSize) {
      const batch = INSTRUMENTS.slice(i, i + batchSize);
      const settled = await Promise.allSettled(
        batch.map(async (inst) => {
          const candles = (await fetchCandlesForInstrument(inst.id, TIMEFRAME, LIMIT)).slice(-LIMIT);
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
        } else if (s.status === "rejected") {
          console.error(`[BatchScores] Promise rejected:`, s.reason);
        } else if (s.status === "fulfilled" && !s.value.score) {
          console.warn(`[BatchScores] No score for ${s.value.id} (insufficient candles)`);
        }
      }
    }

    console.log(`[BatchScores] Computed scores for ${Object.keys(results).length}/${INSTRUMENTS.length} instruments`);

    return NextResponse.json(
      { scores: results },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=120" } }
    );
  } catch (error) {
    console.error("[BatchScores] Error:", error);
    return NextResponse.json({ scores: {} }, { status: 200 });
  }
}
