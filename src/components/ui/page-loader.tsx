"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SpecialText } from "./special-text";
import { useMarketStore } from "@/lib/store/market-store";

const BOOT_MESSAGES = [
  "Connecting data feeds...",
  "Loading market rates...",
  "Scanning news & sentiment...",
  "Calculating bias scores...",
  "Running AI analysis...",
  "Evaluating macro conditions...",
  "Analyzing instrument confluence...",
  "Generating market summary...",
  "Assessing sector outlooks...",
  "Finalizing AI intelligence...",
  "Preparing your desk...",
];

const BOOT_SPEED = 15; // ms per animation step (fast)
const BOOT_HOLD = 400; // ms hold between messages
const WELCOME_SPEED = 25; // ms per animation step (dramatic)
const MIN_BOOT_MS = 5000; // minimum time in boot phase
const MAX_BOOT_MS = 30000; // max time before forcing welcome (market summary LLM can take 20s+)
const FADE_MS = 600;

type Phase = "booting" | "welcome" | "fading" | "done";

export function PageLoader() {
  const [phase, setPhase] = useState<Phase>("booting");
  const [msgIndex, setMsgIndex] = useState(0);
  const [msgKey, setMsgKey] = useState(0);
  const [msgFading, setMsgFading] = useState(false);
  const bootStart = useRef(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const bootStatus = useMarketStore((s) => s.bootStatus);
  const readyCount = Object.values(bootStatus).filter(Boolean).length;
  // Require both LLM calls (batch bias + market summary) plus basic feeds
  const dataReady = readyCount >= 5 && !!bootStatus.llmBatch && !!bootStatus.marketSummary;

  // Calculate animation duration for current boot message
  const currentMsg = BOOT_MESSAGES[msgIndex % BOOT_MESSAGES.length];
  const animDuration = currentMsg.length * 4 * BOOT_SPEED;

  // Advance to next boot message
  const advanceMessage = useCallback(() => {
    setMsgFading(true);
    timeoutRef.current = setTimeout(() => {
      setMsgIndex((prev) => (prev + 1) % BOOT_MESSAGES.length);
      setMsgKey((prev) => prev + 1);
      setMsgFading(false);
    }, 250);
  }, []);

  // Boot message cycling
  useEffect(() => {
    if (phase !== "booting") return;

    const totalWait = animDuration + BOOT_HOLD;
    timeoutRef.current = setTimeout(advanceMessage, totalWait);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [phase, msgIndex, msgKey, animDuration, advanceMessage]);

  // Check if boot phase should end → transition to welcome
  useEffect(() => {
    if (phase !== "booting") return;

    const elapsed = Date.now() - bootStart.current;
    const pastMinimum = elapsed >= MIN_BOOT_MS;
    const pastMaximum = elapsed >= MAX_BOOT_MS;

    if ((pastMinimum && dataReady) || pastMaximum) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setPhase("welcome");
      return;
    }

    // Re-check periodically
    const checkTimer = setTimeout(() => {
      // Force re-render to re-evaluate conditions
      setMsgKey((k) => k);
    }, 500);

    return () => clearTimeout(checkTimer);
  }, [phase, dataReady, msgIndex, msgKey]);

  // Welcome phase → fade after animation completes
  useEffect(() => {
    if (phase !== "welcome") return;
    const welcomeDuration = "Welcome to Trading Factory".length * 4 * WELCOME_SPEED;
    const timer = setTimeout(() => setPhase("fading"), welcomeDuration + 400);
    return () => clearTimeout(timer);
  }, [phase]);

  // Fading → remove from DOM
  useEffect(() => {
    if (phase !== "fading") return;
    const timer = setTimeout(() => setPhase("done"), FADE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-500"
      style={{ opacity: phase === "fading" ? 0 : 1 }}
    >
      {phase === "booting" && (
        <div
          className="transition-opacity duration-200"
          style={{ opacity: msgFading ? 0 : 1 }}
        >
          <SpecialText
            key={msgKey}
            speed={BOOT_SPEED}
            className="text-xs text-muted-foreground/60"
          >
            {currentMsg}
          </SpecialText>
        </div>
      )}

      {phase === "welcome" && (
        <SpecialText
          speed={WELCOME_SPEED}
          className="text-sm md:text-lg text-foreground"
        >
          Welcome to Trading Factory
        </SpecialText>
      )}
    </div>
  );
}
