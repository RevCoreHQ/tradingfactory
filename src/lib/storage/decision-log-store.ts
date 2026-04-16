// ============================================================
// decision-log-store.ts — server-side Supabase CRUD for DecisionLogEntry
// The log is append-only; rows are never updated or deleted.
// ============================================================

import { getServiceSupabase, supabase } from '@/lib/supabase';
import type { DecisionLogEntry, DecisionLogDraft } from '@/lib/types/decision-log';

const TABLE = 'decision_log';

// ── READ (browser-safe, RLS-scoped) ──────────────────────

/** Fetch recent log entries for a user, optionally filtered by idea. */
export async function getRecentLog(
  userId: string,
  opts: { ideaId?: string; limit?: number; since?: string } = {}
): Promise<DecisionLogEntry[]> {
  const client = supabase;
  if (!client) return [];
  let query = client
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.ideaId) query = query.eq('idea_id', opts.ideaId);
  if (opts.since) query = query.gt('created_at', opts.since);
  const { data, error } = await query;
  if (error) {
    console.warn('[decision-log-store] getRecentLog:', error.message);
    return [];
  }
  return (data ?? []) as DecisionLogEntry[];
}

// ── WRITE (service-role only) ─────────────────────────────

/** Append one log entry. Returns the persisted row. */
export async function appendLog(
  userId: string,
  draft: DecisionLogDraft
): Promise<DecisionLogEntry | null> {
  const sb = getServiceSupabase();
  if (!sb) return null;
  const row = {
    ...draft,
    user_id: userId,
    created_at: new Date().toISOString(),
  };
  const { data, error } = await sb
    .from(TABLE)
    .insert(row)
    .select()
    .single();
  if (error) {
    console.error('[decision-log-store] appendLog:', error.message);
    return null;
  }
  return data as DecisionLogEntry;
}

/** Append multiple log entries atomically. */
export async function appendLogs(
  userId: string,
  drafts: DecisionLogDraft[]
): Promise<number> {
  const sb = getServiceSupabase();
  if (!sb) return 0;
  const now = new Date().toISOString();
  const rows = drafts.map((d) => ({ ...d, user_id: userId, created_at: now }));
  const { error, count } = await sb
    .from(TABLE)
    .insert(rows)
    .select('id');
  if (error) {
    console.error('[decision-log-store] appendLogs:', error.message);
    return 0;
  }
  return count ?? drafts.length;
}
