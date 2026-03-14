import { NextResponse } from "next/server";
import { fetchFedFundsRate } from "@/lib/api/fred";
import type { CentralBankRate } from "@/lib/types/market";

export async function GET() {
  try {
    const fedRate = await fetchFedFundsRate();

    const banks: CentralBankRate[] = [
      {
        bank: "Federal Reserve",
        currency: "USD",
        currentRate: fedRate.current || 5.33,
        previousRate: fedRate.previous || 5.33,
        lastChanged: "2023-07-26",
        nextMeeting: "2025-03-19",
        rateDirection: fedRate.current > fedRate.previous ? "hiking" : fedRate.current < fedRate.previous ? "cutting" : "holding",
        policyStance: "hawkish",
      },
      {
        bank: "European Central Bank",
        currency: "EUR",
        currentRate: 2.65,
        previousRate: 2.90,
        lastChanged: "2025-01-30",
        nextMeeting: "2025-04-17",
        rateDirection: "cutting",
        policyStance: "dovish",
      },
      {
        bank: "Bank of Japan",
        currency: "JPY",
        currentRate: 0.50,
        previousRate: 0.25,
        lastChanged: "2025-01-24",
        nextMeeting: "2025-03-14",
        rateDirection: "hiking",
        policyStance: "hawkish",
      },
      {
        bank: "Bank of England",
        currency: "GBP",
        currentRate: 4.50,
        previousRate: 4.75,
        lastChanged: "2025-02-06",
        nextMeeting: "2025-03-20",
        rateDirection: "cutting",
        policyStance: "neutral",
      },
    ];

    return NextResponse.json(
      { banks },
      { headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=600" } }
    );
  } catch (error) {
    console.error("Central banks error:", error);
    return NextResponse.json({ banks: [] }, { status: 200 });
  }
}
