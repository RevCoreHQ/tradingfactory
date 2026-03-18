import { NextRequest, NextResponse } from "next/server";
import { analyzeDeepAnalysis } from "@/lib/api/llm-analysis";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await analyzeDeepAnalysis(body);
    return NextResponse.json(
      { analysis: result, timestamp: Date.now() },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Deep analysis error:", message);
    return NextResponse.json(
      { analysis: null, error: message, timestamp: Date.now() },
      { status: 200 }
    );
  }
}
