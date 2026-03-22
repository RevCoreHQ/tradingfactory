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
  fearGreed: { value: number | null; label: string };
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
  focusPairs?: string[];
  avoidPairs?: string[];
}

export interface MarketSummaryResult {
  overview: string;
  risks: string[];
  opportunities: string[];
  outlook: "bullish" | "bearish" | "neutral";
  sectorOutlook?: SectorOutlook[];
  focusToday?: string[];
  sitOutToday?: string[];
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
  // ---- Rich data from mechanical pipeline ----
  // Multi-timeframe
  mtfAlignment?: "full" | "strong" | "partial" | "conflicting";
  mtfDaily?: "bullish" | "bearish" | "neutral";
  pullbackComplete?: boolean;
  // Advanced regime
  volatilityRegime?: "low" | "normal" | "high";
  wyckoffPhase?: "accumulation" | "expansion" | "distribution" | "reversal";
  adxTrend?: "rising" | "falling" | "flat";
  // Market structure
  structureBias?: "bullish" | "bearish" | "neutral";
  structureScore?: number; // -100 to +100
  lastBOS?: { direction: string; price: number } | null;
  lastCHoCH?: { direction: string; price: number } | null;
  // ICT context
  ictScore?: number; // 0-100
  nearestFVG?: { type: string; midpoint: number; freshness: string } | null;
  nearestOB?: { type: string; strength: number } | null;
  displacement?: boolean;
  // Entry optimization
  bestEntryPattern?: string; // "hammer", "engulfing", "fvg_reentry", etc.
  entryScore?: number; // 0-100
  pullbackDepth?: number; // 0-1 (0.5 = 50% retracement)
  // Learning / confluence history
  learningWinRate?: number;
  learningTrades?: number;
}

export interface TradingAdvisorRequest {
  setups: TradingAdvisorSetupInput[];
  managedSetups?: { symbol: string; direction: string; status: string }[];
  regimeSummary: string;
  consensusSummary: string;
  impulseSummary: string;
  fearGreed: { value: number; label: string };
  dxy: { value: number; change: number };
  bondYields: { maturity: string; yield: number; change: number }[];
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
  focusToday: { symbol: string; action: "LONG" | "SHORT" }[];
  sitOutToday: string[];
  riskWarning: string;
  deskNote: string;
  timestamp: number;
  provider: LLMProvider;
}

// ==================== Desk Chat ====================

export interface DeskChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface DeskChatRequest {
  messages: DeskChatMessage[];
  context: TradingAdvisorRequest;
}

export interface DeskChatResponse {
  reply: string;
  provider: LLMProvider;
  timestamp: number;
}
