import { NextResponse } from "next/server";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { fetchCandlesForInstrument } from "@/lib/api/massive";
import {
  calculateMTFTrendSummary,
  type CandlesByTimeframe,
} from "@/lib/calculations/mtf-trend";
import type { MTFTimeframe } from "@/lib/types/mtf";
import type { MTFTrendSummary } from "@/lib/types/mtf";

const TIMEFRAMES: { tf: MTFTimeframe; limit: number }[] = [
  { tf: "15m", limit: 100 },
  { tf: "1h", limit: 100 },
  { tf: "4h", limit: 100 },
  { tf: "1d", limit: 200 },
];

const MTF_CONFIG = {
  timeframes: ["1d", "4h", "1h", "15m"] as MTFTimeframe[],
  anchor: "1d" as MTFTimeframe,
  trigger: "15m" as MTFTimeframe,
};

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const results: Record<string, MTFTrendSummary | null> = {};
    const errors: string[] = [];

    // Batch instruments in groups of 4
    const batchSize = 4;
    for (let i = 0; i < INSTRUMENTS.length; i += batchSize) {
      const batch = INSTRUMENTS.slice(i, i + batchSize);
      const settled = await Promise.allSettled(
        batch.map(async (inst) => {
          const data: CandlesByTimeframe = {};

          // Fetch all 4 timeframes in parallel for this instrument
          const tfResults = await Promise.allSettled(
            TIMEFRAMES.map(async ({ tf, limit }) => {
              const candles = await fetchCandlesForInstrument(inst.id, tf, limit);
              return { tf, candles };
            })
          );

          for (const r of tfResults) {
            if (r.status === "fulfilled" && r.value.candles.length >= 50) {
              data[r.value.tf] = r.value.candles;
            }
          }

          const summary = calculateMTFTrendSummary(data, MTF_CONFIG);
          return { id: inst.id, summary };
        })
      );

      for (const s of settled) {
        if (s.status === "fulfilled") {
          results[s.value.id] = s.value.summary;
        } else {
          errors.push(s.reason instanceof Error ? s.reason.message : String(s.reason));
        }
      }
    }

    const successCount = Object.values(results).filter(Boolean).length;
    console.log(
      `[MTFEmaTrend] ${successCount}/${INSTRUMENTS.length} OK${errors.length ? ` | Errors: ${errors.join("; ")}` : ""}`
    );

    return NextResponse.json(
      { trends: results },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=120" } }
    );
  } catch (error) {
    console.error("[MTFEmaTrend] Fatal:", error);
    return NextResponse.json(
      { trends: {} },
      { status: 200 }
    );
  }
}
