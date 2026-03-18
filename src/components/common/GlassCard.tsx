"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  accent?: "bullish" | "bearish" | "neutral" | null;
  animate?: boolean;
  delay?: number;
}

export function GlassCard({ children, className, accent, animate = true, delay = 0 }: GlassCardProps) {
  const accentClass = accent === "bullish" ? "accent-bullish" : accent === "bearish" ? "accent-bearish" : accent === "neutral" ? "accent-neutral" : "";

  const content = (
    <div
      className={cn(
        "panel rounded-lg p-4 transition-colors duration-200",
        "hover:border-border-bright",
        accentClass,
        className
      )}
    >
      {children}
    </div>
  );

  if (!animate) return content;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay }}
    >
      {content}
    </motion.div>
  );
}
