"use client";

import { GlassCard } from "@/components/common/GlassCard";
import { cn } from "@/lib/utils";
import { MAJOR_CURRENCIES } from "@/lib/utils/constants";

// Static mock data - will be replaced with real data when forex rates API is populated
const MOCK_STRENGTHS = MAJOR_CURRENCIES.map((currency, i) => ({
  currency,
  strength: 80 - i * 8 + Math.sin(i) * 10,
})).sort((a, b) => b.strength - a.strength);

export function CurrencyStrength() {
  const strengths = MOCK_STRENGTHS;

  return (
    <GlassCard delay={0.3}>
      <h3 className="text-sm font-semibold mb-3">Currency Strength</h3>

      <div className="space-y-2">
        {strengths.map((item) => {
          const color = item.strength > 65 ? "bg-bullish" : item.strength < 35 ? "bg-bearish" : "bg-neutral-accent";
          const textColor = item.strength > 65 ? "text-bullish" : item.strength < 35 ? "text-bearish" : "text-neutral-accent";

          return (
            <div key={item.currency} className="flex items-center gap-3">
              <span className="text-xs font-mono font-medium w-8 text-foreground">{item.currency}</span>
              <div className="flex-1 h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", color)}
                  style={{ width: `${item.strength}%`, opacity: 0.7 }}
                />
              </div>
              <span className={cn("text-xs font-mono w-8 text-right", textColor)}>
                {item.strength.toFixed(0)}
              </span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
