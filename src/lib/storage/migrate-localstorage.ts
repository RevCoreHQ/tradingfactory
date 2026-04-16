'use client';

// ============================================================
// migrate-localstorage.ts — one-time migration helper
//
// Reads tf_tracked_setups from localStorage and POSTs them
// to /api/decision/ideas as manual TradeIdea rows.
// Should be called once per user (idempotent: dedup by id).
//
// Usage: call migrateLocalStorageSetups() from a useEffect on
// mount in a top-level component (e.g. TradingDeskPage).
// The function is safe to call multiple times — it records
// which ids have been migrated to avoid duplicates.
// ============================================================

import { loadTrackedSetups } from '@/lib/storage/setup-storage';
import type { TrackedSetup } from '@/lib/types/signals';
import type { TradeIdeaDraft, TradeState } from '@/lib/types/trade-idea';

const MIGRATION_DONE_KEY = 'tf_de_migrated_ids';

function getMigratedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(MIGRATION_DONE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveMigratedId(id: string): void {
  try {
    const ids = getMigratedIds();
    ids.add(id);
    localStorage.setItem(MIGRATION_DONE_KEY, JSON.stringify([...ids]));
  } catch {}
}

/** Map legacy SetupStatus to canonical TradeState. */
function mapStatus(status: string): TradeState {
  switch (status) {
    case 'pending':     return 'idea';
    case 'active':      return 'watching';
    case 'breakeven':
    case 'tp1_hit':
    case 'tp2_hit':     return 'managing';
    case 'tp3_hit':     return 'exited';
    case 'sl_hit':      return 'exited';
    case 'expired':     return 'invalidated';
    case 'invalidated': return 'invalidated';
    default:            return 'idea';
  }
}

/** Convert a TrackedSetup into a CreateIdea POST body. */
function trackedToIdeaDraft(t: TrackedSetup): (TradeIdeaDraft & { id_hint?: string }) | null {
  const s = t.setup;
  if (!s.entry || !s.stopLoss || !s.takeProfit) return null;

  const direction: 'long' | 'short' = s.direction === 'bullish' ? 'long' : 'short';
  const entryRef = (s.entry[0] + s.entry[1]) / 2;

  return {
    instrument:              s.instrumentId,
    direction,
    trade_type:              s.tradingStyle === 'swing' ? 'swing' : 'intraday',
    priority:                'primary',
    origin:                  'mechanical',
    entry_zone:              { min: s.entry[0], max: s.entry[1], ref: entryRef },
    stop_loss:               s.stopLoss,
    take_profits: s.takeProfit.map((level, i) => ({
      level,
      r_multiple: s.riskReward[i] ?? i + 1,
      weight:     i === 0 ? 0.5 : i === 1 ? 0.3 : 0.2,
    })),
    thesis:            `Migrated from local tracker — ${s.conviction} ${direction} on ${s.displayName}`,
    entry_conditions:  [],
    invalidation:      {
      price: s.stopLoss,
      structure: `SL at ${s.stopLoss.toFixed(5)}`,
    },
    confidence:              s.convictionScore,
    source_bias_snapshot_id: '',
    source_candidate_refs:   [`legacy:${t.id}`],
    tags:                    ['migrated', `conviction-${s.conviction}`],
    id_hint: t.id,
  };
}

/**
 * Migrate all localStorage tracked setups to Supabase trade_ideas.
 * Returns the number of successfully migrated rows.
 */
export async function migrateLocalStorageSetups(): Promise<number> {
  if (typeof window === 'undefined') return 0;

  const setups = loadTrackedSetups();
  if (setups.length === 0) return 0;

  const migratedIds = getMigratedIds();
  const pending = setups.filter((s) => !migratedIds.has(s.id));
  if (pending.length === 0) return 0;

  let count = 0;

  for (const tracked of pending) {
    const draft = trackedToIdeaDraft(tracked);
    if (!draft) {
      saveMigratedId(tracked.id);
      continue;
    }

    try {
      const res = await fetch('/api/decision/ideas', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });

      if (res.ok || res.status === 409) {
        // 409 = conflict blocked (opposite direction) or already exists — still mark as done
        saveMigratedId(tracked.id);
        if (res.ok) count++;
      }
    } catch {
      // Network error — will retry on next mount
    }
  }

  return count;
}

// ── React hook for one-time migration ────────────────────

import { useEffect, useRef } from 'react';

export function useMigrateLocalStorage() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    migrateLocalStorageSetups().then((n) => {
      if (n > 0) {
        console.info(`[DecisionEngine] Migrated ${n} local setups to Supabase.`);
      }
    });
  }, []);
}
