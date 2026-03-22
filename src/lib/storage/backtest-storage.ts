import type { BacktestResult, OptimizationProfile } from "@/lib/types/backtest";

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
