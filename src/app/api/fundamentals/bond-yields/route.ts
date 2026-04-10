import { NextResponse } from "next/server";
import { fetchBondYields, fetchFedFundsRate } from "@/lib/api/fred";
import { fetchMassiveForexQuotes } from "@/lib/api/massive";
import type { DXYData } from "@/lib/types/market";

/**
 * Compute real ICE DXY (~99-105) from the official formula using Massive forex quotes.
 * DXY = 50.14348112 × EURUSD^(-0.576) × USDJPY^(0.136) × GBPUSD^(-0.119)
 *       × USDCAD^(0.091) × USDSEK^(0.042) × USDCHF^(0.036)
 */
async function computeDXY(): Promise<DXYData | null> {
  try {
    const tickers = ["C:EURUSD", "C:USDJPY", "C:GBPUSD", "C:USDCAD", "C:USDSEK", "C:USDCHF"];
    const quotes = await fetchMassiveForexQuotes(tickers);

    const eurusd = quotes["C:EURUSD"]?.price;
    const usdjpy = quotes["C:USDJPY"]?.price;
    const gbpusd = quotes["C:GBPUSD"]?.price;
    const usdcad = quotes["C:USDCAD"]?.price;
    const usdsek = quotes["C:USDSEK"]?.price;
    const usdchf = quotes["C:USDCHF"]?.price;

    if (!eurusd || !usdjpy || !gbpusd || !usdcad || !usdsek || !usdchf) return null;

    const dxyFormula = (
      e: number,
      j: number,
      g: number,
      c: number,
      k: number,
      f: number
    ) =>
      50.14348112 *
      Math.pow(e, -0.576) *
      Math.pow(j, 0.136) *
      Math.pow(g, -0.119) *
      Math.pow(c, 0.091) *
      Math.pow(k, 0.042) *
      Math.pow(f, 0.036);

    const dxy = dxyFormula(eurusd, usdjpy, gbpusd, usdcad, usdsek, usdchf);

    // Prior session proxy: Polygon snapshot `change` is move vs prior close per pair
    const prev = (p: number, q: { change?: number } | undefined) => p - (q?.change ?? 0);
    const dxyPrev = dxyFormula(
      prev(eurusd, quotes["C:EURUSD"]),
      prev(usdjpy, quotes["C:USDJPY"]),
      prev(gbpusd, quotes["C:GBPUSD"]),
      prev(usdcad, quotes["C:USDCAD"]),
      prev(usdsek, quotes["C:USDSEK"]),
      prev(usdchf, quotes["C:USDCHF"])
    );

    // Sanity check: real DXY should be in ~80-120 range
    if (dxy < 70 || dxy > 130) return null;

    const change = Math.round((dxy - dxyPrev) * 100) / 100;
    const changePercent =
      dxyPrev !== 0 ? Math.round((change / dxyPrev) * 10_000) / 100 : 0;

    return {
      value: Math.round(dxy * 100) / 100,
      change,
      changePercent,
      history: [],
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const [yields, dxyResult, fedRate] = await Promise.allSettled([
      fetchBondYields(),
      computeDXY(),
      fetchFedFundsRate(),
    ]);

    const dxy = (dxyResult.status === "fulfilled" && dxyResult.value)
      ? dxyResult.value
      : { value: 0, change: 0, changePercent: 0, history: [] };

    return NextResponse.json(
      {
        yields: yields.status === "fulfilled" ? yields.value : [],
        dxy,
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
