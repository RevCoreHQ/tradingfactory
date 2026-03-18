import { NextRequest, NextResponse } from "next/server";
import { analyzeSingleInstrument } from "@/lib/api/llm-analysis";
import type { LLMAnalysisRequest } from "@/lib/types/llm";

// Allow up to 30 seconds for single LLM calls on Vercel
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body: LLMAnalysisRequest = await req.json();
    if (!body.instrument) {
      return NextResponse.json({ analysis: null }, { status: 400 });
    }
    const analysis = await analyzeSingleInstrument(body);
    return NextResponse.json(
      { analysis, timestamp: Date.now() },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("LLM analysis error:", message, error);
    return NextResponse.json(
      { analysis: null, error: message, timestamp: Date.now() },
      { status: 200 }
    );
  }
}
