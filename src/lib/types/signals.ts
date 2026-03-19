// ==================== Market Regime ====================

export type MarketRegime = "trending_up" | "trending_down" | "ranging" | "volatile";

export type ImpulseColor = "green" | "red" | "blue";

export type ConvictionTier = "A+" | "A" | "B" | "C" | "D";

// ==================== Mechanical Signal ====================

export interface MechanicalSignal {
  system: string; // e.g. "MA Crossover", "MACD", "BB Breakout", "RSI Extremes", "Elder Impulse"
  type: "trend" | "mean_reversion" | "momentum" | "reversal";
  direction: "bullish" | "bearish" | "neutral";
  strength: number; // 0-100
  description: string;
  regimeMatch: boolean; // Does signal match current regime?
}

// ==================== Trade Desk Setup ====================

export interface TradeDeskSetup {
  instrumentId: string;
  displayName: string;
  symbol: string;
  category: string;
  regime: MarketRegime;
  regimeLabel: string;
  adx: number;
  impulse: ImpulseColor;
  signals: MechanicalSignal[];
  conviction: ConvictionTier;
  convictionScore: number; // 0-100
  direction: "bullish" | "bearish" | "neutral";
  consensus: { bullish: number; bearish: number; neutral: number };
  currentPrice: number;
  entry: [number, number];
  stopLoss: number;
  takeProfit: [number, number, number];
  riskReward: [number, number, number];
  positionSizeLots: number;
  riskAmount: number;
  reasonsToExit: string[];
}

// ==================== Portfolio Risk ====================

export interface PortfolioRisk {
  accountEquity: number;
  riskPerTrade: number; // 2% of equity
  riskPercent: number;
  portfolioHeat: number; // % of equity at risk across all open
  canTrade: boolean;
  warning: string | null;
}
