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

// ==================== EMA Stack Trend Alignment ====================

export type EmaStackState = "bullish" | "bearish" | "mixed";

export type MTFTimeframe = "5m" | "15m" | "1h" | "4h" | "1d" | "1w";

export interface TimeframeTrend {
  timeframe: MTFTimeframe;
  label: string;
  emaStack: EmaStackState; // EMA 9 > 21 > 50 > SMA 200 = bullish (reverse = bearish)
  ema9: number;
  ema21: number;
  ema50: number;
  sma200: number;
  priceAboveEma9: boolean;
  direction: "bullish" | "bearish" | "neutral";
}

export interface MTFTrendSummary {
  trends: TimeframeTrend[];
  alignedCount: number;          // how many TFs agree with anchor direction
  anchorDirection: "bullish" | "bearish" | "neutral";
  pullbackComplete: boolean;     // lower TF flipped back to daily direction
  pullbackTimeframe: MTFTimeframe | null; // which TF triggered the signal
  convictionModifier: number;    // +10 fully aligned, +5 mostly, -10 against daily
  alignment: "full" | "strong" | "partial" | "conflicting";
}
