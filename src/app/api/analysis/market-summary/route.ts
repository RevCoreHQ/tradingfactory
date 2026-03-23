import { NextRequest, NextResponse } from "next/server";
import { generateMarketSummary } from "@/lib/api/llm-analysis";
import { upsertCache } from "@/lib/supabase";
import type { MarketSummaryRequest } from "@/lib/types/llm";

// Allow up to 60 seconds for market summary LLM calls on Vercel
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body: MarketSummaryRequest = await req.json();
    console.log("[Market Summary] Request received, calling LLM...");
    const result = await generateMarketSummary(body);

    if (!result) {
      console.warn("[Market Summary] LLM returned null — all providers failed");
      return NextResponse.json(
        { summary: null, error: "All LLM providers failed — check Vercel logs", timestamp: Date.now() },
        { status: 200 }
      );
    }

    console.log(`[Market Summary] Success via ${result.provider}`);
    upsertCache("market_summary", result, null, 3_600_000); // 1 hour
    return NextResponse.json(
      { summary: result, timestamp: Date.now() },
      { headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=120" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Market Summary] Exception:", message, error);
    return NextResponse.json(
      { summary: null, error: message, timestamp: Date.now() },
      { status: 200 }
    );
  }
}
