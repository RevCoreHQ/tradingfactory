import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── Browser client (anon key) — used in "use client" hooks for reads ──
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

// ── Server client (service role key) — used in API routes for writes ──
export function getServiceSupabase(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

// ── Server-side cache write (fire-and-forget) ──
export async function upsertCache(
  cacheKey: string,
  data: unknown,
  hash: string | null,
  ttlMs: number
): Promise<void> {
  const sb = getServiceSupabase();
  if (!sb) return;

  try {
    await sb.from("llm_cache").upsert(
      {
        cache_key: cacheKey,
        data,
        hash,
        ttl_ms: ttlMs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cache_key" }
    );
  } catch (err) {
    console.warn(`[Supabase] Cache write failed for ${cacheKey}:`, err);
  }
}
