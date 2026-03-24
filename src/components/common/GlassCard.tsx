"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { GlowingEffect } from "@/components/ui/glowing-effect";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  accent?: "bullish" | "bearish" | "neutral" | null;
  animate?: boolean;
  delay?: number;
  glow?: boolean;
}

export function GlassCard({ children, className, accent, animate = true, delay = 0, glow = false }: GlassCardProps) {
  const accentClass = accent === "bullish" ? "accent-bullish" : accent === "bearish" ? "accent-bearish" : accent === "neutral" ? "accent-neutral" : "";

  const content = (
    <div
      className={cn(
        "relative panel rounded-lg p-3 sm:p-4 transition-colors duration-200",
        "hover:border-border-bright",
        accentClass,
        className
      )}
    >
      {glow && (
        <GlowingEffect
          spread={40}
          glow={true}
          disabled={false}
          proximity={64}
          inactiveZone={0.01}
          borderWidth={2}
        />
      )}
      {children}
    </div>
  );

  if (!animate) return content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {content}
    </motion.div>
  );
}
