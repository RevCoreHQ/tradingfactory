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
    const setups = JSON.parse(raw) as TrackedSetup[];
    // Dedup: keep only the latest entry per instrument+status combo for terminals
    return dedup(setups);
  } catch {
    return [];
  }
}

function dedup(setups: TrackedSetup[]): TrackedSetup[] {
  const active: TrackedSetup[] = [];
  const terminalMap = new Map<string, TrackedSetup>();

  for (const s of setups) {
    if (!isTerminalStatus(s.status)) {
      // Only keep one active per instrument
      if (!active.some((a) => a.setup.instrumentId === s.setup.instrumentId)) {
        active.push(s);
      }
    } else {
      // For terminals, keep the latest per instrument+confluenceKey
      const key = `${s.setup.instrumentId}:${s.confluenceKey}:${s.closedAt}`;
      if (!terminalMap.has(key)) {
        terminalMap.set(key, s);
      }
    }
  }

  const result = [...active, ...terminalMap.values()];
  // If we deduped anything, save the clean version
  if (result.length < setups.length && typeof window !== "undefined") {
    localStorage.setItem(TRACKED_KEY, JSON.stringify(result));
  }
  return result;
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
