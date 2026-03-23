"use client";

import { cn } from "@/lib/utils";
import type { MonthlyReturn } from "@/lib/types/backtest";

interface Props {
  monthlyReturns: MonthlyReturn[];
}

export function MonthlyReturnsGrid({ monthlyReturns }: Props) {
  if (monthlyReturns.length === 0) {
    return (
      <div className="section-card p-6 text-center text-xs text-muted-foreground/40">
        No monthly data
      </div>
    );
  }

  const maxReturn = Math.max(...monthlyReturns.map((m) => Math.abs(m.returnPercent)), 1);

  return (
    <div className="section-card p-4">
      <div className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-3">
        Monthly Returns
      </div>
      <div className="space-y-1.5">
        {monthlyReturns.map((m) => {
          const intensity = Math.min(1, Math.abs(m.returnPercent) / maxReturn);
          const isPositive = m.returnPercent >= 0;

          return (
            <div key={m.month} className="flex items-center gap-2">
              <span className="text-[12px] font-mono text-muted-foreground/60 w-14 shrink-0">
                {m.month}
              </span>
              <div className="flex-1 h-5 rounded-sm overflow-hidden bg-[var(--surface-2)]/30 relative">
                <div
                  className={cn(
                    "h-full rounded-sm transition-all",
                    isPositive ? "bg-bullish/40" : "bg-bearish/40"
                  )}
                  style={{ width: `${intensity * 100}%` }}
                />
                <span className={cn(
                  "absolute inset-0 flex items-center px-2 text-[11px] font-mono font-bold",
                  isPositive ? "text-bullish" : "text-bearish"
                )}>
                  {isPositive ? "+" : ""}{m.returnPercent.toFixed(1)}%
                </span>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground/40 w-8 text-right shrink-0">
                {m.trades}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/20">
        <span className="text-[10px] text-muted-foreground/40 uppercase">Total</span>
        <span className={cn(
          "text-xs font-bold font-mono",
          monthlyReturns.reduce((s, m) => s + m.returnPercent, 0) >= 0 ? "text-bullish" : "text-bearish"
        )}>
          {monthlyReturns.reduce((s, m) => s + m.returnPercent, 0) >= 0 ? "+" : ""}
          {monthlyReturns.reduce((s, m) => s + m.returnPercent, 0).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
