"use client";

import { useRef, useCallback, useMemo, useState, useEffect } from "react";
import type { TradeDeskSetup, TrackedSetup, ConfluencePattern } from "@/lib/types/signals";
import {
  createTrackedSetup,
  updateSetupStatus,
  buildConfluenceKey,
  isSetupActive,
  isRunning,
} from "@/lib/calculations/setup-tracker";
import { recordOutcome } from "@/lib/calculations/confluence-learning";
import { detectScaleIn, detectMissedEntry } from "@/lib/calculations/scale-in-detector";
import { createMilestoneAlert } from "@/lib/calculations/alert-engine";
import { useMarketStore } from "@/lib/store/market-store";
import {
  loadTrackedSetups,
  saveTrackedSetups,
  loadConfluencePatterns,
  saveConfluencePatterns,
  loadSystemPerformance,
  saveSystemPerformance,
  clearAllTrackingData,
} from "@/lib/storage/setup-storage";
import { recordSystemOutcome, type SystemPerformance } from "@/lib/calculations/system-performance";
import type { SmartAlert } from "@/lib/types/alerts";

interface UseTrackedSetupsResult {
  activeSetups: TrackedSetup[];
  historySetups: TrackedSetup[];
  confluencePatterns: Record<string, ConfluencePattern>;
  systemPerformance: Record<string, SystemPerformance>;
  clearHistory: () => void;
  dismissScaleIn: (setupId: string, scaleInIndex: number) => void;
}

