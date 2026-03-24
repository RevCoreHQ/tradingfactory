// ==================== NO-TRADE ENGINE ====================
// Mechanical blackout conditions that prevent or reduce trading.
// Hard blocks: canTrade = false (no setup generated)
// Soft blocks: positionMultiplier < 1.0 (reduced sizing, stack to floor of 0.25)

import type { FullRegime } from "@/lib/types/signals";

export interface NoTradeResult {
  canTrade: boolean;
  reasons: string[];
  severity: "none" | "soft" | "hard";
  positionMultiplier: number; // 1.0 = no reduction, 0.25 = floor
}

// ==================== EVENT RISK BLACKOUT ====================

/**
 * High-impact economic event blackout windows.
 * These events cause extreme volatility spikes that invalidate technical setups.
 * Hard block: ±30 min around event time
 * Soft block: 2 hours before event
 *
 * Event schedule is rule-based (recurring calendar patterns).
 * NFP: first Friday of month, 13:30 UTC
 * FOMC: 8 meetings/year, 18:00 UTC (announcement), 18:30 (press conf)
 * CPI: ~10th-15th of month, 12:30 UTC
 * ECB: 8 meetings/year, 12:15 UTC
 */
interface EventWindow {
  name: string;
  isHardBlock: boolean; // true = within ±30 min of event
  isSoftBlock: boolean; // true = within 2 hours before event
}

// FOMC meeting dates (approximate — 8 per year, fixed schedule)
// These are announced a year in advance. Using typical month+week pattern.
const FOMC_MONTHS = [1, 3, 5, 6, 7, 9, 11, 12]; // Months with FOMC meetings
const FOMC_HOUR_UTC = 18; // 2:00 PM ET = 18:00 UTC (19:00 during DST)
const ECB_HOUR_UTC = 12; // ECB rate decisions at 12:15 UTC

/**
 * Check if current time falls within a high-impact event blackout window.
 * Returns the most restrictive event window found.
 */
export function checkEventRiskBlackout(now?: Date): EventWindow | null {
  const d = now ?? new Date();
  const utcHour = d.getUTCHours();
  const utcMinute = d.getUTCMinutes();
  const utcDay = d.getUTCDate();
  const utcDayOfWeek = d.getUTCDay(); // 0=Sun, 5=Fri
  const utcMonth = d.getUTCMonth() + 1;
  const minuteOfDay = utcHour * 60 + utcMinute;

  const events: { name: string; minuteOfDay: number }[] = [];

  // NFP: first Friday of month, 13:30 UTC (8:30 AM ET)
  if (utcDayOfWeek === 5 && utcDay <= 7) {
    events.push({ name: "NFP (Non-Farm Payrolls)", minuteOfDay: 13 * 60 + 30 });
  }

  // CPI: typically 12th-14th of month, 12:30 UTC
  if (utcDay >= 10 && utcDay <= 15) {
    events.push({ name: "CPI Release", minuteOfDay: 12 * 60 + 30 });
  }

  // FOMC: specific months, 18:00 UTC
  if (FOMC_MONTHS.includes(utcMonth)) {
    // FOMC is typically on a Wednesday in the 3rd or 4th week
    if (utcDayOfWeek === 3 && utcDay >= 15 && utcDay <= 28) {
      events.push({ name: "FOMC Rate Decision", minuteOfDay: FOMC_HOUR_UTC * 60 });
    }
  }

  // ECB: every 6 weeks roughly, on Thursdays at 12:15 UTC
  if (utcDayOfWeek === 4 && [1, 3, 4, 6, 7, 9, 10, 12].includes(utcMonth) && utcDay >= 8 && utcDay <= 22) {
    events.push({ name: "ECB Rate Decision", minuteOfDay: ECB_HOUR_UTC * 60 + 15 });
  }

  // Check each event for proximity
  for (const event of events) {
    const diff = minuteOfDay - event.minuteOfDay;
    if (diff >= -30 && diff <= 30) {
      return { name: event.name, isHardBlock: true, isSoftBlock: false };
    }
    if (diff >= -120 && diff < -30) {
      return { name: event.name, isHardBlock: false, isSoftBlock: true };
    }
  }

  return null;
}

