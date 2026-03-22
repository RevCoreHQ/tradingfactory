"use client";

import { useState, useEffect } from "react";
import { SpecialText } from "./special-text";

export function PageLoader() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Start fading out after scramble animation fully completes
    const fadeTimer = setTimeout(() => setFading(true), 3000);
    // Remove from DOM after fade transition (0.6s)
    const removeTimer = setTimeout(() => setVisible(false), 3600);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-500"
      style={{ opacity: fading ? 0 : 1 }}
    >
      <SpecialText
        speed={25}
        className="text-sm md:text-lg text-foreground"
      >
        Welcome to Trading Factory
      </SpecialText>
    </div>
  );
}
