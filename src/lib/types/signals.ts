// ==================== Market Regime ====================

export type MarketRegime = "trending_up" | "trending_down" | "ranging" | "volatile";

export type ImpulseColor = "green" | "red" | "blue";

export type ConvictionTier = "A+" | "A" | "B" | "C" | "D";

export type TradingStyle = "intraday" | "swing";

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
  tradingStyle: TradingStyle;
  timeframe: "1h" | "4h";
  impulse: ImpulseColor;
  signals: MechanicalSignal[];
  conviction: ConvictionTier;
  convictionScore: number; // 0-100
  direction: "bullish" | "bearish" | "neutral";
  consensus: { bullish: number; bearish: number; neutral: number };
  currentPrice: number;
  atr: number;
  entry: [number, number];
  stopLoss: number;
  takeProfit: [number, number, number];
  riskReward: [number, number, number];
  positionSizeLots: number;
  riskAmount: number;
  reasonsToExit: string[];
  learningApplied?: {
    riskMultiplier: number;
    convictionAdjust: number;
    winRate: number;
    trades: number;
  };
}

// ==================== Setup Lifecycle ====================

export type SetupStatus =
  | "pending"      // Price hasn't entered entry zone yet
  | "active"       // Price entered the entry zone
  | "breakeven"    // Price moved 1 ATR in direction (SL moved to entry)
  | "tp1_hit"      // TP1 reached
  | "tp2_hit"      // TP2 reached
  | "tp3_hit"      // TP3 reached (full win)
  | "sl_hit"       // Stop loss hit
  | "expired"      // Setup exceeded style-specific expiry (8h intraday, 24h swing) without entry
  | "invalidated"; // Conviction dropped below A, impulse conflict, or direction flipped

export type SetupOutcome = "win" | "loss" | "breakeven";

export const TERMINAL_STATUSES: SetupStatus[] = [
  "tp1_hit", "tp2_hit", "tp3_hit", "sl_hit", "expired", "invalidated",
];

export interface TrackedSetup {
  id: string;
  setup: TradeDeskSetup;
  status: SetupStatus;
  createdAt: number;
  activatedAt: number | null;
  closedAt: number | null;
  outcome: SetupOutcome | null;
  pnlPercent: number | null;
  highestTpHit: 0 | 1 | 2 | 3;
  confluenceKey: string;
}

// ==================== Confluence Learning ====================

export interface ConfluencePattern {
  key: string;
  trades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  avgPnlPercent: number;
  riskMultiplier: number;
  convictionAdjust: number;
  lastUpdated: number;
}

// ==================== Risk Management ====================

export type RiskStatus = "CLEAR" | "CAUTION" | "STOP";

export interface RiskConfig {
  maxDailyLossPercent: number;   // e.g. 5
  maxWeeklyLossPercent: number;  // e.g. 10
  maxOpenPositions: number;      // e.g. 5
  maxPortfolioHeat: number;      // e.g. 6 (%)
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxDailyLossPercent: 5,
  maxWeeklyLossPercent: 10,
  maxOpenPositions: 5,
  maxPortfolioHeat: 6,
};

// ==================== Portfolio Risk ====================

export interface PortfolioRisk {
  accountEquity: number;
  riskPerTrade: number; // 2% of equity
  riskPercent: number;
  portfolioHeat: number; // % of equity at risk across all open
  canTrade: boolean;
  warning: string | null;
  // Extended risk fields
  riskStatus?: RiskStatus;
  dailyPnl?: number;
  dailyPnlPercent?: number;
  weeklyPnl?: number;
  weeklyPnlPercent?: number;
  openPositions?: number;
  warnings?: string[];
}
