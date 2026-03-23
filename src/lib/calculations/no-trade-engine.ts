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

/**
 * Evaluate whether trading conditions are acceptable.
 * Called after regime detection but before signal generation.
 *
 * Hard blocks (canTrade = false):
 *   - Dead market: sessionScore < 15
 *   - Stale data: dataQuality warnings flagged
 *   - Volatile reversal: reversal phase + atrPercentile > 80
 *
 * Soft blocks (positionMultiplier = 0.5, stacking):
 *   - Off-peak: sessionScore 15-39
 *   - Tight chop: accumulation + bbWidthPercentile < 20
 *   - Tangled structure: structureScore near 0 (-15 to +15)
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

  if (hasHardBlock) {
    return {
      canTrade: false,
      reasons,
      severity: "hard",
      positionMultiplier: 0,
    };
  }

  // ── Soft Blocks (stack multiplicatively, floor at 0.25) ──

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
