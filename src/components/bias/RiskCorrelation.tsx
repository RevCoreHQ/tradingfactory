"use client";

import { useRiskCorrelation } from "@/lib/hooks/useRiskCorrelation";
import { GlassCard } from "@/components/common/GlassCard";
import { Shield, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { INSTRUMENTS } from "@/lib/utils/constants";

export function RiskCorrelation() {
  const { assessment } = useRiskCorrelation();

  if (!assessment) {
    return (
      <GlassCard delay={0.1}>
        <h3 className="text-sm font-semibold mb-2">Portfolio Risk</h3>
        <p className="text-xs text-muted-foreground">
          Risk analysis will appear once bias data loads.
        </p>
      </GlassCard>
    );
  }

  const { exposures, warnings, diversificationScore, concentrationRisk } = assessment;

  const riskColor = concentrationRisk === "high"
    ? "text-bearish"
    : concentrationRisk === "medium"
    ? "text-[var(--amber)]"
    : "text-bullish";

  const riskBg = concentrationRisk === "high"
    ? "bg-bearish/15"
    : concentrationRisk === "medium"
    ? "bg-[var(--amber)]/15"
    : "bg-bullish/15";

  // Only show major currencies (filter out indices/crypto from bar chart)
  const majorCurrencies = ["USD", "EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF", "XAU", "BTC", "ETH"];
  const displayExposures = exposures.filter((e) => majorCurrencies.includes(e.currency));
  const maxExposure = Math.max(...displayExposures.map((e) => Math.abs(e.netExposure)), 1);

  return (
    <GlassCard delay={0.1}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-muted-foreground/60" />
          <h3 className="text-sm font-semibold">Portfolio Risk</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("px-2 py-0.5 rounded text-[12px] font-bold", riskBg, riskColor)}>
            {concentrationRisk.toUpperCase()}
          </div>
          <div className="text-right">
            <span className="text-[11px] text-muted-foreground/50 block">Diversity</span>
            <span className={cn("text-sm font-bold tabular", riskColor)}>
              {diversificationScore}
            </span>
          </div>
        </div>
      </div>

      {/* Currency Exposure Bars */}
      <div className="space-y-1.5 mb-4">
        <h4 className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-wider">
          Net Currency Exposure
        </h4>
        {displayExposures.length === 0 ? (
          <p className="text-[12px] text-muted-foreground/50">No significant exposure detected</p>
        ) : (
          displayExposures.slice(0, 8).map((exp) => {
            const isLong = exp.netExposure > 0;
            const barWidth = (Math.abs(exp.netExposure) / maxExposure) * 100;
            return (
              <div key={exp.currency} className="flex items-center gap-2">
                <span className="text-[12px] font-mono font-bold w-8 text-muted-foreground">
                  {exp.currency}
                </span>
                <div className="flex-1 flex items-center">
                  {/* Center-anchored bar */}
                  <div className="w-full h-4 relative bg-[var(--surface-2)] rounded overflow-hidden">
                    <div
                      className={cn(
                        "absolute top-0 h-full rounded transition-all duration-300",
                        isLong ? "bg-bullish/40" : "bg-bearish/40"
                      )}
                      style={{
                        left: isLong ? "50%" : `${50 - barWidth / 2}%`,
                        width: `${barWidth / 2}%`,
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-px h-full bg-border/50" />
                    </div>
                  </div>
                </div>
                <span className={cn(
                  "text-[12px] font-mono font-bold w-10 text-right tabular",
                  isLong ? "text-bullish" : "text-bearish"
                )}>
                  {isLong ? "+" : ""}{exp.netExposure.toFixed(1)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Correlation Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-wider">
            Warnings
          </h4>
          {warnings.map((warning, i) => {
            const Icon = warning.severity === "danger"
              ? AlertTriangle
              : warning.severity === "warning"
              ? AlertTriangle
              : Info;
            const color = warning.severity === "danger"
              ? "text-bearish"
              : warning.severity === "warning"
              ? "text-[var(--amber)]"
              : "text-neutral-accent";
            const bg = warning.severity === "danger"
              ? "bg-bearish/10"
              : warning.severity === "warning"
              ? "bg-[var(--amber)]/10"
              : "bg-neutral-accent/10";

            return (
              <div key={i} className={cn("flex items-start gap-2 px-2 py-1.5 rounded-lg", bg)}>
                <Icon className={cn("h-3 w-3 mt-0.5 shrink-0", color)} />
                <div>
                  <p className={cn("text-[12px] font-medium", color)}>{warning.message}</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                    {warning.instruments.map((id) => {
                      const inst = INSTRUMENTS.find((i) => i.id === id);
                      return inst?.symbol || id;
                    }).join(", ")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
