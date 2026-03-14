import { NextRequest, NextResponse } from "next/server";
import { analyzeBatchInstruments } from "@/lib/api/llm-analysis";
import type { LLMBatchRequest } from "@/lib/types/llm";

export async function POST(req: NextRequest) {
  try {
    const body: LLMBatchRequest = await req.json();
    const result = await analyzeBatchInstruments(body);
    return NextResponse.json(
      { batch: result, timestamp: Date.now() },
      { headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=120" } }
    );
  } catch (error) {
    console.error("LLM batch error:", error);
    return NextResponse.json({ batch: null, timestamp: Date.now() }, { status: 200 });
  }
}
