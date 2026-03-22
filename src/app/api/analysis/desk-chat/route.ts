import { NextRequest, NextResponse } from "next/server";
import { generateDeskChatReply } from "@/lib/api/llm-analysis";
import type { DeskChatRequest } from "@/lib/types/llm";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body: DeskChatRequest = await req.json();

    if (!body.messages || body.messages.length === 0) {
      return NextResponse.json(
        { reply: null, error: "No messages provided" },
        { status: 400 }
      );
    }

    console.log(`[Desk Chat] Request: ${body.messages.length} messages`);
    const result = await generateDeskChatReply(body);

    if (!result) {
      return NextResponse.json(
        { reply: null, error: "LLM call failed", timestamp: Date.now() },
        { status: 200 }
      );
    }

    console.log(`[Desk Chat] Reply generated (${result.reply.length} chars)`);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Desk Chat] Exception:", message);
    return NextResponse.json(
      { reply: null, error: message, timestamp: Date.now() },
      { status: 200 }
    );
  }
}
