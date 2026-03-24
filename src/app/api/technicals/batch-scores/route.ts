import { NextResponse } from "next/server";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { fetchCandlesForInstrument } from "@/lib/api/massive";
import { calculateAllIndicators } from "@/lib/calculations/technical-indicators";
import { calculateTechnicalScore } from "@/lib/calculations/bias-engine";
import type { TechnicalScore } from "@/lib/types/bias";

const TIMEFRAME = "1h";
const LIMIT = 100; // 100 hourly candles is plenty for RSI/MACD/BB

export const dynamic = "force-dynamic"; // never serve stale cached route

export async function GET() {
  try {
    const results: Record<string, { score: TechnicalScore; currentPrice: number }> = {};
    const errors: string[] = [];

    // Fetch in batches of 4 to avoid rate limits
    const batchSize = 4;
    for (let i = 0; i < INSTRUMENTS.length; i += batchSize) {
      const batch = INSTRUMENTS.slice(i, i + batchSize);
      const settled = await Promise.allSettled(
        batch.map(async (inst) => {
          const candles = await fetchCandlesForInstrument(inst.id, TIMEFRAME, LIMIT);
          if (candles.length < 20) {
            errors.push(`${inst.id}: only ${candles.length} candles`);
            return { id: inst.id, score: null, currentPrice: 0 };
          }
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
          const reason = s.reason instanceof Error ? s.reason.message : String(s.reason);
          errors.push(`rejected: ${reason}`);
        }
      }
    }

    const successCount = Object.keys(results).length;
    console.log(`[BatchScores] ${successCount}/${INSTRUMENTS.length} OK${errors.length ? ` | Errors: ${errors.join("; ")}` : ""}`);

    return NextResponse.json(
      { scores: results, debug: { success: successCount, total: INSTRUMENTS.length, errors } },
      { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } }
    );
  } catch (error) {
    console.error("[BatchScores] Fatal:", error);
    return NextResponse.json(
      { scores: {}, debug: { success: 0, total: INSTRUMENTS.length, errors: [String(error)] } },
      { status: 200 }
    );
  }
}
