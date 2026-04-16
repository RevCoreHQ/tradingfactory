// ============================================================
// trade-ideas-store.ts — server-side Supabase CRUD for TradeIdea
// All writes use the service-role client (bypasses RLS).
// The browser client uses RLS for reads only.
// ============================================================

import { getServiceSupabase, supabase } from '@/lib/supabase';
import type { TradeIdea, TradeIdeaDraft, TradeState } from '@/lib/types/trade-idea';

const TABLE = 'trade_ideas';

// ── READ (browser-safe, RLS-scoped) ──────────────────────

/** Load all active (non-terminal) ideas for a user, newest first. */
export async function getActiveIdeas(userId: string): Promise<TradeIdea[]> {
  const client = supabase;
  if (!client) return [];
  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .not('state', 'in', '("exited","invalidated")')
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[trade-ideas-store] getActiveIdeas:', error.message);
    return [];
  }
  return (data ?? []) as TradeIdea[];
}

/** Load terminal ideas for history/journal display. */
export async function getTerminalIdeas(
  userId: string,
  limit = 50
): Promise<TradeIdea[]> {
  const client = supabase;
  if (!client) return [];
  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .in('state', ['exited', 'invalidated'])
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.warn('[trade-ideas-store] getTerminalIdeas:', error.message);
    return [];
  }
  return (data ?? []) as TradeIdea[];
}

/** Load a single idea by id. */
export async function getIdeaById(id: string): Promise<TradeIdea | null> {
  const client = supabase;
  if (!client) return null;
  const { data, error } = await client
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as TradeIdea;
}

// ── WRITE (service-role only — call from API routes) ──────

/** Create a new TradeIdea. Returns the persisted row. */
export async function createIdea(
  userId: string,
  draft: TradeIdeaDraft
): Promise<TradeIdea | null> {
  const sb = getServiceSupabase();
  if (!sb) return null;
  const now = new Date().toISOString();
  const row = {
    ...draft,
    user_id: userId,
    state: 'idea' as TradeState,
    state_since: now,
    created_at: now,
    updated_at: now,
  };
  const { data, error } = await sb
    .from(TABLE)
    .insert(row)
    .select()
    .single();
  if (error) {
    console.error('[trade-ideas-store] createIdea:', error.message);
    return null;
  }
  return data as TradeIdea;
}

/** Update an existing TradeIdea (partial). Service-role only. */
export async function updateIdea(
  id: string,
  patch: Partial<TradeIdea>
): Promise<TradeIdea | null> {
  const sb = getServiceSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('[trade-ideas-store] updateIdea:', error.message);
    return null;
  }
  return data as TradeIdea;
}

/** Bulk-insert legacy LocalStorage ideas during one-time migration. */
export async function bulkInsertIdeas(
  userId: string,
  ideas: Omit<TradeIdea, 'user_id'>[]
): Promise<number> {
  const sb = getServiceSupabase();
  if (!sb) return 0;
  const rows = ideas.map((i) => ({ ...i, user_id: userId }));
  const { error, count } = await sb
    .from(TABLE)
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    .select('id');
  if (error) {
    console.error('[trade-ideas-store] bulkInsertIdeas:', error.message);
    return 0;
  }
  return count ?? 0;
}
