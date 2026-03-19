"use client";

import { useRef, useCallback, useMemo } from "react";
import useSWR from "swr";
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

  // Load persisted state via SWR (runs once on mount, then manual mutations)
  const { data: tracked, mutate } = useSWR(
    "tracked-setups",
    () => {
      const setups = loadTrackedSetups();
      patternsRef.current = loadConfluencePatterns();
      return setups;
    },
    { revalidateOnFocus: false, refreshInterval: 0 }
  );

  // Process fresh setups against tracked state
  const { activeSetups, historySetups } = useMemo(() => {
    const currentTracked = tracked ?? [];
    const patterns = patternsRef.current;
    let changed = false;

    // Map of instrumentId → existing tracked (non-terminal only)
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
        // Update status with current price
        const updated = updateSetupStatus(existing, fresh.currentPrice);
        // Keep setup.currentPrice in sync for progress bar visualization
        if (updated.setup.currentPrice !== fresh.currentPrice) {
          updated.setup = { ...updated.setup, currentPrice: fresh.currentPrice };
          changed = true;
        }

        if (updated.status !== existing.status) {
          changed = true;

          // If just became terminal, record outcome
          if (!isSetupActive(updated.status)) {
            const key = updated.confluenceKey;
            patterns[key] = recordOutcome(patterns[key] ?? null, updated);
            terminalList.push(updated);
            continue; // Don't add to active list
          }
        }

        updatedActive.push(updated);
        activeMap.delete(fresh.instrumentId);
      } else {
        // Check if there's a recent terminal for this instrument with same confluence
        const confKey = buildConfluenceKey(fresh);
        const recentTerminal = terminalList.find(
          (t) =>
            t.setup.instrumentId === fresh.instrumentId &&
            t.confluenceKey === confKey &&
            Date.now() - (t.closedAt ?? 0) < 60 * 60 * 1000 // Within 1 hour
        );

        if (!recentTerminal) {
          // New setup — create tracked
          const newTracked = createTrackedSetup(fresh);
          // Immediately check if already active (price in zone)
          const checked = updateSetupStatus(newTracked, fresh.currentPrice);
          updatedActive.push(checked);
          changed = true;
        }
      }
    }

    // Any remaining in activeMap that weren't in freshSetups — check expiry
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

    // Persist if changed
    if (changed && typeof window !== "undefined") {
      const all = [...updatedActive, ...terminalList];
      saveTrackedSetups(all);
      saveConfluencePatterns(patterns);
      patternsRef.current = patterns;
      // Trigger SWR revalidation without refetching
      mutate(all, false);
    }

    return {
      activeSetups: updatedActive.sort(
        (a, b) => b.setup.convictionScore - a.setup.convictionScore
      ),
      historySetups: terminalList.sort(
        (a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0)
      ),
    };
  }, [freshSetups, tracked, mutate]);

  const clearHistory = useCallback(() => {
    clearAllTrackingData();
    patternsRef.current = {};
    mutate([], false);
  }, [mutate]);

  return {
    activeSetups,
    historySetups,
    confluencePatterns: patternsRef.current,
    clearHistory,
  };
}
