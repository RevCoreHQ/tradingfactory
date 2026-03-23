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
  USOIL: 3.0,
  BTC_USD: 15.0,
  ETH_USD: 1.5,
  US100: 1.5,
  US30: 3.0,
  SPX500: 0.5,
  US2000: 0.3,
};

export interface ExecutionCost {
  spreadPips: number;
  spreadPrice: number;
  slippagePips: number;
  slippagePrice: number;
  totalCostPips: number;
  totalCostPrice: number;
}

/**
 * Calculate execution cost for an instrument.
 * Slippage model: basePips * (1 + atrPercentile/100 * 0.5)
 * Higher volatility = wider spreads and more slippage.
 */
export function calculateExecutionCost(
  instrumentId: string,
  pipSize: number,
  atrPercentile: number = 50,
): ExecutionCost {
  const basePips = SPREAD_TABLE[instrumentId] ?? 2.0;
  const spreadPrice = basePips * pipSize;

  const slippagePips = basePips * (1 + (atrPercentile / 100) * 0.5);
  const slippagePrice = slippagePips * pipSize;

  return {
    spreadPips: basePips,
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
