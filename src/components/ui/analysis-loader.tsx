"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SpecialText } from "./special-text";

interface AnalysisLoaderProps {
  messages: string[];
  speed?: number;
  holdMs?: number;
  className?: string;
}

export function AnalysisLoader({
  messages,
  speed = 20,
  holdMs = 800,
  className = "",
}: AnalysisLoaderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [key, setKey] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentMessage = messages[currentIndex % messages.length];

  // Phase1: length * 2 steps, Phase2: length * 2 steps, each step = speed ms
  const animDuration = currentMessage.length * 4 * speed;

  const advance = useCallback(() => {
    setFading(true);
    timeoutRef.current = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % messages.length);
      setKey((prev) => prev + 1);
      setFading(false);
    }, 300);
  }, [messages.length]);

  useEffect(() => {
    const totalWait = animDuration + holdMs;
    timeoutRef.current = setTimeout(advance, totalWait);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [currentIndex, key, animDuration, holdMs, advance]);

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className="transition-opacity duration-300"
        style={{ opacity: fading ? 0 : 1 }}
      >
        <SpecialText key={key} speed={speed} className="text-xs text-muted-foreground/60">
          {currentMessage}
        </SpecialText>
      </div>
    </div>
  );
}
