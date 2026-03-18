import { NextRequest, NextResponse } from "next/server";
import { analyzeBatchInstruments } from "@/lib/api/llm-analysis";
import type { LLMBatchRequest } from "@/lib/types/llm";

// Allow up to 60 seconds for batch LLM calls on Vercel
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body: LLMBatchRequest = await req.json();
    const result = await analyzeBatchInstruments(body);
    return NextResponse.json(
      { batch: result, timestamp: Date.now() },
      { headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=120" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("LLM batch error:", message, error);
    return NextResponse.json(
      { batch: null, error: message, timestamp: Date.now() },
      { status: 200 }
    );
  }
}
