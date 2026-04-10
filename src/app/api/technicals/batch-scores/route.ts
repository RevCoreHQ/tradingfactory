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
import type { BiasSignal, TechnicalScore } from "@/lib/types/bias";

const LIMIT_1H = 100;
const LIMIT_15M = 100;

const MTF_TIMEFRAMES: { tf: MTFTimeframe; limit: number }[] = [
  { tf: "15m", limit: LIMIT_15M },
  { tf: "1h", limit: LIMIT_1H },
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
  const dirs = trends.map((t) => t.direction).filter((d) => d !== "neutral");
  if (dirs.length >= 3 && dirs.every((d) => d === dirs[0])) {
    score = Math.min(100, score + 10);
  }
  return score;
}

function blendTechnicalScores(a: TechnicalScore, b: TechnicalScore): TechnicalScore {
  const mid = (x: number, y: number) => clampAvg(x, y);
  return {
    total: mid(a.total, b.total),
    trendDirection: mid(a.trendDirection, b.trendDirection),
    momentum: mid(a.momentum, b.momentum),
    volatility: mid(a.volatility, b.volatility),
    volumeAnalysis: mid(a.volumeAnalysis, b.volumeAnalysis),
    supportResistance: mid(a.supportResistance, b.supportResistance),
  };
}

function clampAvg(x: number, y: number): number {
  const v = (x + y) / 2;
  return Math.max(0, Math.min(100, Math.round(v * 10) / 10));
}

export type BatchScoreEntry = {
  score: TechnicalScore;
  score15m: TechnicalScore;
  score1h: TechnicalScore;
  signals: BiasSignal[];
  currentPrice: number;
  technicalBasis: string;
  /** 0–100 MTF trend alignment (from batch TF weights). */
  mtfAlignmentPercent: number;
};

export const dynamic = "force-dynamic"; // never serve stale cached route

export async function GET() {
  try {
    const results: Record<string, BatchScoreEntry> = {};
    const errors: string[] = [];

    const batchSize = 4;
    for (let i = 0; i < INSTRUMENTS.length; i += batchSize) {
      const batch = INSTRUMENTS.slice(i, i + batchSize);
      const settled = await Promise.allSettled(
        batch.map(async (inst) => {
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

          const candles15m = candlesByTf["15m"] || [];
          const candles1h = candlesByTf["1h"] || [];
          const has15m = candles15m.length >= 20;
          const has1h = candles1h.length >= 20;

          if (!has15m && !has1h) {
            errors.push(`${inst.id}: insufficient candles (15m=${candles15m.length}, 1h=${candles1h.length})`);
            return { id: inst.id, payload: null as BatchScoreEntry | null };
          }

          const mtfSummary = calculateMTFTrendSummary(candlesByTf, MTF_CONFIG);
          const mtfAlignmentScore = mtfSummary
            ? computeAlignmentScore(mtfSummary.trends)
            : undefined;

          let score: TechnicalScore;
          let score15m: TechnicalScore;
          let score1h: TechnicalScore;
          let signals: BiasSignal[];
          let currentPrice: number;
          let technicalBasis: string;
          const mtfPct = mtfAlignmentScore ?? 50;

          if (has15m && has1h) {
            const indicators15m = calculateAllIndicators(candles15m, inst.id, "15m");
            const indicators1h = calculateAllIndicators(candles1h, inst.id, "1h");
            const price15m = candles15m[candles15m.length - 1].close;
            const price1h = candles1h[candles1h.length - 1].close;
            const r15 = calculateTechnicalScore(indicators15m, price15m, mtfAlignmentScore);
            const r1h = calculateTechnicalScore(indicators1h, price1h, mtfAlignmentScore);
            score15m = r15.score;
            score1h = r1h.score;
            score = blendTechnicalScores(r15.score, r1h.score);
            signals = [...r15.signals, ...r1h.signals];
            currentPrice = price15m;
            technicalBasis = "15m + 1h blend, MTF-aligned trend";
          } else if (has15m) {
            const indicators15m = calculateAllIndicators(candles15m, inst.id, "15m");
            const price15m = candles15m[candles15m.length - 1].close;
            const r = calculateTechnicalScore(indicators15m, price15m, mtfAlignmentScore);
            score = r.score;
            score15m = r.score;
            score1h = r.score;
            signals = r.signals;
            currentPrice = price15m;
            technicalBasis = "15m, MTF-aligned trend";
          } else {
            const indicators1h = calculateAllIndicators(candles1h, inst.id, "1h");
            const price1h = candles1h[candles1h.length - 1].close;
            const r = calculateTechnicalScore(indicators1h, price1h, mtfAlignmentScore);
            score = r.score;
            score15m = r.score;
            score1h = r.score;
            signals = r.signals;
            currentPrice = price1h;
            technicalBasis = "1h, MTF-aligned trend";
          }

          return {
            id: inst.id,
            payload: {
              score,
              score15m,
              score1h,
              signals,
              currentPrice,
              technicalBasis,
              mtfAlignmentPercent: Math.round(mtfPct),
            },
          };
        })
      );

      for (const s of settled) {
        if (s.status === "fulfilled" && s.value.payload) {
          results[s.value.id] = s.value.payload;
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
