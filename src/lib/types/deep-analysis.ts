// ==================== ICT Concepts ====================

export interface FairValueGap {
  type: "bullish" | "bearish";
  high: number;
  low: number;
  midpoint: number; // Consequent Encroachment (CE) = (high + low) / 2
  candleIndex: number;
  timestamp: number;
  size: number;
  sizeATR: number;
  fillPercent: number; // 0-100
  freshness: "fresh" | "tested" | "filled";
  strength: number; // 0-100
}

export interface InstitutionalCandle {
  type: "bullish" | "bearish";
  candleIndex: number;
  timestamp: number;
  open: number;
  close: number;
  high: number;
  low: number;
  bodyATR: number;
  createdFVG: boolean;
  brokeStructure: boolean;
  displacementScore: number; // 0-100
}

export interface ConsolidationBreakout {
  rangeHigh: number;
  rangeLow: number;
  startIndex: number;
  endIndex: number;
  barCount: number;
  rangeATR: number;
  breakoutDirection: "bullish" | "bearish";
  breakoutCandle: InstitutionalCandle;
  retestZoneHigh: number;
  retestZoneLow: number;
  retested: boolean;
  strength: number; // 0-100
}

// ==================== Supply / Demand ====================

export interface SupplyDemandZone {
  type: "supply" | "demand";
  priceHigh: number;
  priceLow: number;
  timestamp: number;
  candleIndex: number;
  strength: number; // 0-100
  freshness: "fresh" | "tested" | "broken";
  testCount: number;
  impulseMagnitude: number; // ATR multiples
  isOrderBlock: boolean;
}

export interface ConfluenceSource {
  name: string;
  price: number;
  category: "support_resistance" | "pivot" | "fibonacci" | "supply_demand" | "moving_average" | "vwap" | "ict";
}

export interface ConfluenceLevel {
  price: number;
  score: number;
  sources: ConfluenceSource[];
  type: "support" | "resistance";
}

export interface DeepAnalysisResult {
  supplyZones: SupplyDemandZone[];
  demandZones: SupplyDemandZone[];
  confluenceLevels: ConfluenceLevel[];
  fairValueGaps: FairValueGap[];
  institutionalCandles: InstitutionalCandle[];
  consolidationBreakouts: ConsolidationBreakout[];
  currentPrice: number;
  timestamp: number;
}

/** @deprecated LLM no longer generates trade ideas */
export interface AITradeIdea {
  direction: "long" | "short";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  rationale: string;
  confluenceFactors: string[];
  confidence: number; // 0-100
  timeframe: string;
}

export interface DeepAnalysisLLMResult {
  tradeIdeas: AITradeIdea[]; // DEPRECATED: Always empty
  significantZones: string[];
  keyLevelsToWatch: string[];
  summary: string;
  zoneAnalysis?: string; // Narrative analysis of how zones interact with price
}
