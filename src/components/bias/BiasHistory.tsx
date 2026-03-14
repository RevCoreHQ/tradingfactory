"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import type { BiasHistoryEntry } from "@/lib/types/bias";
import { GlassCard } from "@/components/common/GlassCard";
import { format } from "date-fns";

const STORAGE_KEY = "trading-factory-bias-history";

export function saveBiasToHistory(instrumentId: string, bias: number, direction: string, fundScore: number, techScore: number) {
  if (typeof window === "undefined") return;
  const key = `${STORAGE_KEY}-${instrumentId}`;
  const existing: BiasHistoryEntry[] = JSON.parse(localStorage.getItem(key) || "[]");

  const today = new Date().toDateString();
  const alreadyHasToday = existing.some((e) => new Date(e.timestamp).toDateString() === today);

  if (!alreadyHasToday) {
    existing.push({
      timestamp: Date.now(),
      bias,
      direction: direction as BiasHistoryEntry["direction"],
      fundamentalScore: fundScore,
      technicalScore: techScore,
    });

    // Keep max 90 days
    const pruned = existing.slice(-90);
    localStorage.setItem(key, JSON.stringify(pruned));
  }
}

function loadBiasHistory(instrumentId: string): BiasHistoryEntry[] {
  if (typeof window === "undefined") return [];
  const key = `${STORAGE_KEY}-${instrumentId}`;
  return JSON.parse(localStorage.getItem(key) || "[]");
}

interface BiasHistoryProps {
  instrumentId: string;
}

export function BiasHistory({ instrumentId }: BiasHistoryProps) {
  const [history, setHistory] = useState<BiasHistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadBiasHistory(instrumentId));
  }, [instrumentId]);

  const chartData = history.map((h) => ({
    date: format(new Date(h.timestamp), "MMM dd"),
    bias: h.bias,
    fundamental: h.fundamentalScore,
    technical: h.technicalScore,
  }));

  if (chartData.length < 2) {
    return (
      <GlassCard delay={0.4}>
        <h3 className="text-sm font-semibold mb-2">Bias History</h3>
        <p className="text-xs text-muted-foreground">
          Bias history will appear here after tracking for multiple days.
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard delay={0.4}>
      <h3 className="text-sm font-semibold mb-3">Bias History — {instrumentId.replace("_", "/")}</h3>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="biasGreen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--bullish)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--bullish)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="biasRed" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="var(--bearish)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--bearish)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
            <YAxis domain={[-100, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: "oklch(0.12 0.005 260)", border: "1px solid oklch(0.25 0 0)", borderRadius: "8px", fontSize: "12px" }}
              labelStyle={{ color: "var(--foreground)" }}
            />
            <ReferenceLine y={0} stroke="var(--neutral-accent)" strokeOpacity={0.3} strokeDasharray="3 3" />
            <Area type="monotone" dataKey="bias" stroke="var(--neutral-accent)" strokeWidth={2} fill="url(#biasGreen)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
