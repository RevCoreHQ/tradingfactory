import { TRADING_SESSIONS } from "@/lib/utils/constants";
import type { TradingSession } from "@/lib/types/market";

export interface SessionRelevance {
  instrumentId: string;
  optimalSessions: TradingSession[];
  currentSessionActive: boolean;
  isOptimalNow: boolean;
  isOverlap: boolean;
  activeSessions: TradingSession[];
  nextOptimalIn: string;
  nextEventLabel: string; // e.g. "NY opens", "London–NY overlap", "London closes"
  nextEventCountdownMs: number; // ms until next event for live countdown
  sessionScore: number; // 0-100
  reason: string;
}

// ==================== DST-AWARE SESSION HOURS ====================

/**
 * Standard trading session hours in LOCAL exchange time.
 * These are converted to UTC dynamically to handle DST transitions.
 */
const SESSION_LOCAL_HOURS: Record<string, { open: number; close: number }> = {
  sydney: { open: 7, close: 16 },    // 7 AM - 4 PM AEST/AEDT
  tokyo: { open: 9, close: 18 },     // 9 AM - 6 PM JST (no DST)
  london: { open: 8, close: 17 },    // 8 AM - 5 PM GMT/BST
  newyork: { open: 8, close: 17 },   // 8 AM - 5 PM EST/EDT
};

/**
 * Get the current UTC offset (in hours) for a timezone, accounting for DST.
 */
