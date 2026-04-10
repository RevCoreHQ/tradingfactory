import { NextResponse } from "next/server";
import type { EconomicEvent } from "@/lib/types/market";
import { requireAuth } from "@/lib/auth/require-auth";
import { checkUserRateLimit } from "@/lib/api/rate-limit";

// Uses the Forex Factory calendar XML feed — no API key needed
const FF_CALENDAR_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.xml";

function parseXmlEvents(xml: string): EconomicEvent[] {
  const events: EconomicEvent[] = [];
  // Simple XML parser for the FF calendar format
  const eventMatches = xml.match(/<event>([\s\S]*?)<\/event>/g);
  if (!eventMatches) return events;

  for (let i = 0; i < eventMatches.length; i++) {
    const block = eventMatches[i];

    const get = (tag: string): string => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      if (!m) return "";
      // Strip CDATA wrapper: <![CDATA[value]]> → value
      return m[1].trim().replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
    };

    const title = get("title");
    const country = get("country");
    const rawDate = get("date"); // "01-10-2024" (MM-DD-YYYY)
    const rawTime = get("time"); // "8:30am" or "All Day" or "Tentative"
    const rawImpact = get("impact").toLowerCase();
    const forecast = get("forecast");
    const previous = get("previous");

    // Normalize date from MM-DD-YYYY to YYYY-MM-DD
    let isoDate = "";
    if (rawDate) {
      const parts = rawDate.split("-");
      if (parts.length === 3) {
        isoDate = `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
      }
    }

    // Normalize time
    let time24 = "";
    if (rawTime && rawTime !== "All Day" && rawTime !== "Tentative") {
      const match = rawTime.match(/(\d{1,2}):(\d{2})(am|pm)/i);
      if (match) {
        let h = parseInt(match[1]);
        const m = match[2];
        const ampm = match[3].toLowerCase();
        if (ampm === "pm" && h !== 12) h += 12;
        if (ampm === "am" && h === 12) h = 0;
        time24 = `${String(h).padStart(2, "0")}:${m}`;
      }
    }

    const impact: "low" | "medium" | "high" =
      rawImpact === "high" ? "high" : rawImpact === "medium" ? "medium" : "low";

    // Parse numeric values from forecast/previous (e.g. "180K" -> 180, "3.5%" -> 3.5)
    const parseNum = (s: string): number | undefined => {
      if (!s) return undefined;
      const cleaned = s.replace(/[%KMB]/gi, "").trim();
      const n = parseFloat(cleaned);
      return isNaN(n) ? undefined : n;
    };

    events.push({
      id: `ff-${i}-${isoDate}`,
      country,
      event: title,
      date: isoDate,
      time: time24,
      impact,
      forecast: parseNum(forecast),
      previous: parseNum(previous),
      actual: undefined,
      currency: country, // FF uses currency code as country (USD, EUR, etc.)
    });
  }

  return events;
}

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const rl = checkUserRateLimit(`economic-calendar:${auth.user.id}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { events: [], error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const res = await fetch(FF_CALENDAR_URL, {
      next: { revalidate: 900 },
      headers: {
        "User-Agent": "TradingFactory/1.0",
      },
    });

    if (!res.ok) {
      console.error(`FF calendar error: ${res.status} ${res.statusText}`);
      return NextResponse.json({ events: [] }, { status: 200 });
    }

    const xml = await res.text();
    const events = parseXmlEvents(xml);

    return NextResponse.json(
      { events },
      { headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=120" } }
    );
  } catch (error) {
    console.error("Economic calendar error:", error);
    return NextResponse.json({ error: "Request failed", events: [] }, { status: 500 });
  }
}
