import type { BacktestResult, OptimizationProfile, BatchInstrumentResult, OptimizedParams } from "@/lib/types/backtest";

const RESULTS_KEY = "tf_backtest_results";
const PROFILES_KEY = "tf_optimization_profiles";
const MAX_RESULTS = 10;
const MAX_PROFILES = 5;

// ==================== BACKTEST RESULTS ====================

export function loadBacktestResults(): BacktestResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RESULTS_KEY);
    return raw ? (JSON.parse(raw) as BacktestResult[]) : [];
  } catch {
    return [];
  }
}

export function saveBacktestResult(result: BacktestResult): void {
  if (typeof window === "undefined") return;
  try {
    const existing = loadBacktestResults();
    const updated = [result, ...existing].slice(0, MAX_RESULTS);
    localStorage.setItem(RESULTS_KEY, JSON.stringify(updated));
  } catch {
    // localStorage full — evict oldest
    try {
      const existing = loadBacktestResults();
      const trimmed = [result, ...existing].slice(0, MAX_RESULTS / 2);
      localStorage.setItem(RESULTS_KEY, JSON.stringify(trimmed));
    } catch {
      // give up
    }
  }
}

export function clearBacktestResults(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(RESULTS_KEY);
}

// ==================== OPTIMIZATION PROFILES ====================

export function loadOptimizationProfiles(): OptimizationProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    return raw ? (JSON.parse(raw) as OptimizationProfile[]) : [];
  } catch {
    return [];
  }
}

export function saveOptimizationProfile(profile: OptimizationProfile): void {
  if (typeof window === "undefined") return;
  try {
    const existing = loadOptimizationProfiles();
    const idx = existing.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      existing[idx] = profile;
    } else {
      existing.unshift(profile);
    }
    const trimmed = existing.slice(0, MAX_PROFILES);
    localStorage.setItem(PROFILES_KEY, JSON.stringify(trimmed));
  } catch {
    // storage full
  }
}

// ==================== BATCH RESULTS ====================

const BATCH_KEY = "tf_batch_results";
const MAX_BATCHES = 3;

interface StoredBatch {
  timestamp: number;
  results: BatchInstrumentResult[];
}

export function loadBatchResults(): StoredBatch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BATCH_KEY);
    return raw ? (JSON.parse(raw) as StoredBatch[]) : [];
  } catch {
    return [];
  }
}

export function saveBatchResults(results: BatchInstrumentResult[]): void {
  if (typeof window === "undefined") return;
  try {
    // Strip trade arrays and equity curves to save space
    const lightweight = results.map((r) => ({
      ...r,
      baselineResult: { ...r.baselineResult, trades: [], equityCurve: [] },
      improvedResult: r.improvedResult
        ? { ...r.improvedResult, trades: [], equityCurve: [] }
        : null,
    }));
    const existing = loadBatchResults();
    const batch: StoredBatch = { timestamp: Date.now(), results: lightweight };
    const updated = [batch, ...existing].slice(0, MAX_BATCHES);
    localStorage.setItem(BATCH_KEY, JSON.stringify(updated));
  } catch {
    try {
      const lightweight = results.map((r) => ({
        ...r,
        baselineResult: { ...r.baselineResult, trades: [], equityCurve: [] },
        improvedResult: null,
      }));
      localStorage.setItem(BATCH_KEY, JSON.stringify([{ timestamp: Date.now(), results: lightweight }]));
    } catch { /* give up */ }
  }
}

// ==================== OPTIMIZED PARAMS (Weekend Lab → Runtime) ====================

const OPTIMIZED_KEY = "tf_optimized_params";

export function loadOptimizedParams(): OptimizedParams[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OPTIMIZED_KEY);
    return raw ? (JSON.parse(raw) as OptimizedParams[]) : [];
  } catch {
    return [];
  }
}

export function getOptimizedOverrides(
  instrumentId: string,
  style: string
): NonNullable<OptimizedParams["overrides"]> | null {
  const all = loadOptimizedParams();
  const match = all.find((p) => p.instrumentId === instrumentId && p.style === style);
  return match?.overrides ?? null;
}

export function saveOptimizedParams(params: OptimizedParams[]): void {
  if (typeof window === "undefined") return;
  try {
    // Dedupe by instrumentId+style — keep latest
    const map = new Map<string, OptimizedParams>();
    for (const p of params) {
      map.set(`${p.instrumentId}::${p.style}`, p);
    }
    localStorage.setItem(OPTIMIZED_KEY, JSON.stringify(Array.from(map.values())));
  } catch {
    // storage full
  }
}

export function clearOptimizedParams(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(OPTIMIZED_KEY);
}
