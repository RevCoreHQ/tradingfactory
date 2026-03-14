import { NextResponse } from "next/server";
import { fetchBondYields, fetchDXY, fetchFedFundsRate } from "@/lib/api/fred";

export async function GET() {
  try {
    const [yields, dxy, fedRate] = await Promise.allSettled([
      fetchBondYields(),
      fetchDXY(),
      fetchFedFundsRate(),
    ]);

    return NextResponse.json(
      {
        yields: yields.status === "fulfilled" ? yields.value : [],
        dxy: dxy.status === "fulfilled" ? dxy.value : { value: 0, change: 0, changePercent: 0, history: [] },
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
