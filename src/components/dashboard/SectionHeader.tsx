"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  step: number;
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

export function SectionHeader({ step, title, subtitle, icon, accentColor }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center text-white", accentClasses[accentColor])}>
        {icon}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-mono text-muted-foreground/40 tabular">{String(step).padStart(2, "0")}</span>
        <h2 className="text-sm font-semibold text-foreground tracking-tight">{title}</h2>
        {subtitle && (
          <span className="text-[11px] text-muted-foreground hidden sm:inline">{subtitle}</span>
        )}
      </div>
    </div>
  );
}
