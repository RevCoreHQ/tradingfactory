import { NextResponse } from "next/server";

export const maxDuration = 30;

export async function GET() {
  const providers = {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
  };

  const keyLengths = {
    anthropic: process.env.ANTHROPIC_API_KEY?.length ?? 0,
    gemini: process.env.GEMINI_API_KEY?.length ?? 0,
    openai: process.env.OPENAI_API_KEY?.length ?? 0,
  };

  // Actually test each configured provider with a simple call
  const tests: Record<string, string> = {};

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

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2024-10-22",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 20,
          messages: [{ role: "user", content: "Reply with exactly: {\"ok\":true}" }],
        }),
      });
      if (res.ok) {
        tests.anthropic = "ok";
      } else {
        const body = await res.text().catch(() => "");
        tests.anthropic = `error ${res.status}: ${body.slice(0, 200)}`;
      }
    } catch (e) {
      tests.anthropic = `exception: ${e instanceof Error ? e.message : String(e)}`;
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
