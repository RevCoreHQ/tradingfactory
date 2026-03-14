export type LLMProvider = "gemini" | "openai";

export interface LLMSignal {
  source: string;
  signal: "bullish" | "bearish" | "neutral";
  strength: number;
  description: string;
}

export interface LLMAnalysisResult {
  biasAdjustment: number;
  confidence: number;
  signals: LLMSignal[];
  summary: string;
}

export interface LLMBatchResult {
  results: Record<string, LLMAnalysisResult>;
  provider: LLMProvider;
  timestamp: number;
}

export interface LLMAnalysisRequest {
  instrument: string;
  category: string;
  currentPrice: number;
  priceChange24h: number;
  fearGreed: { value: number; label: string };
  dxy: { value: number; change: number };
  bondYields: { maturity: string; yield: number; change: number }[];
  centralBanks: { bank: string; rate: number; direction: string; stance: string }[];
  newsHeadlines: { headline: string; sentiment: string; score: number }[];
  technicals: {
    rsi: number;
    rsiSignal: string;
    macdHistogram: number;
    macdCrossover: string | null;
    trend: string;
    trendStrength: number;
    bbPercentB: number;
  } | null;
  ruleBasedScores: {
    fundamentalTotal: number;
    technicalTotal: number;
    overallBias: number;
    direction: string;
  };
}

export interface LLMBatchRequest {
  instruments: Omit<LLMAnalysisRequest, "technicals">[];
}
