import { NextResponse } from "next/server";

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

  return NextResponse.json({
    providers,
    keyLengths,
    anyConfigured: Object.values(providers).some(Boolean),
    timestamp: Date.now(),
  });
}
