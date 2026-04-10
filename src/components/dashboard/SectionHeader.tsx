"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  accentColor: "blue" | "green" | "red" | "amber";
  /** Show subtitle below title on narrow screens instead of hiding it */
  subtitleOnMobile?: boolean;
}

const accentClasses = {
  blue: "gradient-strip-blue",
  green: "gradient-strip-green",
  red: "gradient-strip-red",
  amber: "gradient-strip-amber",
};

const glowClasses = {
  blue: "shadow-[0_0_16px_oklch(0.55_0.18_285/0.35)]",
  green: "shadow-[0_0_14px_oklch(0.55_0.16_155/0.35)]",
  red: "shadow-[0_0_12px_oklch(0.55_0.18_25/0.35)]",
  amber: "shadow-[0_0_12px_oklch(0.65_0.14_85/0.35)]",
};

export function SectionHeader({
  title,
  subtitle,
  icon,
  accentColor,
  subtitleOnMobile = false,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex gap-3 mb-4",
        subtitleOnMobile ? "items-start sm:items-center" : "items-center"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/20 text-white shadow-inner backdrop-blur-sm dark:border-white/10",
          accentClasses[accentColor],
          glowClasses[accentColor]
        )}
      >
        {icon}
      </div>
      <div
        className={cn(
          "min-w-0 shrink",
          subtitleOnMobile
            ? "flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2"
            : "flex items-baseline gap-2"
        )}
      >
        <h2 className="text-sm font-semibold tracking-tight text-foreground dark:text-gradient-teal">
          {title}
        </h2>
        {subtitle && (
          <span
            className={cn(
              "text-[12px] sm:text-[13px] text-muted-foreground leading-snug",
              subtitleOnMobile ? "" : "hidden sm:inline"
            )}
          >
            {subtitle}
          </span>
        )}
      </div>
      <div className="mt-2 h-px flex-1 self-center bg-gradient-to-r from-border/50 to-transparent sm:mt-0" />
    </div>
  );
}