// ==================== MAIN FUNCTION ====================

/**
 * Evaluate whether trading conditions are acceptable.
 * Called after regime detection but before signal generation.
 *
 * Hard blocks (canTrade = false):
 *   - Dead market: sessionScore < 15
 *   - Stale data: dataQuality warnings flagged
 *   - Volatile reversal: reversal phase + atrPercentile > 80
 *   - Event risk: within ±30 min of high-impact event (NFP, FOMC, CPI, ECB)
 *
 * Soft blocks (positionMultiplier = 0.5, stacking):
 *   - Off-peak: sessionScore 15-39
 *   - Tight chop: accumulation + bbWidthPercentile < 20
 *   - Tangled structure: structureScore near 0 (-15 to +15)
 *   - Pre-event: 2 hours before high-impact event
 *
 * Multiple soft blocks stack multiplicatively: 2 soft = 0.25, floor at 0.25.
 */
export function evaluateNoTrade(
  sessionScore: number,
  fullRegime?: FullRegime,
  structureScore?: number,
  isDataStale?: boolean,
): NoTradeResult {
  const reasons: string[] = [];
  let positionMultiplier = 1.0;
  let hasHardBlock = false;

  // ── Hard Blocks ──

  if (sessionScore < 15) {
    reasons.push(`Dead market (session score ${sessionScore} < 15) — no liquidity`);
    hasHardBlock = true;
  }

  if (isDataStale) {
    reasons.push("Stale data detected — signals unreliable");
    hasHardBlock = true;
  }

  if (fullRegime && fullRegime.phase === "reversal" && fullRegime.atrPercentile > 80) {
    reasons.push(`Volatile reversal (${fullRegime.phase} phase + ATR percentile ${fullRegime.atrPercentile.toFixed(0)}%) — whipsaw risk extreme`);
    hasHardBlock = true;
  }

  // Event risk blackout (live trading only — date-based check)
  const eventWindow = checkEventRiskBlackout();
  if (eventWindow?.isHardBlock) {
    reasons.push(`Event risk blackout: ${eventWindow.name} — within ±30 min of release`);
    hasHardBlock = true;
  }

  if (hasHardBlock) {
    return {
      canTrade: false,
      reasons,
      severity: "hard",
      positionMultiplier: 0,
    };
  }

  // ── Soft Blocks (stack multiplicatively, floor at 0.25) ──

  if (eventWindow?.isSoftBlock) {
    reasons.push(`Pre-event caution: ${eventWindow.name} — within 2 hours of release`);
    positionMultiplier *= 0.5;
  }

  if (sessionScore >= 15 && sessionScore < 40) {
    reasons.push(`Off-peak session (score ${sessionScore}) — wider spreads, reduced size`);
    positionMultiplier *= 0.5;
  }

  if (
    fullRegime &&
    fullRegime.phase === "accumulation" &&
    fullRegime.bbWidthPercentile < 20
  ) {
    reasons.push(`Tight accumulation chop (BB width percentile ${fullRegime.bbWidthPercentile.toFixed(0)}%) — low vol squeeze`);
    positionMultiplier *= 0.5;
  }

  if (structureScore !== undefined && Math.abs(structureScore) <= 15) {
    reasons.push(`Tangled market structure (score ${structureScore}) — no clear direction`);
    positionMultiplier *= 0.5;
  }

  // Floor at 0.25
  positionMultiplier = Math.max(0.25, positionMultiplier);

  const severity = reasons.length > 0 ? "soft" : "none";

  return {
    canTrade: true,
    reasons,
    severity,
    positionMultiplier: Number(positionMultiplier.toFixed(2)),
  };
}
