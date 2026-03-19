export type LLMProvider = "gemini" | "openai" | "anthropic";

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
  keyLevels?: { support: number; resistance: number };
  projectedMovePercent?: number;
  riskAssessment?: "low" | "medium" | "high";
  catalysts?: string[];
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

export interface MarketSummaryRequest {
  fearGreed: { value: number; label: string };
  dxy: { value: number; change: number };
  bondYields: { maturity: string; yield: number; change: number }[];
  centralBanks: { bank: string; rate: number; direction: string; stance: string }[];
  newsHeadlines: { headline: string; sentiment: string; score: number }[];
  instrumentBiases?: { symbol: string; category: string; direction: string; bias: number }[];
}

export interface SectorOutlook {
  sector: string;
  outlook: "bullish" | "bearish" | "neutral";
  keyAssets: string[];
}

export interface MarketSummaryResult {
  overview: string;
  risks: string[];
  opportunities: string[];
  outlook: "bullish" | "bearish" | "neutral";
  sectorOutlook?: SectorOutlook[];
  timestamp: number;
  provider: LLMProvider;
}

// ==================== Trading Advisor ====================

export interface TradingAdvisorSetupInput {
  instrument: string;
  symbol: string;
  category: string;
  direction: string;
  conviction: string;
  convictionScore: number;
  regime: string;
  adx: number;
  impulse: string;
  signalsSummary: string; // e.g. "5 bullish, 1 bearish, 2 neutral"
  systemsAgreeing: string[]; // names of bullish/bearish systems
  entry: string;
  stopLoss: string;
  takeProfit: string;
  riskReward: string;
  positionSize: string;
  currentPrice: number;
  trackedStatus?: string; // e.g. "Awaiting Entry", "Entry Zone", "Running (BE)" — from setup tracker
}

export interface TradingAdvisorRequest {
  setups: TradingAdvisorSetupInput[];
  regimeSummary: string;
  consensusSummary: string;
  impulseSummary: string;
  fearGreed: { value: number; label: string };
  dxy: { value: number; change: number };
  bondYields: { maturity: string; yield: number; change: number }[];
  accountEquity: number;
  riskPercent: number;
}

export interface TradingAdvisorResult {
  greeting: string;
  marketRegime: string;
  topPick: {
    instrument: string;
    action: string;
    conviction: string;
    reasoning: string;
    levels: string;
  } | null;
  otherSetups: string[];
  avoidList: string[];
  riskWarning: string;
  deskNote: string;
  timestamp: number;
  provider: LLMProvider;
}
