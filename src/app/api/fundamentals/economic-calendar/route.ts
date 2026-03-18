import { NextRequest, NextResponse } from "next/server";
import type { EconomicEvent } from "@/lib/types/market";

// Uses Financial Modeling Prep (FMP) — free tier includes economic calendar
// Sign up at https://financialmodelingprep.com/ for a free API key

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.FMP_API_KEY;
    if (!apiKey) {
      console.warn("FMP_API_KEY not configured — economic calendar unavailable");
      return NextResponse.json({ events: [] }, { status: 200 });
    }

    const now = new Date();
    const from = req.nextUrl.searchParams.get("from") || now.toISOString().split("T")[0];
    const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const to = req.nextUrl.searchParams.get("to") || futureDate.toISOString().split("T")[0];

    const url = `https://financialmodelingprep.com/api/v3/economic_calendar?from=${from}&to=${to}&apikey=${apiKey}`;
    const res = await fetch(url, { next: { revalidate: 900 } });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`FMP economic calendar error: ${res.status} ${body.slice(0, 200)}`);
      return NextResponse.json({ events: [] }, { status: 200 });
    }

    const data: Array<{
      event: string;
      date: string;
      country: string;
      currency: string;
      previous: number | null;
      estimate: number | null;
      actual: number | null;
      change: number | null;
      impact: string;
      unit?: string;
    }> = await res.json();

    const events: EconomicEvent[] = (data || []).map((item, i) => {
      // FMP impact: "Low", "Medium", "High"
      const impact = item.impact?.toLowerCase();
      const normalizedImpact: "low" | "medium" | "high" =
        impact === "high" ? "high" : impact === "medium" ? "medium" : "low";

      // Extract date and time from the date string (format: "2024-01-15 08:30:00")
      const [datePart, timePart] = (item.date || "").split(" ");

      return {
        id: `fmp-${i}-${datePart}`,
        country: item.country || "",
        event: item.event || "",
        date: datePart || "",
        time: timePart ? timePart.slice(0, 5) : "",
        impact: normalizedImpact,
        forecast: item.estimate ?? undefined,
        previous: item.previous ?? undefined,
        actual: item.actual ?? undefined,
        currency: item.currency || "",
        unit: item.unit,
      };
    });

    return NextResponse.json(
      { events },
      { headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=120" } }
    );
  } catch (error) {
    console.error("Economic calendar error:", error);
    return NextResponse.json({ events: [] }, { status: 200 });
  }
}
