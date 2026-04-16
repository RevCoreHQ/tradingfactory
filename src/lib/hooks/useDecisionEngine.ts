'use client';

// ============================================================
// useDecisionEngine — primary hook for the trading desk UI
//
// Polls GET /api/decision/snapshot and exposes:
// - market_bias (committed per-instrument direction)
// - active_ideas (all non-terminal ideas)
// - actions_taken (recent decision log)
// - A transition() helper for user-initiated state changes
//
// Uses SWR for caching + revalidation.
// The `since` cursor prevents log duplication across polls.
// ============================================================

import useSWR, { mutate } from 'swr';
import { useCallback, useRef } from 'react';
import type { DecisionSnapshot } from '@/lib/types/decision-log';
import type { TradeState } from '@/lib/types/trade-idea';

const SNAPSHOT_KEY = '/api/decision/snapshot';

async function fetchSnapshot(url: string): Promise<DecisionSnapshot> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`[useDecisionEngine] ${res.status}`);
  return res.json();
}

export interface UseDecisionEngineOptions {
  /** Poll interval in ms. Default: 30 000 (30s). 0 = no polling. */
  refreshInterval?: number;
}

export interface TransitionOptions {
  reason: string;
  payload?: Record<string, unknown>;
}

export function useDecisionEngine(opts: UseDecisionEngineOptions = {}) {
  const { refreshInterval = 30_000 } = opts;

  const { data, error, isLoading, mutate: revalidate } = useSWR<DecisionSnapshot>(
    SNAPSHOT_KEY,
    fetchSnapshot,
    {
      refreshInterval,
      revalidateOnFocus: true,
      dedupingInterval:  5_000,
    }
  );

  // ── Transition helper ──────────────────────────────────

  const transitionIdea = useCallback(
    async (ideaId: string, to: TradeState, opts: TransitionOptions) => {
      const res = await fetch(`/api/decision/ideas/${ideaId}/transition`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ to, reason: opts.reason, payload: opts.payload ?? {} }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw Object.assign(new Error(body.reason ?? body.error ?? 'Transition failed'), body);
      }
      const { idea } = await res.json();
      // Optimistically update local snapshot
      revalidate();
      return idea;
    },
    [revalidate]
  );

  // ── Derived helpers ────────────────────────────────────

  const biasForInstrument = useCallback(
    (instrument: string) => data?.market_bias?.[instrument] ?? null,
    [data]
  );

  const ideasForInstrument = useCallback(
    (instrument: string) =>
      (data?.active_ideas ?? []).filter((i) => i.instrument === instrument),
    [data]
  );

  /** Returns true when any recent log contains a conflict_blocked event. */
  const hasConflicts = (data?.actions_taken ?? []).some(
    (e) => e.event === 'conflict_blocked'
  );

  /** Returns true when bias was flip-blocked for any instrument. */
  const hasFlipBlocks = (data?.actions_taken ?? []).some(
    (e) => e.event === 'bias_flip_blocked'
  );

  /** Count of active (non-terminal) ideas. */
  const activeIdeaCount = data?.active_ideas?.length ?? 0;

  return {
    snapshot:            data ?? null,
    isLoading,
    error,
    revalidate,
    transitionIdea,
    biasForInstrument,
    ideasForInstrument,
    hasConflicts,
    hasFlipBlocks,
    activeIdeaCount,
  };
}
