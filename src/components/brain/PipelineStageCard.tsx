"use client";

import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";

type BadgeType = "mechanical" | "ai" | "filter" | "data";

const badgeConfig: Record<BadgeType, { label: string; className: string }> = {
  mechanical: { label: "MECHANICAL", className: "bg-bullish/12 text-bullish border-bullish/20" },
  ai: { label: "AI", className: "bg-amber-500/12 text-amber-500 border-amber-500/20" },
  filter: { label: "FILTER", className: "bg-bearish/12 text-bearish border-bearish/20" },
  data: { label: "DATA", className: "bg-neutral-accent/12 text-neutral-accent border-neutral-accent/20" },
};

const accentBorders: Record<string, string> = {
  blue: "border-l-[var(--neutral-accent)]",
  green: "border-l-[var(--bullish)]",
  amber: "border-l-amber-500",
  red: "border-l-[var(--bearish)]",
};

interface PipelineStageCardProps {
  number: number;
  title: string;
  subtitle: string;
  icon: ReactNode;
  badge: BadgeType;
  accentColor: "blue" | "green" | "amber" | "red";
  children: ReactNode;
  defaultExpanded?: boolean;
}

export function PipelineStageCard({
  number,
  title,
  subtitle,
  icon,
  badge,
  accentColor,
  children,
  defaultExpanded = false,
}: PipelineStageCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const config = badgeConfig[badge];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, delay: number * 0.05 }}
      className={cn("panel rounded-lg border-l-[3px] overflow-hidden", accentBorders[accentColor])}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface-2/50 transition-colors text-left"
      >
        <span className="text-[10px] font-mono text-muted-foreground/50 w-5 shrink-0 text-center">
          {number}
        </span>
        <span className="text-muted-foreground/60 shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-foreground">{title}</span>
          <span className="text-[10px] text-muted-foreground/60 ml-2 hidden sm:inline">{subtitle}</span>
        </div>
        <span className={cn("text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0", config.className)}>
          {config.label}
        </span>
        {expanded ? (
          <ChevronUp className="h-3 w-3 text-muted-foreground/40 shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground/40 shrink-0" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-border/30 text-xs text-muted-foreground leading-relaxed space-y-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
