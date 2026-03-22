"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { SystemBreakdown, RegimeBreakdown, ConvictionBreakdown, BacktestTrade } from "@/lib/types/backtest";

type TabId = "system" | "regime" | "conviction" | "ict";

interface Props {
  systemBreakdown: SystemBreakdown[];
  regimeBreakdown: RegimeBreakdown[];
  convictionBreakdown: ConvictionBreakdown[];
  trades: BacktestTrade[];
}

function TableHeader({ columns }: { columns: string[] }) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border/20">
      {columns.map((col, i) => (
        <span
          key={col}
          className={cn(
            "text-[8px] font-bold text-muted-foreground/50 uppercase tracking-wider",
            i === 0 ? "flex-1" : "w-16 text-right"
          )}
        >
          {col}
        </span>
      ))}
    </div>
  );
}

function TableRow({ cells, isPositive }: { cells: (string | number)[]; isPositive: boolean }) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border/10 hover:bg-[var(--surface-1)]/50 transition-colors">
      {cells.map((cell, i) => (
        <span
          key={i}
          className={cn(
            "text-xs font-mono",
            i === 0
              ? "flex-1 font-sans font-medium text-foreground"
              : "w-16 text-right",
            i > 0 && isPositive ? "text-bullish/80" : i > 0 ? "text-bearish/80" : ""
          )}
        >
          {cell}
        </span>
      ))}
    </div>
  );
}

export function BreakdownTabs({ systemBreakdown, regimeBreakdown, convictionBreakdown, trades }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("system");

  const tabs: { id: TabId; label: string }[] = [
    { id: "system", label: "By System" },
    { id: "regime", label: "By Regime" },
    { id: "conviction", label: "By Conviction" },
    { id: "ict", label: "By ICT" },
  ];

  // ICT breakdown: split trades by ICT score
  const ictBreakdown = (() => {
    const highICT = trades.filter((t) => t.ictScore >= 50 && t.outcome !== "still_open");
    const lowICT = trades.filter((t) => t.ictScore < 50 && t.ictScore > 0 && t.outcome !== "still_open");
    const noICT = trades.filter((t) => t.ictScore === 0 && t.outcome !== "still_open");

    return [
      { label: "High ICT (≥50)", trades: highICT },
      { label: "Low ICT (1-49)", trades: lowICT },
      { label: "No ICT (0)", trades: noICT },
    ].map(({ label, trades: t }) => {
      const wins = t.filter((tr) => tr.outcome === "win");
      const losses = t.filter((tr) => tr.outcome === "loss");
      const decisive = wins.length + losses.length;
      const wr = decisive > 0 ? wins.length / decisive : 0;
      const avgWinR = wins.length > 0 ? wins.reduce((s, tr) => s + tr.rMultiple, 0) / wins.length : 0;
      const avgLossR = losses.length > 0 ? Math.abs(losses.reduce((s, tr) => s + tr.rMultiple, 0) / losses.length) : 0;
      const grossProfit = wins.reduce((s, tr) => s + tr.pnlPercent, 0);
      const grossLoss = Math.abs(losses.reduce((s, tr) => s + tr.pnlPercent, 0));
      return {
        label,
        trades: t.length,
        winRate: wr,
        expectancy: decisive > 0 ? (wr * avgWinR) - ((1 - wr) * avgLossR) : 0,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      };
    });
  })();

  const fmtPct = (v: number) => `${(v * 100).toFixed(0)}%`;
  const fmtR = (v: number) => v.toFixed(2);
  const fmtPF = (v: number) => v === Infinity ? "∞" : v.toFixed(2);

  return (
    <div className="section-card">
      {/* Tab bar */}
      <div className="flex items-center gap-1 p-2 border-b border-border/20">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all",
              activeTab === tab.id
                ? "bg-neutral-accent/15 text-neutral-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-[var(--surface-2)]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeTab === "system" && (
          <>
            <TableHeader columns={["System", "Trades", "Win Rate", "Expect.", "PF"]} />
            {systemBreakdown.map((s) => (
              <TableRow
                key={s.system}
                cells={[s.system, s.trades, fmtPct(s.winRate), fmtR(s.expectancy), fmtPF(s.profitFactor)]}
                isPositive={s.expectancy > 0}
              />
            ))}
            {systemBreakdown.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground/40">No data</div>
            )}
          </>
        )}

        {activeTab === "regime" && (
          <>
            <TableHeader columns={["Regime", "Trades", "Win Rate", "Expect.", "PF"]} />
            {regimeBreakdown.map((r) => (
              <TableRow
                key={r.regime}
                cells={[r.regime, r.trades, fmtPct(r.winRate), fmtR(r.expectancy), fmtPF(r.profitFactor)]}
                isPositive={r.expectancy > 0}
              />
            ))}
            {regimeBreakdown.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground/40">No data</div>
            )}
          </>
        )}

        {activeTab === "conviction" && (
          <>
            <TableHeader columns={["Tier", "Trades", "Win Rate", "Expect.", "PF"]} />
            {convictionBreakdown.map((c) => (
              <TableRow
                key={c.tier}
                cells={[c.tier, c.trades, fmtPct(c.winRate), fmtR(c.expectancy), fmtPF(c.profitFactor)]}
                isPositive={c.expectancy > 0}
              />
            ))}
            {convictionBreakdown.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground/40">No data</div>
            )}
          </>
        )}

        {activeTab === "ict" && (
          <>
            <TableHeader columns={["ICT Level", "Trades", "Win Rate", "Expect.", "PF"]} />
            {ictBreakdown.map((b) => (
              <TableRow
                key={b.label}
                cells={[b.label, b.trades, fmtPct(b.winRate), fmtR(b.expectancy), fmtPF(b.profitFactor)]}
                isPositive={b.expectancy > 0}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
