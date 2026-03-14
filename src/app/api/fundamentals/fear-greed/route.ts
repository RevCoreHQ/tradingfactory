import { NextRequest, NextResponse } from "next/server";
import { fetchFearGreedIndex, fetchFearGreedHistory } from "@/lib/api/fear-greed";

export async function GET(req: NextRequest) {
  try {
    const days = parseInt(req.nextUrl.searchParams.get("days") || "0");

    if (days > 0) {
      const history = await fetchFearGreedHistory(days);
      return NextResponse.json(
        { history },
        { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" } }
      );
    }

    const current = await fetchFearGreedIndex();
    return NextResponse.json(
      { current },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch (error) {
    console.error("Fear & Greed error:", error);
    return NextResponse.json(
      { current: { value: 50, label: "Neutral", timestamp: Date.now(), previousClose: 50, previousWeek: 50, previousMonth: 50 } },
      { status: 200 }
    );
  }
}
