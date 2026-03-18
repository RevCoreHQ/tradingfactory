import { NextResponse } from "next/server";
import { CFTC_CURRENCY_CODES } from "@/lib/types/cot";
import type { COTPosition } from "@/lib/types/cot";

/**
 * Fetch COT (Commitment of Traders) data from CFTC Socrata API.
 * Returns latest 2 weeks of positioning data for each currency.
 * Free, no API key required.
 */

interface CFTCRecord {
  report_date_as_yyyy_mm_dd: string;
  cftc_commodity_code: string;
  commodity_name: string;
  noncomm_positions_long_all: string;
  noncomm_positions_short_all: string;
  comm_positions_long_all: string;
  comm_positions_short_all: string;
  open_interest_all: string;
}

const CFTC_API = "https://publicreporting.cftc.gov/resource/jun7-fc8e.json";

export async function GET() {
  try {
    const codes = Object.values(CFTC_CURRENCY_CODES);
    const codeFilter = codes.map((c) => `'${c}'`).join(",");

    const url = `${CFTC_API}?$where=cftc_commodity_code in(${codeFilter})&$order=report_date_as_yyyy_mm_dd DESC&$limit=40`;

    const res = await fetch(url, {
      next: { revalidate: 3600 }, // CFTC data updates weekly (Friday)
    });

    if (!res.ok) {
      throw new Error(`CFTC API error: ${res.status}`);
    }

    const records: CFTCRecord[] = await res.json();

    // Group by currency code and take latest 2 reports per currency
    const codeToName = Object.entries(CFTC_CURRENCY_CODES).reduce(
      (acc, [currency, code]) => ({ ...acc, [code]: currency }),
      {} as Record<string, string>
    );

    const grouped: Record<string, CFTCRecord[]> = {};
    for (const rec of records) {
      const currency = codeToName[rec.cftc_commodity_code];
      if (!currency) continue;
      if (!grouped[currency]) grouped[currency] = [];
      if (grouped[currency].length < 2) {
        grouped[currency].push(rec);
      }
    }

    const positions: COTPosition[] = [];

    for (const [currency, recs] of Object.entries(grouped)) {
      const latest = recs[0];
      const previous = recs[1];

      const longSpec = parseInt(latest.noncomm_positions_long_all) || 0;
      const shortSpec = parseInt(latest.noncomm_positions_short_all) || 0;
      const netSpec = longSpec - shortSpec;

      const longComm = parseInt(latest.comm_positions_long_all) || 0;
      const shortComm = parseInt(latest.comm_positions_short_all) || 0;
      const netComm = longComm - shortComm;

      const openInterest = parseInt(latest.open_interest_all) || 1;

      const prevLongSpec = previous ? parseInt(previous.noncomm_positions_long_all) || 0 : 0;
      const prevShortSpec = previous ? parseInt(previous.noncomm_positions_short_all) || 0 : 0;
      const prevNetSpec = prevLongSpec - prevShortSpec;

      const totalSpec = longSpec + shortSpec || 1;

      positions.push({
        currency,
        reportDate: latest.report_date_as_yyyy_mm_dd,
        longSpeculative: longSpec,
        shortSpeculative: shortSpec,
        netSpeculative: netSpec,
        longCommercial: longComm,
        shortCommercial: shortComm,
        netCommercial: netComm,
        openInterest,
        netSpecChange: netSpec - prevNetSpec,
        percentLong: Math.round((longSpec / totalSpec) * 100),
      });
    }

    // Sort by absolute net speculative (most positioned first)
    positions.sort((a, b) => Math.abs(b.netSpeculative) - Math.abs(a.netSpeculative));

    return NextResponse.json(
      {
        positions,
        lastUpdated: positions[0]?.reportDate || "",
      },
      {
        headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=1800" },
      }
    );
  } catch (error) {
    console.error("COT data error:", error);
    return NextResponse.json(
      { positions: [], lastUpdated: "" },
      { status: 200 }
    );
  }
}
