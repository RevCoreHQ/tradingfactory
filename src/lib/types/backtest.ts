import type { TradeDeskSetup, ConvictionTier, MarketRegime, TradingStyle, ImpulseColor } from "./signals";

// ==================== Backtest Configuration ====================

export interface BacktestConfig {
  instrumentId: string;
  timeframe: "1h" | "4h";
  windowSize: number;          // candles per window (e.g., 200)
  stepSize: number;            // candles to advance per step (1 = walk-forward)
  accountEquity: number;       // starting equity
  riskPercent: number;         // per-trade risk %
  tradingStyle: TradingStyle;
  minConviction: ConvictionTier | null; // null = use production default (A)
  minRiskReward: number | null;         // null = use production default (1.5)
  enforceImpulseGate: boolean;
  maxConcurrentTrades: number;
  // Optional parameter overrides (from auto-improvement)
  overrides?: {
    slMultiplier?: number;
    tpMultipliers?: [number, number, number];
    entrySpreadMultiplier?: number;
  };
}

export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  instrumentId: "EUR_USD",
  timeframe: "4h",
  windowSize: 200,
  stepSize: 1,
  accountEquity: 0,
  riskPercent: 2,
  tradingStyle: "swing",
  minConviction: null,
  minRiskReward: null,
  enforceImpulseGate: true,
  maxConcurrentTrades: 1,
};

// ==================== Backtest Trade ====================

export interface BacktestTrade {
  id: string;
  instrumentId: string;
  setup: TradeDeskSetup;
  // Timing
  signalBarIndex: number;
  signalTimestamp: number;
  entryBarIndex: number | null;
  entryTimestamp: number | null;
  entryPrice: number | null;
  exitBarIndex: number | null;
  exitTimestamp: number | null;
  exitPrice: number | null;
  // Outcome
  outcome: "win" | "loss" | "breakeven" | "expired" | "still_open";
  highestTpHit: 0 | 1 | 2 | 3;
  pnlPercent: number;
  rMultiple: number;
  barsInTrade: number;
  // Setup metadata for slicing
  conviction: ConvictionTier;
  convictionScore: number;
  regime: MarketRegime;
  direction: "bullish" | "bearish" | "neutral";
  impulse: ImpulseColor;
  tradingStyle: TradingStyle;
  agreeingSystems: string[];
  ictScore: number;
}

// ==================== Backtest Statistics ====================

export interface BacktestStats {
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens: number;
  expired: number;
  winRate: number;
  avgWinR: number;
  avgLossR: number;
  expectancy: number;          // (wr * avgWinR) - ((1-wr) * avgLossR)
  profitFactor: number;        // gross profit / gross loss
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdownPercent: number;
  maxDrawdownR: number;
  avgBarsInTrade: number;
  totalReturnPercent: number;
  totalReturnR: number;
  recoveryFactor: number;      // totalReturn / maxDrawdown
  consecutiveWins: number;
  consecutiveLosses: number;
  avgTradesPerMonth: number;
}

export interface EquityPoint {
  barIndex: number;
  timestamp: number;
  equity: number;
  drawdownPercent: number;
  tradeId?: string;
}

// ==================== Breakdowns ====================

export interface SystemBreakdown {
  system: string;
  trades: number;
  winRate: number;
  expectancy: number;
  avgStrength: number;
  profitFactor: number;
}

export interface RegimeBreakdown {
  regime: MarketRegime;
  trades: number;
  winRate: number;
  expectancy: number;
  profitFactor: number;
  avgConviction: number;
}

export interface ConvictionBreakdown {
  tier: ConvictionTier;
  trades: number;
  winRate: number;
  expectancy: number;
  avgRR: number;
  profitFactor: number;
}

export interface MonthlyReturn {
  month: string;               // "2024-01"
  returnPercent: number;
  returnR: number;
  trades: number;
  winRate: number;
}

// ==================== Backtest Result (Aggregate) ====================

