import { NextResponse } from "next/server";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { fetchCandlesForInstrument } from "@/lib/api/massive";
import { calculateAllIndicators } from "@/lib/calculations/technical-indicators";
import { calculateTechnicalScore } from "@/lib/calculations/bias-engine";
import {
  calculateMTFTrendSummary,
  type CandlesByTimeframe,
} from "@/lib/calculations/mtf-trend";
import type { MTFTimeframe } from "@/lib/types/mtf";
import type { TechnicalScore } from "@/lib/types/bias";

const TIMEFRAME = "1h";
const LIMIT = 100; // 100 hourly candles is plenty for RSI/MACD/BB

const MTF_TIMEFRAMES: { tf: MTFTimeframe; limit: number }[] = [
  { tf: "15m", limit: 100 },
  { tf: "1h", limit: 100 }, // reuses the same candles fetched for indicators
  { tf: "4h", limit: 100 },
  { tf: "1d", limit: 200 },
];

const MTF_CONFIG = {
  timeframes: ["1d", "4h", "1h", "15m"] as MTFTimeframe[],
  anchor: "1d" as MTFTimeframe,
  trigger: "15m" as MTFTimeframe,
};

// TF weights for computing MTF alignment score (0-100)
const TF_WEIGHTS: Record<string, number> = {
  "15m": 0.10,
  "1h": 0.20,
  "4h": 0.30,
  "1d": 0.40,
};

function computeAlignmentScore(trends: { timeframe: string; direction: string }[]): number {
  let score = 0;
  for (const t of trends) {
    const w = TF_WEIGHTS[t.timeframe] || 0;
    score += w * (t.direction === "bullish" ? 100 : t.direction === "bearish" ? 0 : 50);
  }
  // Full alignment bonus
  const dirs = trends.map((t) => t.direction).filter((d) => d !== "neutral");
  if (dirs.length >= 3 && dirs.every((d) => d === dirs[0])) {
    score = Math.min(100, score + 10);
  }
  return score;
}

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
          // Fetch all timeframes for MTF trend
          const candlesByTf: CandlesByTimeframe = {};
          const tfResults = await Promise.allSettled(
            MTF_TIMEFRAMES.map(async ({ tf, limit }) => {
              const candles = await fetchCandlesForInstrument(inst.id, tf, limit);
              return { tf, candles };
            })
          );

          for (const r of tfResults) {
            if (r.status === "fulfilled" && r.value.candles.length > 0) {
              candlesByTf[r.value.tf] = r.value.candles;
            }
          }

          // Use 1h candles for indicator calculations
          const candles1h = candlesByTf["1h"] || [];
          if (candles1h.length < 20) {
            errors.push(`${inst.id}: only ${candles1h.length} 1h candles`);
            return { id: inst.id, score: null, currentPrice: 0 };
          }

          // Compute MTF trend and alignment score
          const mtfSummary = calculateMTFTrendSummary(candlesByTf, MTF_CONFIG);
          const mtfAlignmentScore = mtfSummary
            ? computeAlignmentScore(mtfSummary.trends)
            : undefined;

          const indicators = calculateAllIndicators(candles1h, inst.id, TIMEFRAME);
          const currentPrice = candles1h[candles1h.length - 1].close;
          const { score } = calculateTechnicalScore(indicators, currentPrice, mtfAlignmentScore);
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
