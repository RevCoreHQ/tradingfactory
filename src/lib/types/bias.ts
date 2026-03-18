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

export interface TradeSetup {
  tradeScore: number;            // ADR-weighted conviction (ranking metric)
  projectedMove: { pips: number; percent: number };
  stopLoss: number;              // Price level
  takeProfit: [number, number, number]; // TP1, TP2, TP3 price levels
  riskReward: [number, number, number]; // R:R for each TP
  riskSizing: RiskSizing;
  riskReason: string;
  entryZone: [number, number];   // low, high
}

export interface BiasResult {
  instrument: string;
  overallBias: number;
  direction: BiasDirection;
  confidence: number;
  fundamentalScore: FundamentalScore;
  technicalScore: TechnicalScore;
  aiBias: number;                // AI/LLM bias component (-100 to +100)
  timeframe: "intraday" | "intraweek";
  timestamp: number;
  signals: BiasSignal[];
  adr: ADRData | null;
  tradeSetup: TradeSetup | null;
  signalAgreement: number;       // 0-1, how much signals agree on direction
}

export interface BiasHistoryEntry {
  timestamp: number;
  bias: number;
  direction: BiasDirection;
  fundamentalScore: number;
  technicalScore: number;
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
