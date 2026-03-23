import { NextResponse } from "next/server";
import { fetchBondYields, fetchDXY, fetchFedFundsRate } from "@/lib/api/fred";
import { fetchTwelveDataCandles } from "@/lib/api/twelve-data";
import type { DXYData } from "@/lib/types/market";

/**
 * Fetch real DXY (ICE US Dollar Index) from Twelve Data.
 * FRED's DTWEXBGS is the Trade Weighted Broad Dollar Index (~120-130 range),
 * NOT the traditional DXY (~99-105 range). This function gets the actual DXY.
 */
async function fetchRealDXY(): Promise<DXYData | null> {
  try {
    const candles = await fetchTwelveDataCandles("DXY", "1day", 30);
    if (candles.length < 2) return null;

    const current = candles[candles.length - 1].close;
    const previous = candles[candles.length - 2].close;
    const change = current - previous;
    const changePercent = (change / previous) * 100;

    return {
      value: current,
      change,
      changePercent,
      history: candles.map((c) => ({
        date: new Date(c.timestamp).toISOString().split("T")[0],
        value: c.close,
      })),
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const [yields, realDxy, fredDxy, fedRate] = await Promise.allSettled([
      fetchBondYields(),
      fetchRealDXY(),
      fetchDXY(),
      fetchFedFundsRate(),
    ]);

    // Prefer real DXY from Twelve Data; fall back to FRED's Broad Dollar Index
    const dxyResult = realDxy.status === "fulfilled" && realDxy.value
      ? realDxy.value
      : fredDxy.status === "fulfilled"
        ? fredDxy.value
        : { value: 0, change: 0, changePercent: 0, history: [] };

    return NextResponse.json(
      {
        yields: yields.status === "fulfilled" ? yields.value : [],
        dxy: dxyResult,
        fedRate: fedRate.status === "fulfilled" ? fedRate.value : { current: 0, previous: 0, target: 0 },
      },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=120" } }
    );
  } catch (error) {
    console.error("Bond yields error:", error);
    return NextResponse.json(
      {
        yields: [],
        dxy: { value: 0, change: 0, changePercent: 0, history: [] },
        fedRate: { current: 0, previous: 0, target: 0 },
      },
      { status: 200 }
    );
  }
}