export function useTrackedSetups(
  freshSetups: TradeDeskSetup[]
): UseTrackedSetupsResult {
  const patternsRef = useRef<Record<string, ConfluencePattern>>({});
  const trackedRef = useRef<TrackedSetup[]>([]);
  const sysPerfRef = useRef<Record<string, SystemPerformance>>({});
  const initializedRef = useRef(false);
  const milestoneAlertsRef = useRef<SmartAlert[]>([]);
  const addStoreAlerts = useMarketStore((s) => s.addAlerts);

  // Load from localStorage once on mount (ref-based, no SWR)
  if (!initializedRef.current && typeof window !== "undefined") {
    trackedRef.current = loadTrackedSetups();
    patternsRef.current = loadConfluencePatterns();
    sysPerfRef.current = loadSystemPerformance();
    initializedRef.current = true;
  }

  // Force re-render trigger (only used by clearHistory)
  const [, setTick] = useState(0);

  // Pure computation against ref state — no SWR, no mutate
  const { activeSetups, historySetups } = useMemo(() => {
    const currentTracked = trackedRef.current;
    const patterns = { ...patternsRef.current };
    let sysPerf = { ...sysPerfRef.current };
    let changed = false;
    const milestoneAlerts: SmartAlert[] = [];

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

        // If conviction dropped below B on an actionable setup, invalidate — no longer tradeable
        const isBelowA = fresh.conviction === "C" || fresh.conviction === "D";
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
          // Only create replacement if it qualifies (A+/A with valid gates)
          const newQualified =
            (fresh.conviction === "A+" || fresh.conviction === "A") &&
            fresh.direction !== "neutral" &&
            fresh.riskReward[0] >= 1.5 &&
            !(fresh.direction === "bullish" && fresh.impulse === "red") &&
            !(fresh.direction === "bearish" && fresh.impulse === "green");
          if (newQualified) {
            const newTracked = createTrackedSetup(fresh);
            const checked = updateSetupStatus(newTracked, fresh.currentPrice);
            updatedActive.push(checked);
          }
          continue;
        }

        const updated = updateSetupStatus(existing, fresh.currentPrice);

        // For actionable setups, sync signal metadata so cards match advisor.
        // IMPORTANT: Once a setup is "active" (price entered the zone), freeze
        // the trade plan levels (entry/SL/TP/R:R). Only pending setups get
        // level updates — active setups must keep the levels they entered with,
        // otherwise the entry zone drifts with price causing false breakeven
        // triggers and misaligned progress bars.
        if (isStillActionable) {
          const isPending = existing.status === "pending";
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
            // Only sync trade plan levels for pending setups — freeze on activation
            ...(isPending ? {
              entry: fresh.entry,
              stopLoss: fresh.stopLoss,
              takeProfit: fresh.takeProfit,
              riskReward: fresh.riskReward,
              positionSizeLots: fresh.positionSizeLots,
              riskAmount: fresh.riskAmount,
            } : {}),
            reasonsToExit: fresh.reasonsToExit,
            learningApplied: fresh.learningApplied,
          };
          updated.confluenceKey = buildConfluenceKey(fresh);
          changed = true;
        } else if (updated.setup.currentPrice !== fresh.currentPrice) {
          // Running setups: sync price + detect scale-ins
          updated.setup = { ...updated.setup, currentPrice: fresh.currentPrice };

          // Detect scale-in opportunities on running trades
          if (isRunning(updated.status)) {
            const scaleIn = detectScaleIn(updated, fresh.signals);
            if (scaleIn) {
              updated.scaleIns = [...(updated.scaleIns ?? []), scaleIn];
              changed = true;
            }
          }

          // Detect missed entries (rapid activation + price already ran)
          if (!updated.missedEntry && detectMissedEntry(updated)) {
            updated.missedEntry = true;
            changed = true;
          }
        }

        if (updated.status !== existing.status) {
          changed = true;
          // Generate milestone alert for TP/SL transitions (single brain)
          const milestoneAlert = createMilestoneAlert(updated, existing.status);
          if (milestoneAlert) milestoneAlerts.push(milestoneAlert);

          if (!isSetupActive(updated.status)) {
            const key = updated.confluenceKey;
            patterns[key] = recordOutcome(patterns[key] ?? null, updated);
            sysPerf = recordSystemOutcome(sysPerf, updated);
            terminalList.push(updated);
            continue;
          }
        }

        updatedActive.push(updated);
        activeMap.delete(fresh.instrumentId);
      } else {
        // Only create NEW tracked setups for A+/A conviction with valid impulse and R:R
        // (same hard filters as rankSetupsByConviction)
        const isQualified =
          (fresh.conviction === "A+" || fresh.conviction === "A" || fresh.conviction === "B") &&
          fresh.direction !== "neutral" &&
          fresh.riskReward[0] >= 1.5 &&
          !(fresh.direction === "bullish" && fresh.impulse === "red") &&
          !(fresh.direction === "bearish" && fresh.impulse === "green");

        if (!isQualified) continue;

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
      const isStillActionable =
        remaining.status === "pending" || remaining.status === "active";

      // If still actionable but no longer in A+/A rankings, invalidate —
      // conviction dropped, impulse flipped, or R:R collapsed
      if (isStillActionable) {
        changed = true;
        const invalidated: TrackedSetup = {
          ...remaining,
          status: "invalidated",
          closedAt: Date.now(),
          outcome: "breakeven",
          pnlPercent: 0,
        };
        terminalList.push(invalidated);
        continue;
      }

      // Running/BE setups: still track price movement for SL/TP exits
      const updated = updateSetupStatus(remaining, remaining.setup.currentPrice);
      if (!isSetupActive(updated.status)) {
        changed = true;
        if (updated.outcome) {
          const key = updated.confluenceKey;
          patterns[key] = recordOutcome(patterns[key] ?? null, updated);
          sysPerf = recordSystemOutcome(sysPerf, updated);
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
      sysPerfRef.current = sysPerf;
      saveTrackedSetups(all);
      saveConfluencePatterns(patterns);
      saveSystemPerformance(sysPerf);
    }

    // Store milestone alerts for flushing after render
    milestoneAlertsRef.current = milestoneAlerts;

    return {
      activeSetups: updatedActive.sort((a, b) => {
        // Running setups first (breakeven/tp1/tp2), sorted by TP progression
        const aRun = isRunning(a.status) ? 1 : 0;
        const bRun = isRunning(b.status) ? 1 : 0;
        if (aRun !== bRun) return bRun - aRun;
        if (aRun && bRun) return b.highestTpHit - a.highestTpHit;
        return b.setup.convictionScore - a.setup.convictionScore;
      }),
      historySetups: terminalList.sort(
        (a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0)
      ),
    };
  }, [freshSetups]);

  // Flush milestone alerts to Zustand store after render (single brain)
  useEffect(() => {
    if (milestoneAlertsRef.current.length > 0) {
      addStoreAlerts(milestoneAlertsRef.current);
      milestoneAlertsRef.current = [];
    }
  }, [activeSetups, historySetups, addStoreAlerts]);

  const clearHistory = useCallback(() => {
    clearAllTrackingData();
    trackedRef.current = [];
    patternsRef.current = {};
    setTick((t) => t + 1);
  }, []);

  const dismissScaleIn = useCallback((setupId: string, scaleInIndex: number) => {
    const idx = trackedRef.current.findIndex((t) => t.id === setupId);
    if (idx === -1) return;
    const tracked = trackedRef.current[idx];
    const scaleIns = [...(tracked.scaleIns ?? [])];
    if (scaleIns[scaleInIndex]) {
      scaleIns[scaleInIndex] = { ...scaleIns[scaleInIndex], dismissed: true };
      trackedRef.current[idx] = { ...tracked, scaleIns };
      saveTrackedSetups(trackedRef.current);
      setTick((t) => t + 1);
    }
  }, []);

  return {
    activeSetups,
    historySetups,
    confluencePatterns: patternsRef.current,
    systemPerformance: sysPerfRef.current,
    clearHistory,
    dismissScaleIn,
  };
}
