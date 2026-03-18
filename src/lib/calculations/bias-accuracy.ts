import type { BiasHistoryEntry, BiasOutcome, AccuracyStats } from "@/lib/types/bias";
import { INSTRUMENTS } from "@/lib/utils/constants";

const HOURS_24 = 24 * 60 * 60 * 1000;
const HOURS_168 = 7 * 24 * 60 * 60 * 1000;
const STORAGE_KEY = "trading-factory-bias-history";

/**
 * Evaluate whether a bias prediction was correct.
 * Returns null if not enough time has elapsed.
 */
export function evaluateOutcome(
  entry: BiasHistoryEntry,
  currentPrice: number,
  windowMs: number
): BiasOutcome | null {
  if (!entry.priceAtPrediction || entry.priceAtPrediction === 0) return null;
  if (Date.now() - entry.timestamp < windowMs) return null;
  if (entry.direction === "neutral") return null;

  const actualDirection: "up" | "down" = currentPrice > entry.priceAtPrediction ? "up" : "down";
  const predictedUp = entry.direction === "bullish" || entry.direction === "strong_bullish";
  const wasCorrect = predictedUp ? actualDirection === "up" : actualDirection === "down";

  return {
    actualDirection,
    priceAtPrediction: entry.priceAtPrediction,
    priceAfter: currentPrice,
    wasCorrect,
    measuredAt: Date.now(),
  };
}

/**
 * Fill in outcomes retroactively for history entries that have enough elapsed time.
 * Uses currentPrice as approximation (we don't have historical price snapshots).
 */
export function fillOutcomesRetroactively(
  history: BiasHistoryEntry[],
  currentPrice: number
): { updated: BiasHistoryEntry[]; changed: boolean } {
  let changed = false;
  const updated = history.map((entry) => {
    let modified = false;
    let result = { ...entry };

    if (!result.outcome24h && result.priceAtPrediction) {
      const outcome = evaluateOutcome(entry, currentPrice, HOURS_24);
      if (outcome) {
        result = { ...result, outcome24h: outcome };
        modified = true;
      }
    }

    if (!result.outcome1w && result.priceAtPrediction) {
      const outcome = evaluateOutcome(entry, currentPrice, HOURS_168);
      if (outcome) {
        result = { ...result, outcome1w: outcome };
        modified = true;
      }
    }

    if (modified) changed = true;
    return modified ? result : entry;
  });

  return { updated, changed };
}

/**
 * Load all bias history entries across all instruments from localStorage.
 */
export function loadAllBiasHistory(): Record<string, BiasHistoryEntry[]> {
  if (typeof window === "undefined") return {};
  const result: Record<string, BiasHistoryEntry[]> = {};
  for (const inst of INSTRUMENTS) {
    const key = `${STORAGE_KEY}-${inst.id}`;
    const data = localStorage.getItem(key);
    if (data) {
      try {
        const entries = JSON.parse(data) as BiasHistoryEntry[];
        if (entries.length > 0) result[inst.id] = entries;
      } catch { /* ignore parse errors */ }
    }
  }
  return result;
}

/**
 * Save updated history back to localStorage for a specific instrument.
 */
export function saveInstrumentHistory(instrumentId: string, history: BiasHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  const key = `${STORAGE_KEY}-${instrumentId}`;
  localStorage.setItem(key, JSON.stringify(history));
}

/**
 * Calculate accuracy stats for a single instrument's history.
 */
export function calculateInstrumentAccuracy(history: BiasHistoryEntry[]): {
  total: number;
  correct24h: number;
  correct1w: number;
  winRate24h: number;
  winRate1w: number;
  streak: number;
} {
  const withOutcome24h = history.filter((e) => e.outcome24h);
  const withOutcome1w = history.filter((e) => e.outcome1w);
  const correct24h = withOutcome24h.filter((e) => e.outcome24h!.wasCorrect).length;
  const correct1w = withOutcome1w.filter((e) => e.outcome1w!.wasCorrect).length;

  // Calculate current streak from most recent 24h outcomes
  let streak = 0;
  for (let i = withOutcome24h.length - 1; i >= 0; i--) {
    const wasCorrect = withOutcome24h[i].outcome24h!.wasCorrect;
    if (streak === 0) {
      streak = wasCorrect ? 1 : -1;
    } else if ((streak > 0 && wasCorrect) || (streak < 0 && !wasCorrect)) {
      streak += streak > 0 ? 1 : -1;
    } else {
      break;
    }
  }

  return {
    total: withOutcome24h.length,
    correct24h,
    correct1w,
    winRate24h: withOutcome24h.length > 0 ? Math.round((correct24h / withOutcome24h.length) * 100) : 0,
    winRate1w: withOutcome1w.length > 0 ? Math.round((correct1w / withOutcome1w.length) * 100) : 0,
    streak,
  };
}

/**
 * Calculate aggregate accuracy stats across all instruments.
 */
export function calculateAccuracyStats(
  allHistory: Record<string, BiasHistoryEntry[]>
): AccuracyStats {
  let total = 0;
  let correct24h = 0;
  let correct1w = 0;
  let bestStreak = 0;
  const byInstrument: AccuracyStats["byInstrument"] = {};

  // Collect all entries with outcomes for global streak calculation
  const allEntries: BiasHistoryEntry[] = [];

  for (const [instrumentId, history] of Object.entries(allHistory)) {
    const stats = calculateInstrumentAccuracy(history);
    total += stats.total;
    correct24h += stats.correct24h;
    correct1w += stats.correct1w;
    if (Math.abs(stats.streak) > Math.abs(bestStreak)) bestStreak = stats.streak;
    byInstrument[instrumentId] = {
      total: stats.total,
      correct24h: stats.correct24h,
      correct1w: stats.correct1w,
    };
    allEntries.push(...history.filter((e) => e.outcome24h));
  }

  // Global streak from all instruments sorted by time
  allEntries.sort((a, b) => a.timestamp - b.timestamp);
  let currentStreak = 0;
  for (let i = allEntries.length - 1; i >= 0; i--) {
    const wasCorrect = allEntries[i].outcome24h!.wasCorrect;
    if (currentStreak === 0) {
      currentStreak = wasCorrect ? 1 : -1;
    } else if ((currentStreak > 0 && wasCorrect) || (currentStreak < 0 && !wasCorrect)) {
      currentStreak += currentStreak > 0 ? 1 : -1;
    } else {
      break;
    }
  }

  return {
    total,
    correct24h,
    correct1w,
    winRate24h: total > 0 ? Math.round((correct24h / total) * 100) : 0,
    winRate1w: total > 0 ? Math.round((correct1w / total) * 100) : 0,
    currentStreak,
    bestStreak,
    byInstrument,
  };
}