export interface BacktestResult {
  config: BacktestConfig;
  trades: BacktestTrade[];
  stats: BacktestStats;
  equityCurve: EquityPoint[];
  systemBreakdown: SystemBreakdown[];
  regimeBreakdown: RegimeBreakdown[];
  convictionBreakdown: ConvictionBreakdown[];
  monthlyReturns: MonthlyReturn[];
  runTimestamp: number;
  totalBarsProcessed: number;
  candleCount: number;
  computeTimeMs: number;
}

// ==================== Backtest Progress ====================

export interface BacktestProgress {
  status: "idle" | "fetching" | "running" | "complete" | "error";
  currentBar: number;
  totalBars: number;
  tradesFound: number;
  percentComplete: number;
  errorMessage?: string;
}

// ==================== Auto-Improvement ====================

export interface OptimizationProfile {
  id: string;
  name: string;
  createdAt: number;
  baselineResult: BacktestResult;
  optimizedResult: BacktestResult | null;
  adjustments: ParameterAdjustment[];
  status: "pending" | "applied" | "reverted";
  improvement: {
    winRateDelta: number;
    expectancyDelta: number;
    profitFactorDelta: number;
    maxDDDelta: number;
  } | null;
}

export interface ParameterAdjustment {
  parameter: string;           // e.g., "slMultiplier.swing", "system.RSI Extremes.weight"
  currentValue: number | string;
  suggestedValue: number | string;
  reasoning: string;
  impact: "high" | "medium" | "low";
  category: "risk" | "entry" | "exit" | "filter" | "system_weight";
}

export interface ImprovementAnalysis {
  weaknesses: Weakness[];
  suggestions: ParameterAdjustment[];
  summary: string;
  confidence: number;
}

export interface Weakness {
  area: string;
  description: string;
  severity: "critical" | "moderate" | "minor";
  evidence: string;
  suggestedFix: string;
}

// ==================== Weekend Lab / Batch Types ====================

export interface BatchConfig {
  baseConfig: BacktestConfig;
  instruments: string[];
  autoImprove: boolean;
  feedConfluence: boolean;
  timeframe: "1h" | "4h";
  tradingStyle: TradingStyle;
}

export interface BatchProgress {
  status: "idle" | "running" | "improving" | "complete" | "error";
  currentInstrument: string;
  currentInstrumentIndex: number;
  totalInstruments: number;
  phase: "backtest" | "analyze" | "sweep" | "improve" | "retest" | "confluence";
  sweepVariant?: number;
  sweepTotal?: number;
  percentComplete: number;
  errorMessage?: string;
}

export interface SweepVariant {
  label: string;
  overrides: NonNullable<BacktestConfig["overrides"]>;
  stats: BacktestStats;
  score: number; // composite score for ranking
}

export interface BatchInstrumentResult {
  instrumentId: string;
  symbol: string;
  category: string;
  baselineResult: BacktestResult;
  improvedResult: BacktestResult | null;
  weaknesses: Weakness[];
  adjustments: ParameterAdjustment[];
  hasEdge: boolean;
  improvement: {
    winRateDelta: number;
    expectancyDelta: number;
    profitFactorDelta: number;
    maxDDDelta: number;
  } | null;
  // Parameter sweep data
  sweepVariants: SweepVariant[];
  bestVariant: SweepVariant | null;
  sweepImprovement: number; // expectancy delta vs baseline for best variant
}

export interface OptimizedParams {
  instrumentId: string;
  style: TradingStyle;
  overrides: NonNullable<BacktestConfig["overrides"]>;
  baselineExpectancy: number;
  optimizedExpectancy: number;
  timestamp: number;
}

export interface AggregateStats {
  totalInstruments: number;
  instrumentsWithEdge: number;
  instrumentsWithoutEdge: number;
  totalTrades: number;
  overallWinRate: number;
  overallExpectancy: number;
  overallProfitFactor: number;
  avgMaxDrawdown: number;
  bestInstrument: { id: string; symbol: string; expectancy: number } | null;
  worstInstrument: { id: string; symbol: string; expectancy: number } | null;
  byCategory: {
    category: string;
    instruments: number;
    avgExpectancy: number;
    avgWinRate: number;
  }[];
}
