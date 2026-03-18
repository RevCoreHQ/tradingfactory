import { NextRequest, NextResponse } from "next/server";
import { generateMarketSummary } from "@/lib/api/llm-analysis";
import type { MarketSummaryRequest } from "@/lib/types/llm";

// Allow up to 60 seconds for market summary LLM calls on Vercel
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body: MarketSummaryRequest = await req.json();
    const result = await generateMarketSummary(body);
    return NextResponse.json(
      { summary: result, timestamp: Date.now() },
      { headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=120" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Market summary error:", message, error);
    return NextResponse.json(
      { summary: null, error: message, timestamp: Date.now() },
      { status: 200 }
    );
  }
}
