export type BiasDirection = "strong_bearish" | "bearish" | "neutral" | "bullish" | "strong_bullish";

export interface FundamentalScore {
  total: number;
  newsSentiment: number;
  economicData: number;
  centralBankPolicy: number;
  marketSentiment: number;
  intermarketCorrelation: number;
}

export interface TechnicalScore {
  total: number;
  trendDirection: number;
  momentum: number;
  volatility: number;
  volumeAnalysis: number;
  supportResistance: number;
}

export interface BiasSignal {
  source: string;
  signal: "bullish" | "bearish" | "neutral";
  strength: number;
  description: string;
}

export interface ADRData {
  pips: number;
  percent: number;
  rank: number; // percentile rank among all instruments (0-100)
}

export type RiskSizing = "size_up" | "normal" | "size_down";

export type TimeframeAlignment = "aligned" | "mixed" | "counter";
export type MarketRegime = "risk_on" | "risk_off" | "neutral";
export type TradeGuidanceKind =
  | "with_trend"
  | "pullback"
  | "counter_trend_scalp"
  | "no_edge"
  | "caution_events";

export type ConfluenceTier = "A" | "B" | "C";

export interface EventGateInfo {
  hasMajorEventSoon: boolean;
  minutesUntil?: number;
  eventTitle?: string;
  impact: "high" | "medium" | "low";
  suggestion: string;
}

export interface SetupChecklistItem {
  id: string;
  label: string;
  pass: boolean;
}

export interface TradeSetup {
  tradeScore: number;            // ADR-weighted conviction (ranking metric)
  projectedMove: { pips: number; percent: number };
  stopLoss: number;              // Price level
  takeProfit: [number, number, number]; // TP1, TP2, TP3 price levels
  riskReward: [number, number, number]; // R:R for each TP
  riskSizing: RiskSizing;
  riskReason: string;
  entryZone: [number, number];   // low, high
  /** Pass/fail gates for execution discipline */
  checklist?: SetupChecklistItem[];
  confluenceTier?: ConfluenceTier;
  tradeStance?: string;
}

export interface BiasResult {
  instrument: string;
  overallBias: number;
  direction: BiasDirection;
  confidence: number;
  fundamentalScore: FundamentalScore;
  technicalScore: TechnicalScore;
  aiBias: number;                // DEPRECATED: Always 0. LLM no longer influences scoring.
  fundamentalReason?: string;    // AI explanation of fundamental score drivers
  technicalReason?: string;      // AI explanation of technical score drivers
  timeframe: "intraday" | "intraweek";
  timestamp: number;
  signals: BiasSignal[];
  adr: ADRData | null;
  tradeSetup: TradeSetup | null;
  signalAgreement: number;       // 0-1, how much signals agree on direction
  /** How dashboard batch technicals were computed (e.g. 15m + 1h blend). */
  technicalBasis?: string;
  /** Intraday bias using 15m technicals only (+ fundamentals). */
  tacticalBias?: number;
  /** Intraday bias using 1h technicals only (+ fundamentals). */
  structuralBias?: number;
  timeframeAlignment?: TimeframeAlignment;
  marketRegime?: MarketRegime;
  tradeGuidance?: TradeGuidanceKind;
  tradeGuidanceSummary?: string;
  eventGate?: EventGateInfo;
  /** 0–100 MTF directional alignment from batch (optional). */
  mtfAlignmentPercent?: number;
}

export interface BiasOutcome {
  actualDirection: "up" | "down";
  priceAtPrediction: number;
  priceAfter: number;
  wasCorrect: boolean;
  measuredAt: number;
}

export interface BiasHistoryEntry {
  timestamp: number;
  bias: number;
  direction: BiasDirection;
  fundamentalScore: number;
  technicalScore: number;
  priceAtPrediction?: number;
  outcome24h?: BiasOutcome;
  outcome1w?: BiasOutcome;
}

export interface AccuracyStats {
  total: number;
  correct24h: number;
  correct1w: number;
  winRate24h: number;
  winRate1w: number;
  currentStreak: number;
  bestStreak: number;
  byInstrument: Record<string, { total: number; correct24h: number; correct1w: number }>;
}

export const FUNDAMENTAL_WEIGHTS = {
  newsSentiment: 0.25,
  economicData: 0.25,
  centralBankPolicy: 0.20,
  marketSentiment: 0.15,
  intermarketCorrelation: 0.15,
} as const;

export const TECHNICAL_WEIGHTS = {
  trendDirection: 0.30,
  momentum: 0.30,
  volatility: 0.15,
  volumeAnalysis: 0.10,
  supportResistance: 0.15,
} as const;
