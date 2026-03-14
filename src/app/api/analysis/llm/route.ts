import { NextRequest, NextResponse } from "next/server";
import { analyzeSingleInstrument } from "@/lib/api/llm-analysis";
import type { LLMAnalysisRequest } from "@/lib/types/llm";

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
    console.error("LLM analysis error:", error);
    return NextResponse.json({ analysis: null, timestamp: Date.now() }, { status: 200 });
  }
}
