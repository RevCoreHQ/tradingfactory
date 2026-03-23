import { supabase } from "./supabase";

/**
 * Read a cached LLM result from Supabase.
 * Returns null if Supabase is unavailable, row is missing, or data is stale.
 */
export async function readCache<T>(cacheKey: string): Promise<T | null> {
  if (!supabase) return null;

  try {
    const { data: row, error } = await supabase
      .from("llm_cache")
      .select("data, ttl_ms, updated_at")
      .eq("cache_key", cacheKey)
      .single();

    if (error || !row) return null;

    // Staleness check
    const updatedAt = new Date(row.updated_at).getTime();
    if (Date.now() > updatedAt + row.ttl_ms) return null;

    return row.data as T;
  } catch {
    return null;
  }
}
