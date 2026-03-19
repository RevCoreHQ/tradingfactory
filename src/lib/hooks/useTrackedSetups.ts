"use client";

import { useRef, useCallback, useMemo, useEffect } from "react";
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
  const pendingSaveRef = useRef<{ all: TrackedSetup[]; patterns: Record<string, ConfluencePattern> } | null>(null);

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

  // Pure computation — NO side effects
  const { activeSetups, historySetups, needsPersist } = useMemo(() => {
    const currentTracked = tracked ?? [];
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
        const updated = updateSetupStatus(existing, fresh.currentPrice);
        // Keep currentPrice in sync for progress bar (visual only, no persist trigger)
        if (updated.setup.currentPrice !== fresh.currentPrice) {
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

    // Stage for persistence (but don't execute here)
    if (changed) {
      patternsRef.current = patterns;
    }

    return {
      activeSetups: updatedActive.sort(
        (a, b) => b.setup.convictionScore - a.setup.convictionScore
      ),
      historySetups: terminalList.sort(
        (a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0)
      ),
      needsPersist: changed ? [...updatedActive, ...terminalList] : null,
    };
  }, [freshSetups, tracked]);

  // Persist OUTSIDE of useMemo — runs after render, no re-render loop
  useEffect(() => {
    if (needsPersist && typeof window !== "undefined") {
      saveTrackedSetups(needsPersist);
      saveConfluencePatterns(patternsRef.current);
      mutate(needsPersist, false);
    }
  }, [needsPersist, mutate]);

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
