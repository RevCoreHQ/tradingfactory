import type { TradeEntry, JournalStats } from "@/lib/types/journal";

const JOURNAL_KEY = "trading-factory-journal";
const MAX_ENTRIES = 500;

export function loadJournal(): TradeEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(JOURNAL_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveJournal(entries: TradeEntry[]): void {
  if (typeof window === "undefined") return;
  const pruned = entries.slice(-MAX_ENTRIES);
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(pruned));
}

export function addTrade(entry: Omit<TradeEntry, "id">): TradeEntry {
  const entries = loadJournal();
  const newEntry: TradeEntry = {
    ...entry,
    id: crypto.randomUUID(),
  };
  entries.push(newEntry);
  saveJournal(entries);
  return newEntry;
}

export function updateTrade(id: string, updates: Partial<TradeEntry>): TradeEntry | null {
  const entries = loadJournal();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  entries[idx] = { ...entries[idx], ...updates };
  saveJournal(entries);
  return entries[idx];
}

export function closeTrade(id: string, exitPrice: number, pipSize: number): TradeEntry | null {
  const entries = loadJournal();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return null;

  const entry = entries[idx];
  const pnlRaw = entry.direction === "long"
    ? exitPrice - entry.entryPrice
    : entry.entryPrice - exitPrice;
  const pnlPips = Math.round(pnlRaw / pipSize);
  const pnlPercent = (pnlRaw / entry.entryPrice) * 100;
  const outcome: TradeEntry["outcome"] = pnlPips > 0 ? "win" : pnlPips < 0 ? "loss" : "breakeven";

  entries[idx] = {
    ...entry,
    exitPrice,
    exitTime: Date.now(),
    pnlPips,
    pnlPercent: Math.round(pnlPercent * 100) / 100,
    outcome,
  };
  saveJournal(entries);
  return entries[idx];
}

export function deleteTrade(id: string): void {
  const entries = loadJournal().filter((e) => e.id !== id);
  saveJournal(entries);
}

export function calculateJournalStats(entries: TradeEntry[]): JournalStats {
  const openTrades = entries.filter((e) => !e.exitPrice);
  const closedTrades = entries.filter((e) => e.outcome);
  const wins = closedTrades.filter((e) => e.outcome === "win");
  const totalPnlPips = closedTrades.reduce((sum, e) => sum + (e.pnlPips || 0), 0);

  // Bias alignment: did the trade direction match the bias direction?
  const aligned = entries.filter((e) => {
    const biasBullish = e.biasAtEntry.direction.includes("bullish");
    const biasBearish = e.biasAtEntry.direction.includes("bearish");
    return (e.direction === "long" && biasBullish) || (e.direction === "short" && biasBearish);
  });

  const alignedClosed = aligned.filter((e) => e.outcome);
  const alignedWins = alignedClosed.filter((e) => e.outcome === "win");
  const contraryClosed = closedTrades.filter((e) => !aligned.includes(e));
  const contraryWins = contraryClosed.filter((e) => e.outcome === "win");

  return {
    totalTrades: entries.length,
    openTrades: openTrades.length,
    closedTrades: closedTrades.length,
    winRate: closedTrades.length > 0 ? Math.round((wins.length / closedTrades.length) * 100) : 0,
    avgPnlPips: closedTrades.length > 0 ? Math.round(totalPnlPips / closedTrades.length) : 0,
    biasAlignmentRate: entries.length > 0 ? Math.round((aligned.length / entries.length) * 100) : 0,
    biasAlignedWinRate: alignedClosed.length > 0 ? Math.round((alignedWins.length / alignedClosed.length) * 100) : 0,
    biasContraryWinRate: contraryClosed.length > 0 ? Math.round((contraryWins.length / contraryClosed.length) * 100) : 0,
  };
}
