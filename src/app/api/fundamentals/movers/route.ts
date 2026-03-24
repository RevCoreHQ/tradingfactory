import { NextResponse } from "next/server";
import { fetchMassiveMovers } from "@/lib/api/massive";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [gainers, losers] = await Promise.all([
      fetchMassiveMovers("gainers"),
      fetchMassiveMovers("losers"),
    ]);

    return NextResponse.json(
      { gainers: gainers.slice(0, 8), losers: losers.slice(0, 8) },
      { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } }
    );
  } catch (error) {
    console.error("[Movers] Error:", error);
    return NextResponse.json({ gainers: [], losers: [] }, { status: 200 });
  }
}
