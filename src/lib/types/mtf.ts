export interface MTFTimeframeResult {
  timeframe: string;
  label: string;
  technicalScore: number; // 0-100
  trendDirection: "uptrend" | "downtrend" | "sideways";
  rsi: number;
  macdCrossover: "bullish" | "bearish" | null;
  bias: number; // -100 to +100
}

export interface MTFConfluenceResult {
  timeframes: MTFTimeframeResult[];
  alignment: "aligned_bullish" | "aligned_bearish" | "mixed";
  alignmentScore: number; // 0-100
  htfBias: number; // higher-timeframe weighted bias
  confidenceModifier: number; // 0.85, 1.0, or 1.15
}
