export interface MovingAverageResult {
  type: "EMA" | "SMA";
  period: number;
  value: number;
  trend: "above_price" | "below_price";
}

export interface RSIResult {
  value: number;
  signal: "oversold" | "neutral" | "overbought";
}

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
  crossover: "bullish" | "bearish" | null;
}

export interface BollingerBandsResult {
  upper: number;
  middle: number;
  lower: number;
  width: number;
  percentB: number;
}

export interface ATRResult {
  value: number;
  normalized: number;
}

export interface StochasticRSIResult {
  k: number;
  d: number;
  signal: "oversold" | "neutral" | "overbought";
}

export interface VWAPResult {
  value: number;
  deviation: number;
}

export interface PivotPointResult {
  type: "daily" | "weekly";
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

export interface SupportResistanceLevel {
  price: number;
  type: "support" | "resistance";
  strength: number;
  timeframe: string;
}

export interface FibonacciLevel {
  level: number;
  price: number;
  label: string;
}

export interface TrendAnalysis {
  direction: "uptrend" | "downtrend" | "sideways";
  pattern: "HH_HL" | "LH_LL" | "mixed";
  strength: number;
  swingPoints: { price: number; timestamp: number; type: "high" | "low" }[];
}

export interface TechnicalSummary {
  instrument: string;
  timeframe: string;
  timestamp: number;
  currentPrice: number;
  movingAverages: MovingAverageResult[];
  rsi: RSIResult;
  macd: MACDResult;
  bollingerBands: BollingerBandsResult;
  atr: ATRResult;
  stochasticRsi: StochasticRSIResult;
  vwap: VWAPResult | null;
  pivotPoints: PivotPointResult[];
  supportResistance: SupportResistanceLevel[];
  fibonacci: FibonacciLevel[];
  trend: TrendAnalysis;
}
