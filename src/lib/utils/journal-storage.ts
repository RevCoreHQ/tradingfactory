import type { TradeEntry, JournalStats, JournalAnalyticsFilter } from "@/lib/types/journal";

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

function finalizeWinRates<T extends Record<string, { trades: number; wins: number; winRate: number }>>(
  bucket: T
): T {
  for (const k of Object.keys(bucket)) {
    const b = bucket[k];
    b.winRate = b.trades > 0 ? Math.round((b.wins / b.trades) * 100) : 0;
  }
  return bucket;
}

/** Subset entries for list + aggregate stats when analytics filters are active. */
export function filterTradesForAnalytics(
  entries: TradeEntry[],
  f: JournalAnalyticsFilter
): TradeEntry[] {
  return entries.filter((e) => {
    if (f.tier !== "all") {
      const t = e.biasAtEntry.confluenceTier;
      if (t !== f.tier) return false;
    }
    if (f.timeframeAlignment !== "all") {
      const a = e.biasAtEntry.timeframeAlignment;
      if (f.timeframeAlignment === "unspecified") {
        if (a !== undefined) return false;
      } else if (a !== f.timeframeAlignment) return false;
    }
    if (f.eventWindow !== "all") {
      const c = e.biasAtEntry.eventWindowCaution;
      if (f.eventWindow === "unspecified") {
        if (c !== undefined) return false;
      } else if (f.eventWindow === "caution" && c !== true) {
        return false;
      } else if (f.eventWindow === "quiet" && c !== false) {
        return false;
      }
    }
    return true;
  });
}

export function serializeJournalJson(entries: TradeEntry[]): string {
  return JSON.stringify(entries, null, 2);
}

function csvEscape(s: string): string {
  const t = s.replace(/\r?\n/g, " ");
  if (/[",]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

export function serializeJournalCsv(entries: TradeEntry[]): string {
  const headers = [
    "id",
    "instrumentId",
    "direction",
    "entryPrice",
    "entryTime",
    "exitPrice",
    "outcome",
    "pnlPips",
    "setupType",
    "overallBias",
    "biasDirection",
    "confidence",
    "confluenceTier",
    "timeframeAlignment",
    "eventWindowCaution",
    "mtfAlignmentPercent",
    "marketRegime",
    "notes",
  ];
  const lines = [headers.join(",")];
  for (const e of entries) {
    const b = e.biasAtEntry;
    lines.push(
      [
        csvEscape(e.id),
        csvEscape(e.instrumentId),
        e.direction,
        e.entryPrice,
        e.entryTime,
        e.exitPrice ?? "",
        e.outcome ?? "",
        e.pnlPips ?? "",
        csvEscape(e.setupType ?? ""),
        b.overallBias,
        csvEscape(b.direction),
        b.confidence,
        csvEscape(b.confluenceTier ?? ""),
        csvEscape(b.timeframeAlignment ?? ""),
        b.eventWindowCaution === undefined ? "" : b.eventWindowCaution ? "1" : "0",
        b.mtfAlignmentPercent ?? "",
        csvEscape(b.marketRegime ?? ""),
        csvEscape((e.notes ?? "").slice(0, 2000)),
      ].join(",")
    );
  }
  return lines.join("\n");
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

  const bySetupType: JournalStats["bySetupType"] = {};
  for (const e of closedTrades) {
    const key = e.setupType || "unspecified";
    if (!bySetupType[key]) bySetupType[key] = { trades: 0, wins: 0, winRate: 0 };
    bySetupType[key].trades += 1;
    if (e.outcome === "win") bySetupType[key].wins += 1;
  }
  finalizeWinRates(bySetupType);

  const byTier: JournalStats["byTier"] = {};
  for (const e of closedTrades) {
    const key = e.biasAtEntry.confluenceTier || "unspecified";
    if (!byTier[key]) byTier[key] = { trades: 0, wins: 0, winRate: 0 };
    byTier[key].trades += 1;
    if (e.outcome === "win") byTier[key].wins += 1;
  }
  finalizeWinRates(byTier);

  const byTfAlignment: JournalStats["byTfAlignment"] = {};
  for (const e of closedTrades) {
    const key = e.biasAtEntry.timeframeAlignment || "unspecified";
    if (!byTfAlignment[key]) byTfAlignment[key] = { trades: 0, wins: 0, winRate: 0 };
    byTfAlignment[key].trades += 1;
    if (e.outcome === "win") byTfAlignment[key].wins += 1;
  }
  finalizeWinRates(byTfAlignment);

  const byEventWindow: JournalStats["byEventWindow"] = {};
  for (const e of closedTrades) {
    const c = e.biasAtEntry.eventWindowCaution;
    const key = c === true ? "caution" : c === false ? "quiet" : "unspecified";
    if (!byEventWindow[key]) byEventWindow[key] = { trades: 0, wins: 0, winRate: 0 };
    byEventWindow[key].trades += 1;
    if (e.outcome === "win") byEventWindow[key].wins += 1;
  }
  finalizeWinRates(byEventWindow);

  return {
    totalTrades: entries.length,
    openTrades: openTrades.length,
    closedTrades: closedTrades.length,
    winRate: closedTrades.length > 0 ? Math.round((wins.length / closedTrades.length) * 100) : 0,
    avgPnlPips: closedTrades.length > 0 ? Math.round(totalPnlPips / closedTrades.length) : 0,
    biasAlignmentRate: entries.length > 0 ? Math.round((aligned.length / entries.length) * 100) : 0,
    biasAlignedWinRate: alignedClosed.length > 0 ? Math.round((alignedWins.length / alignedClosed.length) * 100) : 0,
    biasContraryWinRate: contraryClosed.length > 0 ? Math.round((contraryWins.length / contraryClosed.length) * 100) : 0,
    bySetupType,
    byTier,
    byTfAlignment,
    byEventWindow,
  };
}
