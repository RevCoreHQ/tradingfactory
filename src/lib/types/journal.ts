import type {
  BiasDirection,
  ConfluenceTier,
  MarketRegime,
  TimeframeAlignment,
  TradeGuidanceKind,
} from "./bias";

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
    /** True if a high-impact print was inside ~90m at entry. */
    eventWindowCaution?: boolean;
    mtfAlignmentPercent?: number;
    /** Bias model timestamp when trade was logged. */
    biasTimestamp?: number;
    marketRegime?: MarketRegime;
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
  /** Closed trades only: by confluence tier. */
  byTier: Record<string, { trades: number; wins: number; winRate: number }>;
  /** Closed trades only: by timeframe alignment at entry. */
  byTfAlignment: Record<string, { trades: number; wins: number; winRate: number }>;
  /** Closed trades only: event window caution vs quiet vs unspecified. */
  byEventWindow: Record<string, { trades: number; wins: number; winRate: number }>;
}

/** UI filters for journal list + aggregate stats (subset). */
export type JournalAnalyticsFilter = {
  tier: "all" | ConfluenceTier;
  timeframeAlignment: "all" | TimeframeAlignment | "unspecified";
  eventWindow: "all" | "caution" | "quiet" | "unspecified";
};
