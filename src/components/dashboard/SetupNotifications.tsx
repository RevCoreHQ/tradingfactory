"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMarketStore, type PendingSetupInfo } from "@/lib/store/market-store";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { cn } from "@/lib/utils";
import { Crosshair, X, TrendingUp, TrendingDown } from "lucide-react";

function ConvictionBadge({ tier }: { tier: string }) {
  const cls =
    tier === "A+"
      ? "bg-bullish/20 text-bullish ring-1 ring-bullish/30"
      : "bg-bullish/15 text-bullish ring-1 ring-bullish/20";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center h-5 min-w-[22px] px-1 rounded text-[10px] font-black tracking-wider",
        cls
      )}
    >
      {tier}
    </span>
  );
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export function SetupNotificationsBadge() {
  const [open, setOpen] = useState(false);
  const pendingSetups = useMarketStore((s) => s.pendingSetups);
  const count = pendingSetups.length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "relative p-2 rounded-full transition-colors",
          open
            ? "bg-bullish/15 text-bullish"
            : count > 0
            ? "text-bullish hover:bg-bullish/10"
            : "text-muted-foreground hover:text-foreground hover:bg-[var(--surface-2)]"
        )}
      >
        <Crosshair className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-bullish text-white text-[10px] font-bold px-0.5 pulse-dot">
            {count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <SetupNotificationsDropdown
            setups={pendingSetups}
            onClose={() => setOpen(false)}
          />
        </>
      )}
    </div>
  );
}

function SetupNotificationsDropdown({
  setups,
  onClose,
}: {
  setups: PendingSetupInfo[];
  onClose: () => void;
}) {
  const router = useRouter();
  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument);

  const handleClick = (setup: PendingSetupInfo) => {
    const inst = INSTRUMENTS.find((i) => i.id === setup.instrumentId);
    if (inst) {
      setSelectedInstrument(inst);
    }
    router.push(`/instrument`);
    onClose();
  };

  return (
    <div className="absolute right-0 top-full mt-2 z-50 w-80 max-h-[400px] overflow-y-auto rounded-xl bg-[var(--surface-1)] border border-border shadow-xl">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--surface-1)] border-b border-border px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold">Pending Setups</span>
          {setups.length > 0 && (
            <span className="h-4 min-w-[16px] flex items-center justify-center rounded-full bg-bullish/15 text-bullish text-[10px] font-bold px-1">
              {setups.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--surface-2)] transition-colors"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>

      {/* Setup list */}
      <div className="p-2 space-y-1.5">
        {setups.length === 0 ? (
          <div className="text-center py-8">
            <Crosshair className="h-5 w-5 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-[12px] text-muted-foreground/50">
              No pending setups
            </p>
            <p className="text-[11px] text-muted-foreground/30 mt-1">
              Waiting for A+ or A conviction signals
            </p>
          </div>
        ) : (
          setups.map((setup) => {
            const isBull = setup.direction === "bullish";
            const DirIcon = isBull ? TrendingUp : TrendingDown;
            const dirLabel = isBull ? "LONG" : "SHORT";
            const dirCls = isBull ? "text-bullish" : "text-bearish";

            return (
              <button
                key={`${setup.instrumentId}:${setup.direction}`}
                onClick={() => handleClick(setup)}
                className="w-full flex gap-2.5 p-2.5 rounded-lg border border-bullish/20 bg-bullish/5 hover:bg-bullish/10 transition-colors text-left group"
              >
                {/* Conviction + Direction */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <ConvictionBadge tier={setup.conviction} />
                  <DirIcon className={cn("h-3 w-3", dirCls)} />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[13px] font-bold truncate">
                      {setup.symbol}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                        isBull
                          ? "bg-bullish/15 text-bullish"
                          : "bg-bearish/15 text-bearish"
                      )}
                    >
                      {dirLabel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[11px] text-muted-foreground/60">
                      {setup.strategy}
                    </span>
                    <span className="text-[10px] text-muted-foreground/40">
                      {timeAgo(setup.detectedAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-muted-foreground/40">
                      Entry:
                    </span>
                    <span className="text-[11px] font-mono text-foreground/70">
                      {setup.entry[0].toFixed(
                        setup.entry[0] < 10 ? 4 : 2
                      )}{" "}
                      –{" "}
                      {setup.entry[1].toFixed(
                        setup.entry[1] < 10 ? 4 : 2
                      )}
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
