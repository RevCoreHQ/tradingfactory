"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import type { ReactNode } from "react";

const gradientStrips: Record<string, string> = {
  blue: "gradient-strip-blue",
  green: "gradient-strip-green",
  red: "gradient-strip-red",
  amber: "gradient-strip-amber",
};

const topAccents: Record<string, string> = {
  blue: "from-[var(--neutral-accent)] to-transparent",
  green: "from-[var(--bullish)] to-transparent",
  red: "from-[var(--bearish)] to-transparent",
  amber: "from-amber-500 to-transparent",
};

interface SystemSectionCardProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  accentColor: "blue" | "green" | "red" | "amber";
  children: ReactNode;
  className?: string;
}

export function SystemSectionCard({
  title,
  subtitle,
  icon,
  accentColor,
  children,
  className,
}: SystemSectionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={cn("glass-card relative overflow-hidden rounded-xl", className)}
    >
      {/* Top accent gradient line */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-px bg-gradient-to-r",
          topAccents[accentColor]
        )}
      />

      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex items-center gap-3">
        <div
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0",
            gradientStrips[accentColor]
          )}
        >
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground/60">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pb-6">{children}</div>
    </motion.div>
  );
}
