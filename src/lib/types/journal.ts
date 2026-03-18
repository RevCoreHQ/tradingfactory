import type { BiasDirection } from "./bias";

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
  };
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
}
