"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Radio, RefreshCw, CheckCircle2, XCircle, AlertTriangle, KeyRound } from "lucide-react";

interface ProviderStatus {
  name: string;
  status: "ok" | "error" | "no_key" | "rate_limited";
  latencyMs: number | null;
  message: string;
  provides: string;
  tier: string;
  fallback?: string;
}

interface FeedData {
  providers: ProviderStatus[];
  summary: { total: number; ok: number; error: number };
  timestamp: number;
}

const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  ok: CheckCircle2,
  error: XCircle,
  no_key: KeyRound,
  rate_limited: AlertTriangle,
};

const STATUS_COLOR: Record<string, string> = {
  ok: "text-bullish",
  error: "text-bearish",
  no_key: "text-muted-foreground/40",
  rate_limited: "text-[var(--amber)]",
};

const STATUS_LABEL: Record<string, string> = {
  ok: "Connected",
  error: "Error",
  no_key: "No API Key",
  rate_limited: "Rate Limited",
};

export function DataFeedStatus() {
  const [data, setData] = useState<FeedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/system/data-feeds");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastChecked(new Date());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount, then every 5 minutes
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const overallStatus = !data
    ? "unknown"
    : data.summary.error === 0
      ? "healthy"
      : data.summary.ok === 0
        ? "down"
        : "degraded";

  const dotColor =
    overallStatus === "healthy"
      ? "bg-bullish"
      : overallStatus === "degraded"
        ? "bg-[var(--amber)]"
        : overallStatus === "down"
          ? "bg-bearish"
          : "bg-muted-foreground/30";

  return (
    <Popover>
      <PopoverTrigger
        className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[var(--surface-1)] transition-colors"
        aria-label="Data feed status"
      >
        <Radio className="h-3.5 w-3.5 text-muted-foreground/60" />
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            dotColor,
            overallStatus === "degraded" && "animate-pulse"
          )}
        />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={8}
        className="w-80 p-0"
      >
        {/* Header */}
        <div className="px-3 py-2 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-muted-foreground/60" />
            <span className="text-xs font-semibold">Data Feeds</span>
            {data && (
              <span
                className={cn(
                  "text-[12px] font-medium px-1.5 py-0.5 rounded-full",
                  overallStatus === "healthy"
                    ? "bg-bullish/10 text-bullish"
                    : overallStatus === "degraded"
                      ? "bg-[var(--amber)]/10 text-[var(--amber)]"
                      : "bg-bearish/10 text-bearish"
                )}
              >
                {data.summary.ok}/{data.summary.total} connected
              </span>
            )}
          </div>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="p-1 rounded hover:bg-[var(--surface-1)] transition-colors"
            aria-label="Refresh status"
          >
            <RefreshCw
              className={cn(
                "h-3 w-3 text-muted-foreground/50",
                loading && "animate-spin"
              )}
            />
          </button>
        </div>

        {/* Provider list */}
        <div className="max-h-[360px] overflow-y-auto">
          {!data ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground/50">
              Checking providers...
            </div>
          ) : (
            data.providers.map((p) => {
              const Icon = STATUS_ICON[p.status] || XCircle;
              return (
                <div
                  key={p.name}
                  className="px-3 py-2 border-b border-border/20 last:border-0 hover:bg-[var(--surface-1)]/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-3.5 w-3.5 shrink-0", STATUS_COLOR[p.status])} />
                      <span className="text-xs font-medium">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.latencyMs !== null && p.status === "ok" && (
                        <span className="text-[12px] font-mono text-muted-foreground/40">
                          {p.latencyMs}ms
                        </span>
                      )}
                      <span
                        className={cn(
                          "text-[12px] font-medium",
                          STATUS_COLOR[p.status]
                        )}
                      >
                        {STATUS_LABEL[p.status]}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1 pl-5.5 space-y-0.5">
                    <p className="text-[12px] text-muted-foreground/50">{p.provides}</p>
                    <p className="text-[12px] text-muted-foreground/30">{p.tier}</p>
                    {p.status === "error" && p.message && (
                      <p className="text-[12px] text-bearish/70 font-mono truncate">
                        {p.message}
                      </p>
                    )}
                    {p.fallback && p.status !== "ok" && (
                      <p className="text-[12px] text-[var(--amber)]/60">
                        Fallback: {p.fallback}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {lastChecked && (
          <div className="px-3 py-1.5 border-t border-border/30 text-[12px] text-muted-foreground/30">
            Last checked {lastChecked.toLocaleTimeString()}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
