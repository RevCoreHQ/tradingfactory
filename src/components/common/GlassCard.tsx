"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: "bullish" | "bearish" | "neutral" | null;
  animate?: boolean;
  delay?: number;
}

export function GlassCard({ children, className, glow, animate = true, delay = 0 }: GlassCardProps) {
  const glowClass = glow === "bullish" ? "glow-bullish" : glow === "bearish" ? "glow-bearish" : glow === "neutral" ? "glow-neutral" : "";

  const content = (
    <div
      className={cn(
        "glass-card rounded-xl p-4 transition-all duration-300",
        "hover:border-white/10",
        glowClass,
        className
      )}
    >
      {children}
    </div>
  );

  if (!animate) return content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {content}
    </motion.div>
  );
}
