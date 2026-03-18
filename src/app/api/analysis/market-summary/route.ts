import { NextRequest, NextResponse } from "next/server";
import { generateMarketSummary } from "@/lib/api/llm-analysis";
import type { MarketSummaryRequest } from "@/lib/types/llm";

export async function POST(req: NextRequest) {
  try {
    const body: MarketSummaryRequest = await req.json();
    const result = await generateMarketSummary(body);
    return NextResponse.json(
      { summary: result, timestamp: Date.now() },
      { headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=120" } }
    );
  } catch (error) {
    console.error("Market summary error:", error);
    return NextResponse.json({ summary: null, timestamp: Date.now() }, { status: 200 });
  }
}
