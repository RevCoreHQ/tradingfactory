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

export interface BiasResult {
  instrument: string;
  overallBias: number;
  direction: BiasDirection;
  confidence: number;
  fundamentalScore: FundamentalScore;
  technicalScore: TechnicalScore;
  timeframe: "intraday" | "intraweek";
  timestamp: number;
  signals: BiasSignal[];
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
