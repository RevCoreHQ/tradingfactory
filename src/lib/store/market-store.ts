"use client";

import { create } from "zustand";
import type { Instrument } from "@/lib/types/market";
import type { BiasResult } from "@/lib/types/bias";
import type { LLMAnalysisResult } from "@/lib/types/llm";
import type { SmartAlert, AlertConfig } from "@/lib/types/alerts";
import { DEFAULT_ALERT_CONFIG } from "@/lib/types/alerts";
import { INSTRUMENTS } from "@/lib/utils/constants";

export interface ADRStoreData {
  pips: number;
  percent: number;
}

export interface RealtimeQuote {
  price: number;
  timestamp: number;
}

interface MarketStore {
  selectedInstrument: Instrument;
  selectedTimeframe: string;
  biasTimeframe: "intraday" | "intraweek";
  biasResults: Record<string, BiasResult>;
  allBiasResults: {
    intraday: Record<string, BiasResult>;
    intraweek: Record<string, BiasResult>;
  };
  batchLLMResults: Record<string, LLMAnalysisResult> | null;
  batchLLMReady: boolean;
  batchLLMError: string | null;
  adrData: Record<string, ADRStoreData> | null;
  activeTab: string;
  journalOpen: boolean;
  alerts: SmartAlert[];
  alertConfig: AlertConfig;
  realtimeQuotes: Record<string, RealtimeQuote>;
  wsConnected: boolean;
  watchlistIds: string[];
  favoriteIds: string[];
  pinnedIds: string[];
  bootStatus: Record<string, boolean>;

  setSelectedInstrument: (instrument: Instrument) => void;
  setSelectedTimeframe: (timeframe: string) => void;
  setBiasTimeframe: (timeframe: "intraday" | "intraweek") => void;
  setBiasResult: (instrumentId: string, result: BiasResult) => void;
  setAllBiasResults: (timeframe: "intraday" | "intraweek", results: Record<string, BiasResult>) => void;
  setBatchLLMResults: (results: Record<string, LLMAnalysisResult> | null) => void;
  setBatchLLMReady: (ready: boolean) => void;
  setBatchLLMError: (error: string | null) => void;
  setADRData: (data: Record<string, ADRStoreData> | null) => void;
  setActiveTab: (tab: string) => void;
  setJournalOpen: (open: boolean) => void;
  addAlerts: (alerts: SmartAlert[]) => void;
  dismissAlert: (id: string) => void;
  clearAlerts: () => void;
  setAlertConfig: (config: Partial<AlertConfig>) => void;
  updateRealtimePrice: (instrumentId: string, price: number, timestamp: number) => void;
  setWsConnected: (connected: boolean) => void;
  addToWatchlist: (id: string) => void;
  removeFromWatchlist: (id: string) => void;
  toggleFavorite: (id: string) => void;
  togglePin: (id: string) => void;
  setBootReady: (key: string) => void;
}

function loadFavoriteIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem("favoriteIds");
    if (stored) {
      const ids = JSON.parse(stored) as string[];
      return ids.filter((id) => INSTRUMENTS.some((i) => i.id === id));
    }
  } catch {}
  return [];
}

function loadPinnedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem("pinnedIds");
    if (stored) {
      const ids = JSON.parse(stored) as string[];
      return ids.filter((id) => INSTRUMENTS.some((i) => i.id === id));
    }
  } catch {}
  return [];
}

function loadWatchlistIds(): string[] {
  if (typeof window === "undefined") return INSTRUMENTS.map((i) => i.id);
  try {
    const stored = localStorage.getItem("watchlistIds");
    if (stored) {
      const ids = JSON.parse(stored) as string[];
      // Validate: only keep IDs that exist in INSTRUMENTS
      const valid = ids.filter((id) => INSTRUMENTS.some((i) => i.id === id));
      if (valid.length > 0) return valid;
    }
  } catch {}
  return INSTRUMENTS.map((i) => i.id);
}

export const useMarketStore = create<MarketStore>((set) => ({
  selectedInstrument: INSTRUMENTS[0],
  selectedTimeframe: "1h",
  biasTimeframe: "intraday",
  biasResults: {},
  allBiasResults: { intraday: {}, intraweek: {} },
  batchLLMResults: null,
  batchLLMReady: false,
  batchLLMError: null,
  adrData: null,
  activeTab: "overview",
  journalOpen: false,
  alerts: [],
  alertConfig: DEFAULT_ALERT_CONFIG,
  realtimeQuotes: {},
  wsConnected: false,
  watchlistIds: loadWatchlistIds(),
  favoriteIds: loadFavoriteIds(),
  pinnedIds: loadPinnedIds(),
  bootStatus: {},

  setSelectedInstrument: (instrument) => set({ selectedInstrument: instrument }),
  setSelectedTimeframe: (timeframe) => set({ selectedTimeframe: timeframe }),
  setBiasTimeframe: (timeframe) => set({ biasTimeframe: timeframe }),
  setBiasResult: (instrumentId, result) =>
    set((state) => ({
      biasResults: { ...state.biasResults, [instrumentId]: result },
    })),
  setAllBiasResults: (timeframe, results) =>
    set((state) => ({
      allBiasResults: {
        ...state.allBiasResults,
        [timeframe]: results,
      },
    })),
  setBatchLLMResults: (results) => set({ batchLLMResults: results }),
  setBatchLLMReady: (ready) => set({ batchLLMReady: ready }),
  setBatchLLMError: (error) => set({ batchLLMError: error }),
  setADRData: (data) => set({ adrData: data }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setJournalOpen: (open) => set({ journalOpen: open }),
  addAlerts: (newAlerts) =>
    set((state) => ({
      alerts: [...state.alerts, ...newAlerts].slice(-50),
    })),
  dismissAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a)),
    })),
  clearAlerts: () => set({ alerts: [] }),
  setAlertConfig: (partial) =>
    set((state) => ({
      alertConfig: { ...state.alertConfig, ...partial },
    })),
  updateRealtimePrice: (instrumentId, price, timestamp) =>
    set((state) => ({
      realtimeQuotes: {
        ...state.realtimeQuotes,
        [instrumentId]: { price, timestamp },
      },
    })),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  addToWatchlist: (id) =>
    set((state) => {
      if (state.watchlistIds.includes(id)) return state;
      const next = [...state.watchlistIds, id];
      try { localStorage.setItem("watchlistIds", JSON.stringify(next)); } catch {}
      return { watchlistIds: next };
    }),
  removeFromWatchlist: (id) =>
    set((state) => {
      if (state.watchlistIds.length <= 1) return state;
      const next = state.watchlistIds.filter((wid) => wid !== id);
      try { localStorage.setItem("watchlistIds", JSON.stringify(next)); } catch {}
      return { watchlistIds: next };
    }),
  toggleFavorite: (id) =>
    set((state) => {
      const next = state.favoriteIds.includes(id)
        ? state.favoriteIds.filter((fid) => fid !== id)
        : [...state.favoriteIds, id];
      try { localStorage.setItem("favoriteIds", JSON.stringify(next)); } catch {}
      return { favoriteIds: next };
    }),
  togglePin: (id) =>
    set((state) => {
      const next = state.pinnedIds.includes(id)
        ? state.pinnedIds.filter((pid) => pid !== id)
        : [...state.pinnedIds, id];
      try { localStorage.setItem("pinnedIds", JSON.stringify(next)); } catch {}
      return { pinnedIds: next };
    }),
  setBootReady: (key) =>
    set((state) => {
      if (state.bootStatus[key]) return state;
      return { bootStatus: { ...state.bootStatus, [key]: true } };
    }),
}));
