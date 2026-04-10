import type { BiasDirection, ConfluenceTier, TimeframeAlignment, TradeGuidanceKind } from "./bias";

export type TradeSetupType =
  | "with_trend"
  | "pullback"
  | "counter_trend"
  | "breakout"
  | "news_play"
  | "other";

export interface TradeEntry {
  id: string;
  instrumentId: string;
  direction: "long" | "short";
  entryPrice: number;
  entryTime: number;
  exitPrice?: number;
  exitTime?: number;
  outcome?: "win" | "loss" | "breakeven";
  pnlPips?: number;
  pnlPercent?: number;
  biasAtEntry: {
    overallBias: number;
    direction: BiasDirection;
    confidence: number;
    tradeScore?: number;
    timeframeAlignment?: TimeframeAlignment;
    confluenceTier?: ConfluenceTier;
    tradeGuidance?: TradeGuidanceKind;
  };
  /** How you classified the setup at entry (for performance review). */
  setupType?: TradeSetupType;
  sessionAtEntry?: string;
  notes?: string;
  tags?: string[];
}

export interface JournalStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winRate: number;
  avgPnlPips: number;
  biasAlignmentRate: number;
  biasAlignedWinRate: number;
  biasContraryWinRate: number;
  /** Closed trades only: win rate by setup type label. */
  bySetupType: Record<string, { trades: number; wins: number; winRate: number }>;
}
