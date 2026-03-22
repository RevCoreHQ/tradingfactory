"use client";

import { useState, useCallback, useRef } from "react";
import type { DeskChatMessage, TradingAdvisorRequest, TradingAdvisorResult } from "@/lib/types/llm";

const MAX_MESSAGES = 20;

interface UseDeskChatParams {
  advisorContext: TradingAdvisorRequest | null;
  initialBriefing: TradingAdvisorResult | null;
}

function formatBriefingAsMessage(advisor: TradingAdvisorResult): string {
  const parts: string[] = [];
  if (advisor.greeting) parts.push(advisor.greeting);
  if (advisor.marketRegime) parts.push(`Market Regime: ${advisor.marketRegime}`);
  if (advisor.topPick) {
    parts.push(
      `Top Pick: ${advisor.topPick.action} ${advisor.topPick.instrument} (${advisor.topPick.conviction}) — ${advisor.topPick.reasoning}`
    );
  }
  if (advisor.riskWarning) parts.push(`Risk: ${advisor.riskWarning}`);
  if (advisor.deskNote) parts.push(`"${advisor.deskNote}"`);
  return parts.join("\n\n");
}

export function useDeskChat({ advisorContext, initialBriefing }: UseDeskChatParams) {
  const [messages, setMessages] = useState<DeskChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (content: string) => {
      if (!content.trim() || !advisorContext || isSending) return;

      const userMessage: DeskChatMessage = {
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage].slice(-MAX_MESSAGES));
      setIsSending(true);
      setError(null);

      // Build message history for API — include briefing as first assistant turn
      const apiMessages: DeskChatMessage[] = [];
      if (initialBriefing) {
        apiMessages.push({
          role: "assistant",
          content: formatBriefingAsMessage(initialBriefing),
          timestamp: initialBriefing.timestamp,
        });
      }
      apiMessages.push(...messages, userMessage);

      try {
        abortRef.current = new AbortController();
        const res = await fetch("/api/analysis/desk-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages.slice(-MAX_MESSAGES),
            context: advisorContext,
          }),
          signal: abortRef.current.signal,
        });

        const data = await res.json();
        if (data.reply) {
          const assistantMessage: DeskChatMessage = {
            role: "assistant",
            content: data.reply,
            timestamp: data.timestamp ?? Date.now(),
          };
          setMessages((prev) => [...prev, assistantMessage].slice(-MAX_MESSAGES));
        } else {
          setError(data.error ?? "No response from desk manager");
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Failed to send message");
      } finally {
        setIsSending(false);
        abortRef.current = null;
      }
    },
    [advisorContext, initialBriefing, messages, isSending]
  );

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isSending, error, send, clear };
}
