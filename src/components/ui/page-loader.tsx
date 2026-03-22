"use client";

import { useState, useEffect } from "react";
import { SpecialText } from "./special-text";

export function PageLoader() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Start fading out after scramble animation completes (~1.8s)
    const fadeTimer = setTimeout(() => setFading(true), 1800);
    // Remove from DOM after fade transition (0.4s)
    const removeTimer = setTimeout(() => setVisible(false), 2200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-400"
      style={{ opacity: fading ? 0 : 1 }}
    >
      <SpecialText
        speed={20}
        className="text-2xl md:text-4xl text-foreground"
      >
        Welcome to Trading Factory
      </SpecialText>
    </div>
  );
}
