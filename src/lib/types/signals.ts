import type { MTFTrendSummary } from "./mtf";

// ==================== Market Regime ====================

export type MarketRegime = "trending_up" | "trending_down" | "ranging" | "volatile";

export type ImpulseColor = "green" | "red" | "blue";

export type ConvictionTier = "A+" | "A" | "B" | "C" | "D";

export type TradingStyle = "intraday" | "swing";

// ==================== Full Regime (v2) ====================

export type VolatilityRegime = "low" | "normal" | "high";
export type StructureRegime = "trend" | "range" | "breakout";
export type MarketPhase = "accumulation" | "expansion" | "distribution" | "reversal";

export interface PhaseTransition {
  from: MarketPhase;
  to: MarketPhase;
  /** True when the transition represents a directional opportunity */
  isActionable: boolean;
}

export interface FullRegime {
  /** Backward-compatible legacy regime derived from structure + volatility */
  legacy: MarketRegime;
  /** ATR(14) percentile vs 100-bar rolling window */
  volatility: VolatilityRegime;
  /** ADX + EMA slope + BB width classification */
  structure: StructureRegime;
  /** Wyckoff-inspired phase: ADX direction + price vs EMA50 */
  phase: MarketPhase;
  /** 0-100: ATR(14) rank within rolling window */
  atrPercentile: number;
  /** Normalized rate of change of EMA(21) */
  emaSlope: number;
  /** 0-100: current BB width vs historical BB width */
  bbWidthPercentile: number;
  /** Raw ADX value (still computed, now one input among many) */
  adx: number;
  /** ADX direction over recent bars */
  adxTrend: "rising" | "falling" | "flat";
  /** Human-readable description */
  label: string;
  /** Phase transition detected when previous phase differs from current */
  phaseTransition?: PhaseTransition;
}

// ==================== Market Structure ====================

export type SwingType = "HH" | "HL" | "LH" | "LL";
export type StructureBreak = "BOS" | "CHoCH";

export interface SwingPoint {
  price: number;
  timestamp: number;
  type: "high" | "low";
  classification: SwingType;
  index: number;
}

export interface StructureEvent {
  type: StructureBreak;
  direction: "bullish" | "bearish";
  price: number;
  timestamp: number;
  swingBroken: SwingPoint;
}

export interface MarketStructure {
  swingPoints: SwingPoint[];
  latestStructure: "bullish" | "bearish" | "neutral";
  events: StructureEvent[];
  lastBOS: StructureEvent | null;
  lastCHoCH: StructureEvent | null;
  /** -100 (strong bearish) to +100 (strong bullish) */
  structureScore: number;
}

// ==================== Mechanical Signal ====================

export interface MechanicalSignal {
  system: string; // e.g. "MA Crossover", "MACD", "BB Breakout", "RSI Extremes", "Elder Impulse"
  type: "trend" | "mean_reversion" | "momentum" | "reversal" | "volume";
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
  mtfTrend?: MTFTrendSummary;
  fullRegime?: FullRegime;
  marketStructure?: MarketStructure;
  learningApplied?: {
    riskMultiplier: number;
    convictionAdjust: number;
    winRate: number;
    trades: number;
  };
  portfolioGate?: import("@/lib/calculations/portfolio-risk-gate").PortfolioRiskGate;
  entryOptimization?: import("@/lib/calculations/entry-optimization").EntryOptimization;
  ictContext?: {
    nearestFVG: { type: "bullish" | "bearish"; midpoint: number; freshness: string } | null;
    nearestOB: { type: "supply" | "demand"; high: number; low: number; strength: number } | null;
    displacementDetected: boolean;
    consolidationBreakout: boolean;
    ictScore: number; // 0-100
    sfpDetected: { direction: "bullish" | "bearish"; strength: number; description: string } | null;
    idfDetected: { direction: "bullish" | "bearish"; strength: number; structureBreakConfirmed: boolean } | null;
    obRetestDetected: { direction: "bullish" | "bearish"; strength: number; zone: { type: "supply" | "demand"; high: number; low: number; strength: number } } | null;
  };
  executionCost?: {
    spreadPips: number;
    slippagePips: number;
    totalCostPips: number;
  };
  volatilityTarget?: {
    currentVol: number;
    multiplier: number;
  };
  dataQualityWarnings?: string[];
  noTradeResult?: import("@/lib/calculations/no-trade-engine").NoTradeResult;
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
  "tp3_hit", "sl_hit", "expired", "invalidated",
];

/** Setup is running in profit (past breakeven, TP progression underway) */
export function isRunning(status: SetupStatus): boolean {
  return status === "breakeven" || status === "tp1_hit" || status === "tp2_hit";
}

export interface StatusTimelineEntry {
  status: SetupStatus;
  timestamp: number;
  price: number;
}

export interface ScaleInOpportunity {
  detectedAt: number;
  pullbackPercent: number;       // how much of the move retraced (30-70%)
  suggestedEntry: [number, number];
  targetTP: number;              // next TP level price
  riskReward: number;
  agreeingSignals: number;
  dismissed: boolean;
}

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
  // Core trade management fields
  scaleIns: ScaleInOpportunity[];
  peakPrice: number | null;
  timeline: StatusTimelineEntry[];
  missedEntry: boolean;
  /** Whether the entry zone was refined by entry-optimization */
  entryRefined?: boolean;
  /** Type of refinement applied (e.g. "engulfing", "fvg_reentry", "pullback_to_ema") */
  refinementType?: string | null;
  /** Projected entry price (mid of entry zone at setup creation) */
  projectedEntry?: number;
  /** Actual entry price when status transitioned to "active" */
  actualEntry?: number | null;
  /** Slippage in pips between projected and actual entry */
  slippagePips?: number | null;
  /** Spread cost in pips from execution cost model */
  spreadCostPips?: number | null;
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
  // Expectancy model fields (v2)
  avgWinR?: number;
  avgLossR?: number;
  maxDrawdownR?: number;
  expectancy?: number;
  kellyFraction?: number;
  tradeHistory?: Array<{
    timestamp: number;
    outcome: "win" | "loss" | "breakeven";
    pnlPercent: number;
    rMultiple: number;
  }>;
  decayedWinRate?: number;
  instrument?: string;
  regime?: string;
}

// ==================== Risk Management ====================

export type RiskStatus = "CLEAR" | "CAUTION" | "STOP";

export interface RiskConfig {
  maxOpenPositions: number;      // e.g. 5
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  maxOpenPositions: 5,
};

// ==================== Portfolio Risk ====================

export interface PortfolioRisk {
  riskPercent: number;
  canTrade: boolean;
  warning: string | null;
  riskStatus?: RiskStatus;
  openPositions?: number;
  warnings?: string[];
}