function getTimezoneOffsetHours(timezone: string): number {
  const now = new Date();
  const utcStr = now.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = now.toLocaleString("en-US", { timeZone: timezone });
  return Math.round((new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 3600000);
}

/**
 * Get DST-adjusted UTC open/close hours for a session.
 * Falls back to the static constants if local hours aren't defined.
 */
export function getSessionUTCHours(sessionKey: string): { openHourUTC: number; closeHourUTC: number } {
  const session = TRADING_SESSIONS[sessionKey];
  const local = SESSION_LOCAL_HOURS[sessionKey];
  if (!session || !local) {
    return session
      ? { openHourUTC: session.openHourUTC, closeHourUTC: session.closeHourUTC }
      : { openHourUTC: 0, closeHourUTC: 0 };
  }

  const offset = getTimezoneOffsetHours(session.timezone);
  let open = local.open - offset;
  let close = local.close - offset;
  // Normalize to 0-23
  if (open < 0) open += 24;
  if (open >= 24) open -= 24;
  if (close < 0) close += 24;
  if (close >= 24) close -= 24;

  return { openHourUTC: open, closeHourUTC: close };
}

/** Map each instrument to its most active trading sessions */
export const INSTRUMENT_SESSIONS: Record<string, TradingSession[]> = {
  EUR_USD: ["london", "newyork"],
  GBP_USD: ["london", "newyork"],
  AUD_USD: ["sydney", "tokyo"],
  NZD_USD: ["sydney", "tokyo"],
  USD_JPY: ["tokyo", "newyork"],
  USD_CAD: ["newyork"],
  USD_CHF: ["london"],
  XAU_USD: ["london", "newyork"],
  BTC_USD: ["london", "newyork"],
  ETH_USD: ["london", "newyork"],
  US100: ["newyork"],
};

/** Session descriptions for UI display */
const SESSION_REASONS: Record<string, string> = {
  EUR_USD: "Peaks during London–NY overlap",
  GBP_USD: "Peaks during London–NY overlap",
  AUD_USD: "Most active during Sydney–Tokyo",
  NZD_USD: "Most active during Sydney–Tokyo",
  USD_JPY: "Peaks during Tokyo and NY sessions",
  USD_CAD: "Most active during New York session",
  USD_CHF: "Most active during London session",
  XAU_USD: "Highest volume during London–NY",
  BTC_USD: "Highest volume during London–NY",
  ETH_USD: "Highest volume during London–NY",
  US100: "US market hours only",
};

/** Instruments that trade 24/7 (ignore weekend/holiday checks) */
const CRYPTO_INSTRUMENTS = new Set(["BTC_USD", "ETH_USD"]);

/** Instruments that follow US equity calendar (close on US holidays) */
const US_INDEX_INSTRUMENTS = new Set(["US100"]);

// ==================== WEEKEND / HOLIDAY CHECKS ====================

/**
 * Forex market hours: Sunday 22:00 UTC → Friday 22:00 UTC.
 * Returns false on weekends.
 */
export function isForexMarketOpen(now?: Date): boolean {
  const d = now ?? new Date();
  const day = d.getUTCDay(); // 0=Sun, 6=Sat
  const hour = d.getUTCHours();

  if (day === 6) return false;                    // Saturday: always closed
  if (day === 0 && hour < 22) return false;       // Sunday: closed until 22:00 UTC
  if (day === 5 && hour >= 22) return false;      // Friday: closed after 22:00 UTC

  return true;
}

/**
 * NYSE/NASDAQ observed holidays 2025–2026.
 * US indices close on these dates.
 */
const US_HOLIDAYS: Set<string> = new Set([
  // 2025
  "2025-01-01", "2025-01-20", "2025-02-17", "2025-04-18",
  "2025-05-26", "2025-06-19", "2025-07-04", "2025-09-01",
  "2025-11-27", "2025-12-25",
  // 2026
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03",
  "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07",
  "2026-11-26", "2026-12-25",
]);

function toDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function isUSHoliday(now?: Date): boolean {
  return US_HOLIDAYS.has(toDateKey(now ?? new Date()));
}

/**
 * Check if markets are open for a given instrument class.
 * - Crypto: always open (24/7)
 * - US indices: closed weekends + US holidays
 * - Forex/commodities: closed weekends
 */
export function isMarketOpen(instrumentId?: string, now?: Date): boolean {
  if (instrumentId && CRYPTO_INSTRUMENTS.has(instrumentId)) return true;
  const d = now ?? new Date();
  if (!isForexMarketOpen(d)) return false;
  if (instrumentId && US_INDEX_INSTRUMENTS.has(instrumentId) && isUSHoliday(d)) return false;
  return true;
}

// ==================== SESSION CHECKS ====================

/** Check if a session is currently active (hour-based, ignores day) */
function isSessionActiveByHour(
  session: { openHourUTC: number; closeHourUTC: number },
  hourUTC: number
): boolean {
  if (session.openHourUTC < session.closeHourUTC) {
    return hourUTC >= session.openHourUTC && hourUTC < session.closeHourUTC;
  }
  return hourUTC >= session.openHourUTC || hourUTC < session.closeHourUTC;
}

/**
 * Check if a session is currently active, accounting for weekends/holidays.
 * Exported for use by MarketHours UI and other consumers.
 */
export function isSessionActive(
  session: { openHourUTC: number; closeHourUTC: number },
  hourUTC: number,
  now?: Date
): boolean {
  // If forex market is closed (weekend), no sessions are active
  // Exception: this doesn't apply to crypto, but session-level checks
  // are generic — instrument-level checks happen in isMarketOpen()
  if (!isForexMarketOpen(now)) return false;
  return isSessionActiveByHour(session, hourUTC);
}

/** Get time until a target UTC hour */
export function getTimeUntil(
  targetHourUTC: number,
  nowHourUTC: number,
  nowMinUTC: number
): string {
  let hoursUntil = targetHourUTC - nowHourUTC;
  if (hoursUntil < 0) hoursUntil += 24;
  const minsUntil = hoursUntil * 60 - nowMinUTC;
  const h = Math.floor(minsUntil / 60);
  const m = minsUntil % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/** Get time until forex market reopens (Sunday 22:00 UTC) */
function getTimeUntilMarketOpen(now: Date): string {
  const day = now.getUTCDay();
  const hour = now.getUTCHours();
  const min = now.getUTCMinutes();

  // Calculate hours until Sunday 22:00 UTC
  let daysUntilSunday = 0;
  if (day === 6) daysUntilSunday = 1; // Saturday → Sunday
  else if (day === 5 && hour >= 22) daysUntilSunday = 2; // Friday after close → Sunday
  else if (day === 0 && hour < 22) daysUntilSunday = 0; // Sunday before open

  const totalMinutes = daysUntilSunday * 24 * 60 + (22 - hour) * 60 - min;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

/** Session name lookup */
const SESSION_NAMES: Record<string, string> = {
  sydney: "Sydney",
  tokyo: "Tokyo",
  london: "London",
  newyork: "NY",
};

/** Compute ms until a target UTC hour from now */
function getMsUntilHour(targetHourUTC: number, now: Date): number {
  const nowMs = now.getTime();
  const target = new Date(now);
  target.setUTCHours(targetHourUTC, 0, 0, 0);
  if (target.getTime() <= nowMs) target.setUTCDate(target.getUTCDate() + 1);
  return target.getTime() - nowMs;
}

/** Format ms as countdown string */
function formatCountdown(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/** Get the session relevance for a specific instrument */
export function getSessionRelevance(instrumentId: string): SessionRelevance {
  const now = new Date();
  const hourUTC = now.getUTCHours();
  const optimalSessions = INSTRUMENT_SESSIONS[instrumentId] || [];

  // Check if this instrument's market is open at all
  const marketOpen = isMarketOpen(instrumentId, now);

  if (!marketOpen) {
    const isCrypto = CRYPTO_INSTRUMENTS.has(instrumentId);
    return {
      instrumentId,
      optimalSessions,
      currentSessionActive: false,
      isOptimalNow: false,
      isOverlap: false,
      activeSessions: [],
      nextOptimalIn: isCrypto ? "Active now" : getTimeUntilMarketOpen(now),
      nextEventLabel: "Market opens",
      nextEventCountdownMs: 0,
      sessionScore: 0,
      reason: isUSHoliday(now) && US_INDEX_INSTRUMENTS.has(instrumentId)
        ? "US market holiday"
        : "Markets closed (weekend)",
    };
  }

  // Use DST-aware UTC hours for accurate session detection
  const activeSessionKeys = optimalSessions.filter((sessionKey) => {
    const dstHours = getSessionUTCHours(sessionKey);
    return isSessionActive(dstHours, hourUTC, now);
  });

  const isOptimalNow = activeSessionKeys.length > 0;
  const isOverlap = activeSessionKeys.length >= 2;

  let sessionScore: number;
  if (isOverlap) {
    sessionScore = 100;
  } else if (isOptimalNow) {
    sessionScore = 75;
  } else {
    const anyActive = Object.keys(TRADING_SESSIONS).some((key) => {
      const dstHours = getSessionUTCHours(key);
      return isSessionActive(dstHours, hourUTC, now);
    });
    sessionScore = anyActive ? 40 : 15;
  }

  // Compute next event label + countdown
  let nextEventLabel = "";
  let nextEventCountdownMs = 0;
  let nextOptimalIn = "Active now";

  if (isOverlap) {
    // Find when the overlap ends (earliest close among active sessions)
    let earliestCloseMs = Infinity;
    let closingSession = "";
    for (const key of activeSessionKeys) {
      const dstHours = getSessionUTCHours(key);
      const ms = getMsUntilHour(dstHours.closeHourUTC, now);
      if (ms < earliestCloseMs) {
        earliestCloseMs = ms;
        closingSession = key;
      }
    }
    nextEventLabel = `${SESSION_NAMES[closingSession] || closingSession} closes`;
    nextEventCountdownMs = earliestCloseMs;
  } else if (isOptimalNow) {
    // Single session active — find next session to open (overlap) or when this closes
    const inactiveSessions = optimalSessions.filter((k) => !activeSessionKeys.includes(k));
    if (inactiveSessions.length > 0) {
      // Next optimal event is the next session opening (overlap start)
      let soonestMs = Infinity;
      let soonestKey = "";
      for (const key of inactiveSessions) {
        const dstHours = getSessionUTCHours(key);
        const ms = getMsUntilHour(dstHours.openHourUTC, now);
        if (ms < soonestMs) {
          soonestMs = ms;
          soonestKey = key;
        }
      }
      nextEventLabel = `${SESSION_NAMES[soonestKey] || soonestKey} opens`;
      nextEventCountdownMs = soonestMs;
    } else {
      // Only one optimal session and it's active — show when it closes
      const dstHours = getSessionUTCHours(activeSessionKeys[0]);
      nextEventCountdownMs = getMsUntilHour(dstHours.closeHourUTC, now);
      nextEventLabel = `${SESSION_NAMES[activeSessionKeys[0]] || activeSessionKeys[0]} closes`;
    }
  } else {
    // No optimal sessions active — find soonest one to open
    let soonestMs = Infinity;
    let soonestKey = "";
    for (const key of optimalSessions) {
      const dstHours = getSessionUTCHours(key);
      const ms = getMsUntilHour(dstHours.openHourUTC, now);
      if (ms < soonestMs) {
        soonestMs = ms;
        soonestKey = key;
      }
    }
    nextOptimalIn = formatCountdown(soonestMs);
    nextEventLabel = `${SESSION_NAMES[soonestKey] || soonestKey} opens`;
    nextEventCountdownMs = soonestMs;
  }

  return {
    instrumentId,
    optimalSessions,
    currentSessionActive: isOptimalNow,
    isOptimalNow,
    isOverlap,
    activeSessions: activeSessionKeys,
    nextOptimalIn,
    nextEventLabel,
    nextEventCountdownMs,
    sessionScore,
    reason: SESSION_REASONS[instrumentId] || "Check market hours",
  };
}

/** Get session relevance for all instruments */
export function getAllSessionRelevances(): Record<string, SessionRelevance> {
  const result: Record<string, SessionRelevance> = {};
  for (const id of Object.keys(INSTRUMENT_SESSIONS)) {
    result[id] = getSessionRelevance(id);
  }
  return result;
}

/** Get a confidence modifier based on session score */
export function getSessionConfidenceModifier(sessionScore: number): number {
  if (sessionScore >= 75) return 1.0;
  if (sessionScore >= 40) return 0.95;
  return 0.85;
}
