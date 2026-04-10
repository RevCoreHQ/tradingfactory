"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    let dark: boolean;
    if (saved === "dark") dark = true;
    else if (saved === "light") dark = false;
    else if (saved === "system")
      dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    else dark = true;
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <button
      onClick={toggle}
      className={cn(
        "rounded-full border border-transparent p-2 text-muted-foreground transition-colors hover:border-[var(--glass-border)] hover:bg-white/40 hover:text-foreground dark:hover:bg-white/[0.06]"
      )}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
