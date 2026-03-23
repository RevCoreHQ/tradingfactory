import { NextRequest, NextResponse } from "next/server";
import { generateTradingAdvisor } from "@/lib/api/llm-analysis";
import { upsertCache } from "@/lib/supabase";
import type { TradingAdvisorRequest } from "@/lib/types/llm";

// Allow up to 60 seconds for advisor LLM calls on Vercel
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body: TradingAdvisorRequest = await req.json();
    console.log("[Trade Advisor] Request received, calling LLM...");
    const result = await generateTradingAdvisor(body);

    if (!result) {
      console.warn("[Trade Advisor] LLM returned null — all providers failed");
      return NextResponse.json(
        { advisor: null, error: "All LLM providers failed", timestamp: Date.now() },
        { status: 200 }
      );
    }

    console.log(`[Trade Advisor] Success via ${result.provider}`);
    upsertCache("trade_advisor", result, null, 120_000); // 2 minutes
    return NextResponse.json(
      { advisor: result, timestamp: Date.now() },
      { headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=120" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Trade Advisor] Exception:", message, error);
    return NextResponse.json(
      { advisor: null, error: message, timestamp: Date.now() },
      { status: 200 }
    );
  }
}
