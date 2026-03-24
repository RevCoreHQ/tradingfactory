"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  accentColor: "blue" | "green" | "red" | "amber";
}

const accentClasses = {
  blue: "gradient-strip-blue",
  green: "gradient-strip-green",
  red: "gradient-strip-red",
  amber: "gradient-strip-amber",
};

const glowClasses = {
  blue: "shadow-[0_0_12px_oklch(0.50_0.15_162/0.3)]",
  green: "shadow-[0_0_12px_oklch(0.55_0.15_145/0.3)]",
  red: "shadow-[0_0_12px_oklch(0.55_0.18_25/0.3)]",
  amber: "shadow-[0_0_12px_oklch(0.65_0.14_85/0.3)]",
};

export function SectionHeader({ title, subtitle, icon, accentColor }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-white", accentClasses[accentColor], glowClasses[accentColor])}>
        {icon}
      </div>
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground dark:text-gradient-teal">{title}</h2>
        {subtitle && (
          <span className="text-[13px] text-muted-foreground hidden sm:inline">{subtitle}</span>
        )}
      </div>
      <div className="flex-1 h-px bg-gradient-to-r from-border/50 to-transparent ml-2" />
    </div>
  );
}
