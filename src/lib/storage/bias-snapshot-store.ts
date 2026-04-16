// ============================================================
// bias-snapshot-store.ts — server-side Supabase CRUD for BiasSnapshot
// ============================================================

import { getServiceSupabase, supabase } from '@/lib/supabase';
import type { BiasSnapshot, BiasSnapshotDraft } from '@/lib/types/bias-snapshot';

const TABLE = 'bias_snapshots';

// ── READ (browser-safe, RLS-scoped) ──────────────────────

/** Return the latest committed snapshot for an instrument. */
export async function getCommittedSnapshot(
  userId: string,
  instrument: string
): Promise<BiasSnapshot | null> {
  const client = supabase;
  if (!client) return null;
  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('instrument', instrument)
    .eq('committed', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data as BiasSnapshot;
}

/** Return all latest committed snapshots for all instruments. */
export async function getAllCommittedSnapshots(
  userId: string
): Promise<BiasSnapshot[]> {
  const client = supabase;
  if (!client) return [];
  // Subquery to get the newest committed snapshot per instrument
  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('committed', true)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[bias-snapshot-store] getAllCommittedSnapshots:', error.message);
    return [];
  }
  // Deduplicate: one per instrument (latest)
  const seen = new Set<string>();
  return (data ?? []).filter((row) => {
    if (seen.has(row.instrument)) return false;
    seen.add(row.instrument);
    return true;
  }) as BiasSnapshot[];
}

// ── WRITE (service-role only) ─────────────────────────────

/** Upsert a bias snapshot (dedup by inputs_hash for committed rows). */
export async function upsertSnapshot(
  userId: string,
  draft: BiasSnapshotDraft
): Promise<BiasSnapshot | null> {
  const sb = getServiceSupabase();
  if (!sb) return null;
  const row = {
    ...draft,
    user_id: userId,
    created_at: new Date().toISOString(),
  };
  const { data, error } = await sb
    .from(TABLE)
    .upsert(row, { onConflict: draft.committed ? 'user_id,instrument,inputs_hash' : undefined })
    .select()
    .single();
  if (error) {
    console.error('[bias-snapshot-store] upsertSnapshot:', error.message);
    return null;
  }
  return data as BiasSnapshot;
}
