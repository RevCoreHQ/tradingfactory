import { NextRequest, NextResponse } from "next/server";
import { fetchEconomicCalendar } from "@/lib/api/finnhub";

export async function GET(req: NextRequest) {
  try {
    const now = new Date();
    const from = req.nextUrl.searchParams.get("from") || now.toISOString().split("T")[0];
    const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const to = req.nextUrl.searchParams.get("to") || futureDate.toISOString().split("T")[0];

    const events = await fetchEconomicCalendar(from, to);

    return NextResponse.json(
      { events },
      { headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=120" } }
    );
  } catch (error) {
    console.error("Economic calendar error:", error);
    return NextResponse.json({ events: [] }, { status: 200 });
  }
}
