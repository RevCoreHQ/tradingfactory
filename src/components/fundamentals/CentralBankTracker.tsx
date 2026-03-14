"use client";

import { useCentralBanks } from "@/lib/hooks/useMarketData";
import { GlassCard } from "@/components/common/GlassCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { CardSkeleton } from "@/components/common/Skeletons";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const BANK_FLAGS: Record<string, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  JPY: "🇯🇵",
};

export function CentralBankTracker() {
  const { data, isLoading } = useCentralBanks();

  if (isLoading) return <CardSkeleton lines={6} />;

  const banks = data?.banks || [];

  return (
    <GlassCard delay={0.35}>
      <h3 className="text-sm font-semibold mb-3">Central Banks</h3>

      <div className="space-y-3">
        {banks.map((bank) => {
          const DirectionIcon = bank.rateDirection === "hiking" ? TrendingUp : bank.rateDirection === "cutting" ? TrendingDown : Minus;
          const directionColor = bank.rateDirection === "hiking" ? "text-bullish" : bank.rateDirection === "cutting" ? "text-bearish" : "text-muted-foreground";

          // Calculate days until next meeting
          const nextMeeting = new Date(bank.nextMeeting);
          const now = new Date();
          const daysUntil = Math.ceil((nextMeeting.getTime() - now.getTime()) / 86400000);

          return (
            <div key={bank.bank} className="rounded-lg bg-white/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{BANK_FLAGS[bank.currency] || "🏦"}</span>
                  <div>
                    <div className="text-xs font-medium text-foreground">{bank.bank}</div>
                    <div className="text-[10px] text-muted-foreground">{bank.currency}</div>
                  </div>
                </div>
                <StatusBadge
                  variant={bank.policyStance === "hawkish" ? "bullish" : bank.policyStance === "dovish" ? "bearish" : "neutral"}
                >
                  {bank.policyStance}
                </StatusBadge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-bold font-mono text-foreground">
                    {bank.currentRate.toFixed(2)}%
                  </span>
                  <DirectionIcon className={cn("h-4 w-4", directionColor)} />
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground">Next meeting</div>
                  <div className="text-xs font-medium">
                    {daysUntil > 0 ? `${daysUntil}d` : "Today"}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
