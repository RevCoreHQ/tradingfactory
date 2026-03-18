"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadJournal,
  addTrade as addTradeStorage,
  updateTrade as updateTradeStorage,
  closeTrade as closeTradeStorage,
  deleteTrade as deleteTradeStorage,
  calculateJournalStats,
} from "@/lib/utils/journal-storage";
import type { TradeEntry, JournalStats } from "@/lib/types/journal";

export function useTradeJournal() {
  const [entries, setEntries] = useState<TradeEntry[]>([]);

  useEffect(() => {
    setEntries(loadJournal());
  }, []);

  const stats = useMemo<JournalStats>(() => {
    return calculateJournalStats(entries);
  }, [entries]);

  const addTrade = useCallback((entry: Omit<TradeEntry, "id">) => {
    const newEntry = addTradeStorage(entry);
    setEntries((prev) => [...prev, newEntry]);
    return newEntry;
  }, []);

  const updateTrade = useCallback((id: string, updates: Partial<TradeEntry>) => {
    const updated = updateTradeStorage(id, updates);
    if (updated) {
      setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
    }
  }, []);

  const closeTradeEntry = useCallback((id: string, exitPrice: number, pipSize: number) => {
    const closed = closeTradeStorage(id, exitPrice, pipSize);
    if (closed) {
      setEntries((prev) => prev.map((e) => (e.id === id ? closed : e)));
    }
  }, []);

  const deleteTrade = useCallback((id: string) => {
    deleteTradeStorage(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return {
    entries,
    stats,
    addTrade,
    updateTrade,
    closeTrade: closeTradeEntry,
    deleteTrade,
  };
}
