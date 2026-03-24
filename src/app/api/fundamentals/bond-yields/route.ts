import { NextResponse } from "next/server";
import { fetchBondYields, fetchFedFundsRate } from "@/lib/api/fred";
import { fetchForexRates } from "@/lib/api/finnhub";
import { fetchTwelveDataBatchQuotes } from "@/lib/api/twelve-data";
import type { DXYData } from "@/lib/types/market";

/**
 * Compute real ICE DXY (~99-105) from the official formula using Finnhub forex rates.
 * DXY = 50.14348112 × EURUSD^(-0.576) × USDJPY^(0.136) × GBPUSD^(-0.119)
 *       × USDCAD^(0.091) × USDSEK^(0.042) × USDCHF^(0.036)
 *
 * FRED's DTWEXBGS is the Trade Weighted Broad Dollar Index (~120-130), NOT the ICE DXY.
 */
async function computeDXY(): Promise<DXYData | null> {
  try {
    const rates = await fetchForexRates("USD");
    // rates[X] = how many X per 1 USD
    const eur = rates["EUR"];
    const jpy = rates["JPY"];
    const gbp = rates["GBP"];
    const cad = rates["CAD"];
    const sek = rates["SEK"];
    const chf = rates["CHF"];

    if (!eur || !jpy || !gbp || !cad || !sek || !chf) return null;

    // Convert to pair prices: EURUSD = 1/rates["EUR"], GBPUSD = 1/rates["GBP"]
    const eurusd = 1 / eur;
    const usdjpy = jpy;
    const gbpusd = 1 / gbp;
    const usdcad = cad;
    const usdsek = sek;
    const usdchf = chf;

    const dxy =
      50.14348112 *
      Math.pow(eurusd, -0.576) *
      Math.pow(usdjpy, 0.136) *
      Math.pow(gbpusd, -0.119) *
      Math.pow(usdcad, 0.091) *
      Math.pow(usdsek, 0.042) *
      Math.pow(usdchf, 0.036);

    // Sanity check: real DXY should be in ~80-120 range
    if (dxy < 70 || dxy > 130) return null;

    return {
      value: Math.round(dxy * 100) / 100,
      change: 0,
      changePercent: 0,
      history: [],
    };
  } catch {
    return null;
  }
}

/**
 * Primary DXY source: Twelve Data /quote for DXY directly.
 * Returns real price, change, and changePercent in one call.
 */
async function fetchDXYDirect(): Promise<DXYData | null> {
  try {
    const quotes = await fetchTwelveDataBatchQuotes(["DXY"]);
    const dxy = quotes["DXY"];
    if (dxy && dxy.price > 70 && dxy.price < 130) {
      return {
        value: Math.round(dxy.price * 100) / 100,
        change: dxy.change,
        changePercent: dxy.changePercent,
        history: [],
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Twelve Data fallback for DXY: fetch the 6 component pairs and apply ICE formula.
 */
async function computeDXYFromTwelveData(): Promise<DXYData | null> {
  try {
    const symbols = ["EUR/USD", "USD/JPY", "GBP/USD", "USD/CAD", "USD/SEK", "USD/CHF"];
    const quotes = await fetchTwelveDataBatchQuotes(symbols);
    const eurusd = quotes["EUR/USD"]?.price;
    const usdjpy = quotes["USD/JPY"]?.price;
    const gbpusd = quotes["GBP/USD"]?.price;
    const usdcad = quotes["USD/CAD"]?.price;
    const usdsek = quotes["USD/SEK"]?.price;
    const usdchf = quotes["USD/CHF"]?.price;

    if (!eurusd || !usdjpy || !gbpusd || !usdcad || !usdsek || !usdchf) return null;

    const dxy =
      50.14348112 *
      Math.pow(eurusd, -0.576) *
      Math.pow(usdjpy, 0.136) *
      Math.pow(gbpusd, -0.119) *
      Math.pow(usdcad, 0.091) *
      Math.pow(usdsek, 0.042) *
      Math.pow(usdchf, 0.036);

    if (dxy < 70 || dxy > 130) return null;

    return {
      value: Math.round(dxy * 100) / 100,
      change: 0,
      changePercent: 0,
      history: [],
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const [yields, directDxy, computedDxy, fedRate] = await Promise.allSettled([
      fetchBondYields(),
      fetchDXYDirect(),
      computeDXY(),
      fetchFedFundsRate(),
    ]);

    // Priority: Twelve Data direct quote (has change data) → computed from Finnhub → computed from Twelve Data pairs
    let dxyResult = directDxy.status === "fulfilled" && directDxy.value
      ? directDxy.value
      : null;

    if (!dxyResult) {
      dxyResult = computedDxy.status === "fulfilled" && computedDxy.value
        ? computedDxy.value
        : null;
    }

    // Last resort: compute from Twelve Data component pairs
    if (!dxyResult) {
      try {
        dxyResult = await computeDXYFromTwelveData();
      } catch { /* silent */ }
    }

    if (!dxyResult) {
      dxyResult = { value: 0, change: 0, changePercent: 0, history: [] };
    }

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
