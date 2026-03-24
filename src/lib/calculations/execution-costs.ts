// ==================== EXECUTION COST MODEL ====================
// Spread + slippage modeling for realistic position sizing and R:R calculation.
// Slippage scales with volatility (ATR percentile).

// Per-instrument typical spread in native pips
export const SPREAD_TABLE: Record<string, number> = {
  EUR_USD: 1.2,
  GBP_USD: 1.5,
  AUD_USD: 1.3,
  NZD_USD: 1.8,
  USD_JPY: 1.0,
  USD_CAD: 1.5,
  USD_CHF: 1.5,
  XAU_USD: 3.0,
  XAG_USD: 3.0,
  BTC_USD: 15.0,
  ETH_USD: 1.5,
  US100: 1.5,
};

export interface ExecutionCost {
  spreadPips: number;
  spreadPrice: number;
  slippagePips: number;
  slippagePrice: number;
  totalCostPips: number;
  totalCostPrice: number;
}

// ==================== SESSION + EVENT MULTIPLIERS ====================

/**
 * Session-aware spread multiplier.
 * During overlap sessions (London-NY), spreads are tightest.
 * During dead hours (e.g. late NY after London close), spreads widen 2x.
 */
export function getSessionSpreadMultiplier(sessionScore: number): number {
  if (sessionScore >= 75) return 1.0;   // overlap — tightest spreads
  if (sessionScore >= 40) return 1.2;   // single session
  if (sessionScore >= 15) return 1.5;   // off-peak
  return 2.0;                            // dead market
}

/**
 * Event risk spread multiplier.
 * High-impact events (CPI, NFP, rate decisions) cause spread widening
 * as market makers pull liquidity before the release.
 */
export function getEventRiskMultiplier(
  eventRiskActive: boolean,
  hoursUntilEvent?: number,
): number {
  if (!eventRiskActive) return 1.0;
  if (hoursUntilEvent !== undefined && hoursUntilEvent <= 2) return 2.5;
  if (hoursUntilEvent !== undefined && hoursUntilEvent <= 6) return 1.5;
  return 1.0;
}

/**
 * Calculate execution cost for an instrument.
 * Slippage model: basePips * (1 + atrPercentile/100 * 0.5)
 * Higher volatility = wider spreads and more slippage.
 * Session and event multipliers scale the base spread before slippage.
 */
export function calculateExecutionCost(
  instrumentId: string,
  pipSize: number,
  atrPercentile: number = 50,
  sessionScore: number = 75,
  eventRiskActive: boolean = false,
  hoursUntilEvent?: number,
): ExecutionCost {
  const rawPips = SPREAD_TABLE[instrumentId] ?? 2.0;

  // Apply session + event multipliers to base spread
  const sessionMult = getSessionSpreadMultiplier(sessionScore);
  const eventMult = getEventRiskMultiplier(eventRiskActive, hoursUntilEvent);
  const basePips = rawPips * sessionMult * eventMult;

  const spreadPrice = basePips * pipSize;

  const slippagePips = basePips * (1 + (atrPercentile / 100) * 0.5);
  const slippagePrice = slippagePips * pipSize;

  return {
    spreadPips: Number(basePips.toFixed(2)),
    spreadPrice,
    slippagePips: Number(slippagePips.toFixed(2)),
    slippagePrice,
    totalCostPips: Number((basePips + slippagePips).toFixed(2)),
    totalCostPrice: spreadPrice + slippagePrice,
  };
}

/**
 * Widen stop loss by total execution cost to reflect real fills.
 */
export function adjustStopLossForSpread(
  stopLoss: number,
  direction: "bullish" | "bearish" | "neutral",
  totalCostPrice: number,
): number {
  if (direction === "neutral") return stopLoss;
  return direction === "bullish"
    ? stopLoss - totalCostPrice
    : stopLoss + totalCostPrice;
}

/**
 * Recalculate R:R after execution cost widens the effective SL.
 */
export function adjustRiskReward(
  entryMid: number,
  stopLoss: number,
  takeProfit: [number, number, number],
  totalCostPrice: number,
  direction: "bullish" | "bearish" | "neutral",
): [number, number, number] {
  const effectiveSL = adjustStopLossForSpread(stopLoss, direction, totalCostPrice);
  const slDist = Math.abs(entryMid - effectiveSL);

  if (slDist <= 0) return [1.5, 2.5, 3.5];

  return [
    Number((Math.abs(takeProfit[0] - entryMid) / slDist).toFixed(1)),
    Number((Math.abs(takeProfit[1] - entryMid) / slDist).toFixed(1)),
    Number((Math.abs(takeProfit[2] - entryMid) / slDist).toFixed(1)),
  ];
}
