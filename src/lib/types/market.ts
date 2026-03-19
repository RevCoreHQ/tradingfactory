export type InstrumentCategory = "forex" | "crypto" | "index" | "commodity";

export interface Instrument {
  id: string;
  symbol: string;
  displayName: string;
  category: InstrumentCategory;
  alphavantageSymbol: string;
  alphavantageToSymbol?: string;
  finnhubSymbol?: string;
  twelveDataSymbol?: string;
  coingeckoId?: string;
  fredSeriesIds?: string[];
  pipSize: number;
  decimalPlaces: number;
}

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceQuote {
  instrument: string;
  bid: number;
  ask: number;
  mid: number;
  timestamp: number;
  change: number;
  changePercent: number;
  high24h: number;
  low24h: number;
}

export type Timeframe = "1min" | "5min" | "15min" | "30min" | "1h" | "4h" | "1d" | "1w";

export type TradingSession = "sydney" | "tokyo" | "london" | "newyork";

export interface SessionInfo {
  name: string;
  city: string;
  openHourUTC: number;
  closeHourUTC: number;
  timezone: string;
  color: string;
}

export interface EconomicEvent {
  id: string;
  country: string;
  event: string;
  date: string;
  time: string;
  impact: "low" | "medium" | "high";
  forecast?: number;
  previous?: number;
  actual?: number;
  currency: string;
  unit?: string;
}

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  category: string;
  relatedInstruments: string[];
  sentimentScore: number;
  sentimentLabel: "bearish" | "neutral" | "bullish";
}

export interface CentralBankRate {
  bank: string;
  currency: string;
  currentRate: number;
  previousRate: number;
  lastChanged: string;
  nextMeeting: string;
  rateDirection: "hiking" | "holding" | "cutting";
  policyStance: "hawkish" | "neutral" | "dovish";
}

export interface BondYield {
  maturity: string;
  yield: number;
  change: number;
  seriesId: string;
}

export interface FearGreedData {
  value: number;
  label: string;
  timestamp: number;
  previousClose: number;
  previousWeek: number;
  previousMonth: number;
}

export interface CurrencyStrengthData {
  currency: string;
  strength: number;
  change24h: number;
  pairs: { pair: string; rate: number; change: number }[];
}

export interface DXYData {
  value: number;
  change: number;
  changePercent: number;
  history: { date: string; value: number }[];
}

export interface EconomicIndicators {
  cpi: number;
  gdp: number;
  unemployment: number;
  fedFundsRate: number;
  fedFundsTarget: number;
}
