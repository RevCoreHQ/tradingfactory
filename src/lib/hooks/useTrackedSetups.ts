"use client";

import { useRef, useCallback, useMemo, useState, useEffect } from "react";
import type { TradeDeskSetup, TrackedSetup, ConfluencePattern } from "@/lib/types/signals";
import {
  createTrackedSetup,
  updateSetupStatus,
  buildConfluenceKey,
  isSetupActive,
} from "@/lib/calculations/setup-tracker";
import { recordOutcome } from "@/lib/calculations/confluence-learning";
import {
  loadTrackedSetups,
  saveTrackedSetups,
  loadConfluencePatterns,
  saveConfluencePatterns,
  clearAllTrackingData,
} from "@/lib/storage/setup-storage";

interface UseTrackedSetupsResult {
  activeSetups: TrackedSetup[];
  historySetups: TrackedSetup[];
  confluencePatterns: Record<string, ConfluencePattern>;
  clearHistory: () => void;
}

export function useTrackedSetups(
  freshSetups: TradeDeskSetup[]
): UseTrackedSetupsResult {
  const patternsRef = useRef<Record<string, ConfluencePattern>>({});
  const trackedRef = useRef<TrackedSetup[]>([]);
  const initializedRef = useRef(false);

  // Load from localStorage once on mount (ref-based, no SWR)
  if (!initializedRef.current && typeof window !== "undefined") {
    trackedRef.current = loadTrackedSetups();
    patternsRef.current = loadConfluencePatterns();
    initializedRef.current = true;
  }

  // Force re-render trigger (only used by clearHistory)
  const [, setTick] = useState(0);

  // Pure computation against ref state — no SWR, no mutate
  const { activeSetups, historySetups } = useMemo(() => {
    const currentTracked = trackedRef.current;
    const patterns = { ...patternsRef.current };
    let changed = false;

    const activeMap = new Map<string, TrackedSetup>();
    const terminalList: TrackedSetup[] = [];

    for (const t of currentTracked) {
      if (isSetupActive(t.status)) {
        activeMap.set(t.setup.instrumentId, t);
      } else {
        terminalList.push(t);
      }
    }

    const updatedActive: TrackedSetup[] = [];

    for (const fresh of freshSetups) {
      const existing = activeMap.get(fresh.instrumentId);

      if (existing) {
        const isStillActionable =
          existing.status === "pending" || existing.status === "active";

        // If conviction dropped below A on an actionable setup, invalidate — no longer tradeable
        const isBelowA = fresh.conviction === "B" || fresh.conviction === "C" || fresh.conviction === "D";
        if (isStillActionable && isBelowA) {
          changed = true;
          const invalidated: TrackedSetup = {
            ...existing,
            status: "invalidated",
            closedAt: Date.now(),
            outcome: "breakeven",
            pnlPercent: 0,
          };
          terminalList.push(invalidated);
          activeMap.delete(fresh.instrumentId);
          continue;
        }

        // If impulse conflicts on an actionable setup, invalidate — hard gate violated
        const impulseConflict =
          (fresh.direction === "bullish" && fresh.impulse === "red") ||
          (fresh.direction === "bearish" && fresh.impulse === "green");
        if (isStillActionable && impulseConflict) {
          changed = true;
          const invalidated: TrackedSetup = {
            ...existing,
            status: "invalidated",
            closedAt: Date.now(),
            outcome: "breakeven",
            pnlPercent: 0,
          };
          terminalList.push(invalidated);
          activeMap.delete(fresh.instrumentId);
          continue;
        }

        // If direction flipped on an actionable setup, invalidate — thesis changed
        if (isStillActionable && fresh.direction !== existing.setup.direction) {
          changed = true;
          const invalidated: TrackedSetup = {
            ...existing,
            status: "invalidated",
            closedAt: Date.now(),
            outcome: "breakeven",
            pnlPercent: 0,
          };
          terminalList.push(invalidated);
          activeMap.delete(fresh.instrumentId);
          // Let the "no existing" branch below create a new tracked setup
          const confKey = buildConfluenceKey(fresh);
          const newTracked = createTrackedSetup(fresh);
          const checked = updateSetupStatus(newTracked, fresh.currentPrice);
          updatedActive.push(checked);
          continue;
        }

        const updated = updateSetupStatus(existing, fresh.currentPrice);

        // For actionable setups, sync signal data so cards match advisor
        if (isStillActionable) {
          updated.setup = {
            ...updated.setup,
            currentPrice: fresh.currentPrice,
            conviction: fresh.conviction,
            convictionScore: fresh.convictionScore,
            impulse: fresh.impulse,
            regime: fresh.regime,
            regimeLabel: fresh.regimeLabel,
            adx: fresh.adx,
            tradingStyle: fresh.tradingStyle,
            timeframe: fresh.timeframe,
            signals: fresh.signals,
            consensus: fresh.consensus,
            entry: fresh.entry,
            stopLoss: fresh.stopLoss,
            takeProfit: fresh.takeProfit,
            riskReward: fresh.riskReward,
            positionSizeLots: fresh.positionSizeLots,
            riskAmount: fresh.riskAmount,
            reasonsToExit: fresh.reasonsToExit,
            learningApplied: fresh.learningApplied,
          };
          updated.confluenceKey = buildConfluenceKey(fresh);
          changed = true;
        } else if (updated.setup.currentPrice !== fresh.currentPrice) {
          // Running setups: only sync price
          updated.setup = { ...updated.setup, currentPrice: fresh.currentPrice };
        }

        if (updated.status !== existing.status) {
          changed = true;
          if (!isSetupActive(updated.status)) {
            const key = updated.confluenceKey;
            patterns[key] = recordOutcome(patterns[key] ?? null, updated);
            terminalList.push(updated);
            continue;
          }
        }

        updatedActive.push(updated);
        activeMap.delete(fresh.instrumentId);
      } else {
        const confKey = buildConfluenceKey(fresh);
        const recentTerminal = terminalList.find(
          (t) =>
            t.setup.instrumentId === fresh.instrumentId &&
            t.confluenceKey === confKey &&
            Date.now() - (t.closedAt ?? 0) < 60 * 60 * 1000
        );

        if (!recentTerminal) {
          const newTracked = createTrackedSetup(fresh);
          const checked = updateSetupStatus(newTracked, fresh.currentPrice);
          updatedActive.push(checked);
          changed = true;
        }
      }
    }

    for (const [, remaining] of activeMap) {
      const updated = updateSetupStatus(remaining, remaining.setup.currentPrice);
      if (!isSetupActive(updated.status)) {
        changed = true;
        if (updated.outcome) {
          const key = updated.confluenceKey;
          patterns[key] = recordOutcome(patterns[key] ?? null, updated);
        }
        terminalList.push(updated);
      } else {
        updatedActive.push(updated);
      }
    }

    // Update ref for next cycle
    const all = [...updatedActive, ...terminalList];
    trackedRef.current = all;

    // Persist to localStorage if state changed (idempotent, no re-render)
    if (changed && typeof window !== "undefined") {
      patternsRef.current = patterns;
      saveTrackedSetups(all);
      saveConfluencePatterns(patterns);
    }

    return {
      activeSetups: updatedActive.sort(
        (a, b) => b.setup.convictionScore - a.setup.convictionScore
      ),
      historySetups: terminalList.sort(
        (a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0)
      ),
    };
  }, [freshSetups]);

  const clearHistory = useCallback(() => {
    clearAllTrackingData();
    trackedRef.current = [];
    patternsRef.current = {};
    setTick((t) => t + 1);
  }, []);

  return {
    activeSetups,
    historySetups,
    confluencePatterns: patternsRef.current,
    clearHistory,
  };
}
