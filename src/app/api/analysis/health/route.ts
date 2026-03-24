import { NextResponse } from "next/server";

export const maxDuration = 30;

export async function GET() {
  const providers = {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    massive: !!process.env.MASSIVE_API_KEY,
    fmp: !!process.env.FMP_API_KEY,
  };

  const keyLengths = {
    anthropic: process.env.ANTHROPIC_API_KEY?.length ?? 0,
    gemini: process.env.GEMINI_API_KEY?.length ?? 0,
    openai: process.env.OPENAI_API_KEY?.length ?? 0,
    massive: process.env.MASSIVE_API_KEY?.length ?? 0,
    fmp: process.env.FMP_API_KEY?.length ?? 0,
  };

  const tests: Record<string, string> = {};

  // Test FMP (economic calendar — free tier)
  if (process.env.FMP_API_KEY) {
    try {
      const now = new Date();
      const from = now.toISOString().split("T")[0];
      const to = new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0];
      const res = await fetch(
        `https://financialmodelingprep.com/api/v3/economic_calendar?from=${from}&to=${to}&apikey=${process.env.FMP_API_KEY}`
      );
      if (res.ok) {
        const data = await res.json();
        const count = Array.isArray(data) ? data.length : 0;
        const highImpact = Array.isArray(data)
          ? data.filter((e: { impact: string }) => e.impact?.toLowerCase() === "high").length
          : 0;
        tests.fmp = `ok (${count} events, ${highImpact} high-impact)`;
      } else {
        const body = await res.text().catch(() => "");
        tests.fmp = `error ${res.status}: ${body.slice(0, 200)}`;
      }
    } catch (e) {
      tests.fmp = `exception: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  // Test Anthropic with a tiny call
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 10,
          messages: [{ role: "user", content: "Reply with exactly: ok" }],
        }),
      });
      if (res.ok) {
        tests.anthropic = "ok";
      } else {
        const body = await res.text().catch(() => "");
        tests.anthropic = `error ${res.status}: ${body.slice(0, 300)}`;
      }
    } catch (e) {
      tests.anthropic = `exception: ${e instanceof Error ? e.message : String(e)}`;
    }
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
