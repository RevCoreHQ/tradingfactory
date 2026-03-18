import { TRADING_SESSIONS } from "@/lib/utils/constants";
import type { TradingSession } from "@/lib/types/market";

export interface SessionRelevance {
  instrumentId: string;
  optimalSessions: TradingSession[];
  currentSessionActive: boolean;
  isOptimalNow: boolean;
  nextOptimalIn: string;
  sessionScore: number; // 0-100
  reason: string;
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
  US30: ["newyork"],
  SPX500: ["newyork"],
  US2000: ["newyork"],
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
  US30: "US market hours only",
  SPX500: "US market hours only",
  US2000: "US market hours only",
};

/** Check if a session is currently active */
export function isSessionActive(
  session: { openHourUTC: number; closeHourUTC: number },
  hourUTC: number
): boolean {
  if (session.openHourUTC < session.closeHourUTC) {
    return hourUTC >= session.openHourUTC && hourUTC < session.closeHourUTC;
  }
  return hourUTC >= session.openHourUTC || hourUTC < session.closeHourUTC;
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

/** Get the session relevance for a specific instrument */
export function getSessionRelevance(instrumentId: string): SessionRelevance {
  const now = new Date();
  const hourUTC = now.getUTCHours();
  const minUTC = now.getUTCMinutes();
  const optimalSessions = INSTRUMENT_SESSIONS[instrumentId] || [];

  const activeSessions = optimalSessions.filter((sessionKey) => {
    const session = TRADING_SESSIONS[sessionKey];
    return session && isSessionActive(session, hourUTC);
  });

  const isOptimalNow = activeSessions.length > 0;
  const isOverlap = activeSessions.length >= 2;

  // Calculate session score
  let sessionScore: number;
  if (isOverlap) {
    sessionScore = 100;
  } else if (isOptimalNow) {
    sessionScore = 75;
  } else {
    // Check if ANY session is active (even non-optimal)
    const anyActive = Object.values(TRADING_SESSIONS).some((s) =>
      isSessionActive(s, hourUTC)
    );
    sessionScore = anyActive ? 40 : 15;
  }

  // Find next optimal session opening
  let nextOptimalIn = "Active now";
  if (!isOptimalNow && optimalSessions.length > 0) {
    const times = optimalSessions.map((key) => {
      const session = TRADING_SESSIONS[key];
      return session ? getTimeUntil(session.openHourUTC, hourUTC, minUTC) : "—";
    });
    nextOptimalIn = times[0] || "—";
  }

  return {
    instrumentId,
    optimalSessions,
    currentSessionActive: isOptimalNow,
    isOptimalNow,
    nextOptimalIn,
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
