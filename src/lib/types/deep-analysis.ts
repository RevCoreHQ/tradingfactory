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
  category: "support_resistance" | "pivot" | "fibonacci" | "supply_demand" | "moving_average" | "vwap";
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
  currentPrice: number;
  timestamp: number;
}

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
  tradeIdeas: AITradeIdea[];
  significantZones: string[];
  keyLevelsToWatch: string[];
  summary: string;
}
