import { NextRequest, NextResponse } from "next/server";
import { analyzeBatchInstruments } from "@/lib/api/llm-analysis";
import { upsertCache } from "@/lib/supabase";
import type { LLMBatchRequest } from "@/lib/types/llm";

// Allow up to 60 seconds for batch LLM calls on Vercel
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body: LLMBatchRequest = await req.json();
    console.log(`[LLM Batch] Request received for ${body.instruments?.length || 0} instruments`);
    const result = await analyzeBatchInstruments(body);

    if (!result) {
      console.warn("[LLM Batch] LLM returned null — all providers failed");
      return NextResponse.json(
        { batch: null, error: "All LLM providers failed — check Vercel logs", timestamp: Date.now() },
        { status: 200 }
      );
    }

    console.log(`[LLM Batch] Success via ${result.provider}, ${Object.keys(result.results).length} instruments`);
    upsertCache("llm_batch", result, null, 14_400_000); // 4 hours
    return NextResponse.json(
      { batch: result, timestamp: Date.now() },
      { headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=120" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[LLM Batch] Exception:", message, error);
    return NextResponse.json(
      { batch: null, error: message, timestamp: Date.now() },
      { status: 200 }
    );
  }
}
