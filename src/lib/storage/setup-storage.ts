import type { TrackedSetup, ConfluencePattern } from "@/lib/types/signals";

const TRACKED_KEY = "tf_tracked_setups";
const PATTERNS_KEY = "tf_confluence_patterns";
const MAX_TRACKED = 200;

// ==================== TRACKED SETUPS ====================

export function loadTrackedSetups(): TrackedSetup[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TRACKED_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TrackedSetup[];
  } catch {
    return [];
  }
}

export function saveTrackedSetups(setups: TrackedSetup[]): void {
  if (typeof window === "undefined") return;
  try {
    // Keep max entries — prune oldest terminal first
    let list = setups;
    if (list.length > MAX_TRACKED) {
      const active = list.filter((s) => !isTerminalStatus(s.status));
      const terminal = list
        .filter((s) => isTerminalStatus(s.status))
        .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0))
        .slice(0, MAX_TRACKED - active.length);
      list = [...active, ...terminal];
    }
    localStorage.setItem(TRACKED_KEY, JSON.stringify(list));
  } catch {}
}

// ==================== CONFLUENCE PATTERNS ====================

export function loadConfluencePatterns(): Record<string, ConfluencePattern> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PATTERNS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ConfluencePattern>;
  } catch {
    return {};
  }
}

export function saveConfluencePatterns(
  patterns: Record<string, ConfluencePattern>
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PATTERNS_KEY, JSON.stringify(patterns));
  } catch {}
}

// ==================== HELPERS ====================

function isTerminalStatus(status: string): boolean {
  return ["tp1_hit", "tp2_hit", "tp3_hit", "sl_hit", "expired", "invalidated"].includes(status);
}

export function clearAllTrackingData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TRACKED_KEY);
  localStorage.removeItem(PATTERNS_KEY);
}
