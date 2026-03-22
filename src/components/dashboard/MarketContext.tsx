"use client";

import { useMarketStore } from "@/lib/store/market-store";
import { useBondYields } from "@/lib/hooks/useMarketData";
import { TRADING_SESSIONS } from "@/lib/utils/constants";
import { isSessionActive } from "@/lib/calculations/session-scoring";
import { getChangeClass, getSignPrefix } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";

export function MarketContext() {
  const allBiasResults = useMarketStore((s) => s.allBiasResults);
  const biasTimeframe = "intraday" as const;
  const { data: bondData } = useBondYields();

  const dxy = bondData?.dxy || { value: 0, change: 0, changePercent: 0 };
  const currentResults = allBiasResults[biasTimeframe];

  const hourUTC = new Date().getUTCHours();
  const activeSessions = Object.values(TRADING_SESSIONS).filter((s) =>
    isSessionActive(s, hourUTC)
  );

  const strongConviction = Object.values(currentResults).filter(
    (r) => Math.abs(r.overallBias) >= 45
  ).length;

  const totalInstruments = Object.keys(currentResults).length;

  const rows = [
    {
      label: "DXY Index",
      value: dxy.value > 0 ? dxy.value.toFixed(2) : "—",
      extra: dxy.change !== 0
        ? `${getSignPrefix(dxy.change)}${dxy.change.toFixed(2)}`
        : null,
      extraClass: dxy.change !== 0 ? getChangeClass(dxy.change) : "",
    },
    {
      label: "Active Sessions",
      value: activeSessions.length > 0
        ? activeSessions.map((s) => s.name).join(", ")
        : "Markets Closed",
      extra: null,
      extraClass: "",
    },
    {
      label: "Strong Conviction",
      value: `${strongConviction} / ${totalInstruments}`,
      extra: strongConviction > 0 ? "instruments" : null,
      extraClass: "text-muted-foreground",
    },
  ];

  return (
    <div className="panel rounded-lg p-4 h-full">
      <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
        Market Context
      </h3>

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{row.label}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono font-medium text-foreground">{row.value}</span>
              {row.extra && (
                <span className={cn("text-[10px] font-mono", row.extraClass)}>{row.extra}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
