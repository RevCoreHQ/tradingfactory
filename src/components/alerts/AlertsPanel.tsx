"use client";

import { useState } from "react";
import { useMarketStore } from "@/lib/store/market-store";
import { cn } from "@/lib/utils";
import { Bell, X, AlertTriangle, Info, Flame, Trash2 } from "lucide-react";
import { INSTRUMENTS } from "@/lib/utils/constants";

const severityConfig = {
  info: { icon: Info, cls: "text-neutral-accent", bg: "bg-neutral-accent/10", border: "border-neutral-accent/20" },
  warning: { icon: AlertTriangle, cls: "text-[var(--amber)]", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  danger: { icon: Flame, cls: "text-bearish", bg: "bg-bearish/10", border: "border-bearish/20" },
};

export function AlertsBell() {
  const [open, setOpen] = useState(false);
  const alerts = useMarketStore((s) => s.alerts);
  const activeCount = alerts.filter((a) => !a.dismissed && a.expiresAt > Date.now()).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "relative flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors",
          open
            ? "bg-neutral-accent/15 text-neutral-accent"
            : "text-muted-foreground hover:text-foreground hover:bg-[var(--surface-2)]"
        )}
      >
        <Bell className="h-3.5 w-3.5" />
        {activeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-[14px] flex items-center justify-center rounded-full bg-bearish text-white text-[8px] font-bold px-0.5">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <AlertsDropdown onClose={() => setOpen(false)} />
        </>
      )}
    </div>
  );
}

function AlertsDropdown({ onClose }: { onClose: () => void }) {
  const alerts = useMarketStore((s) => s.alerts);
  const dismissAlert = useMarketStore((s) => s.dismissAlert);
  const clearAlerts = useMarketStore((s) => s.clearAlerts);

  const now = Date.now();
  const active = alerts
    .filter((a) => !a.dismissed && a.expiresAt > now)
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="absolute right-0 top-full mt-2 z-50 w-80 max-h-96 overflow-y-auto rounded-xl bg-[var(--surface-1)] border border-border shadow-xl">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--surface-1)] border-b border-border px-3 py-2 flex items-center justify-between">
        <span className="text-xs font-bold">Alerts</span>
        <div className="flex items-center gap-1">
          {active.length > 0 && (
            <button
              onClick={clearAlerts}
              className="p-1 rounded hover:bg-[var(--surface-2)] transition-colors"
              title="Clear all"
            >
              <Trash2 className="h-3 w-3 text-muted-foreground/40" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--surface-2)] transition-colors"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Alert list */}
      <div className="p-2 space-y-1.5">
        {active.length === 0 ? (
          <div className="text-center py-8">
            <Bell className="h-5 w-5 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-[10px] text-muted-foreground/50">No active alerts</p>
          </div>
        ) : (
          active.map((alert) => {
            const cfg = severityConfig[alert.severity];
            const Icon = cfg.icon;
            const inst = INSTRUMENTS.find((i) => i.id === alert.instrumentId);
            const age = Math.round((now - alert.createdAt) / 60000);
            const ageLabel = age < 1 ? "just now" : age < 60 ? `${age}m ago` : `${Math.round(age / 60)}h ago`;

            return (
              <div
                key={alert.id}
                className={cn(
                  "flex gap-2 p-2 rounded-lg border",
                  cfg.bg,
                  cfg.border
                )}
              >
                <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", cfg.cls)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold truncate">{alert.title}</span>
                    <button
                      onClick={() => dismissAlert(alert.id)}
                      className="p-0.5 rounded hover:bg-[var(--surface-2)] shrink-0"
                    >
                      <X className="h-2.5 w-2.5 text-muted-foreground/40" />
                    </button>
                  </div>
                  <p className="text-[9px] text-muted-foreground/60 leading-relaxed">{alert.message}</p>
                  <span className="text-[8px] text-muted-foreground/40">{ageLabel}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
