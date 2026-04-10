import type {
  TrackedSetup,
  MechanicalSignal,
  ScaleInOpportunity,
} from "@/lib/types/signals";
import { isRunning } from "./setup-tracker";

const MAX_SCALE_INS = 2;
const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes between detections
const MIN_PULLBACK = 0.3;
const MAX_PULLBACK = 0.7;
const MIN_AGREEING_SIGNALS = 3;
const MIN_RR = 1.5;
const SCALE_IN_SIZE_RATIO = 0.5; // 50% of original position

/**
 * Detect a scale-in opportunity on a running trade.
 * Returns null if no opportunity, otherwise a ScaleInOpportunity.
 */
export function detectScaleIn(
  tracked: TrackedSetup,
  signals: MechanicalSignal[]
): ScaleInOpportunity | null {
  // Must be running
  if (!isRunning(tracked.status)) return null;

  // Max 2 scale-ins per core trade
  const activeScaleIns = tracked.scaleIns.filter((s) => !s.dismissed);
  if (activeScaleIns.length >= MAX_SCALE_INS) return null;

  // Cooldown check
  const lastDetected = tracked.scaleIns[tracked.scaleIns.length - 1]?.detectedAt ?? 0;
  if (Date.now() - lastDetected < COOLDOWN_MS) return null;

  const { setup, peakPrice } = tracked;
  const isBullish = setup.direction === "bullish";
  const entryMid = (setup.entry[0] + setup.entry[1]) / 2;
  const price = setup.currentPrice;

  // Determine peak and pullback reference
  const referenceHigh = peakPrice ?? entryMid;
  const moveSize = Math.abs(referenceHigh - entryMid);
  if (moveSize === 0) return null;

  // Calculate pullback: how much price has retraced from peak toward entry
  const pullback = isBullish
    ? (referenceHigh - price) / moveSize
    : (price - referenceHigh) / moveSize;

  // Must be in the sweet spot (30-70% retracement)
  if (pullback < MIN_PULLBACK || pullback > MAX_PULLBACK) return null;

  // Count agreeing signals
  const agreeingSignals = signals.filter(
    (s) => s.direction === setup.direction
  ).length;
  if (agreeingSignals < MIN_AGREEING_SIGNALS) return null;

  // Determine next TP level
  const nextTPIndex = Math.min(tracked.highestTpHit, 2) as 0 | 1 | 2;
  const targetTP = setup.takeProfit[nextTPIndex];

  // Calculate R:R for the scale-in
  const scaleInEntry = price;
  const scaleSL = entryMid; // Breakeven stop
  const slDist = Math.abs(scaleInEntry - scaleSL);
  if (slDist === 0) return null;
  const tpDist = Math.abs(targetTP - scaleInEntry);
  const riskReward = Number((tpDist / slDist).toFixed(1));

  if (riskReward < MIN_RR) return null;

  // Build entry zone (tight: ±0.25 ATR around current price)
  const halfZone = setup.atr * 0.25;
  const suggestedEntry: [number, number] = isBullish
    ? [price - halfZone, price + halfZone]
    : [price - halfZone, price + halfZone];

  return {
    detectedAt: Date.now(),
    pullbackPercent: Number((pullback * 100).toFixed(1)),
    suggestedEntry,
    targetTP,
    riskReward,
    agreeingSignals,
    dismissed: false,
  };
}

/**
 * Detect if a setup was a missed entry.
 * A setup is "missed" if it jumped from pending directly past active
 * (price ran > 1 ATR from entry before the user could act).
 */
export function detectMissedEntry(tracked: TrackedSetup): boolean {
  // Only check once on activation
  if (tracked.missedEntry) return true;

  const { setup, status, activatedAt, createdAt } = tracked;
  if (status === "pending") return false;

  // If setup was activated and immediately went to breakeven or beyond
  // within a very short window, it was likely missed
  const entryMid = (setup.entry[0] + setup.entry[1]) / 2;
  const isBullish = setup.direction === "bullish";
  const priceDist = isBullish
    ? setup.currentPrice - entryMid
    : entryMid - setup.currentPrice;

  // Price moved > 1 ATR from entry and activation was near-instant
  if (priceDist > setup.atr) {
    const activationDelay = (activatedAt ?? Date.now()) - createdAt;
    // If activated within 5 minutes of creation and price already ran, it was missed
    if (activationDelay < 5 * 60 * 1000) return true;
  }

  return false;
}

/** Position size for scale-in: 50% of original */
export function getScaleInSize(originalLots: number): number {
  return Number((originalLots * SCALE_IN_SIZE_RATIO).toFixed(2));
}
