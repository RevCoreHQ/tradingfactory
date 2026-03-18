import { NextResponse } from "next/server";

export const maxDuration = 30;

export async function GET() {
  const providers = {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    finnhub: !!process.env.FINNHUB_API_KEY,
  };

  const keyLengths = {
    anthropic: process.env.ANTHROPIC_API_KEY?.length ?? 0,
    gemini: process.env.GEMINI_API_KEY?.length ?? 0,
    finnhub: process.env.FINNHUB_API_KEY?.length ?? 0,
  };

  // Test each configured provider with a real API call
  const tests: Record<string, string> = {};

  // Test Finnhub (economic calendar)
  if (process.env.FINNHUB_API_KEY) {
    try {
      const now = new Date();
      const from = now.toISOString().split("T")[0];
      const to = new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0];
      const res = await fetch(
        `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${process.env.FINNHUB_API_KEY}`
      );
      if (res.ok) {
        const data = await res.json();
        const count = data.economicCalendar?.length ?? 0;
        const highImpact = (data.economicCalendar || []).filter(
          (e: { impact: string | number }) => {
            const v = String(e.impact).toLowerCase();
            return v === "high" || v === "3";
          }
        ).length;
        tests.finnhub = `ok (${count} events, ${highImpact} high-impact)`;
      } else {
        const body = await res.text().catch(() => "");
        tests.finnhub = `error ${res.status}: ${body.slice(0, 200)}`;
      }
    } catch (e) {
      tests.finnhub = `exception: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  // Test Anthropic (skip live call to avoid wasting rate limit)
  if (process.env.ANTHROPIC_API_KEY) {
    tests.anthropic = "key configured (skipping live test to preserve rate limit)";
  }

  // Test Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Reply with exactly: {\"ok\":true}" }] }],
          generationConfig: { maxOutputTokens: 20 },
        }),
      });
      if (res.ok) {
        tests.gemini = "ok";
      } else {
        const body = await res.text().catch(() => "");
        tests.gemini = `error ${res.status}: ${body.slice(0, 200)}`;
      }
    } catch (e) {
      tests.gemini = `exception: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  return NextResponse.json({
    providers,
    keyLengths,
    tests,
    anyConfigured: Object.values(providers).some(Boolean),
    timestamp: Date.now(),
  });
}
