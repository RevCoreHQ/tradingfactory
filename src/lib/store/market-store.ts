"use client";

import { create } from "zustand";
import type { Instrument } from "@/lib/types/market";
import type { BiasResult } from "@/lib/types/bias";
import { INSTRUMENTS } from "@/lib/utils/constants";

interface MarketStore {
  selectedInstrument: Instrument;
  selectedTimeframe: string;
  biasTimeframe: "intraday" | "intraweek";
  biasResults: Record<string, BiasResult>;
  activeTab: string;

  setSelectedInstrument: (instrument: Instrument) => void;
  setSelectedTimeframe: (timeframe: string) => void;
  setBiasTimeframe: (timeframe: "intraday" | "intraweek") => void;
  setBiasResult: (instrumentId: string, result: BiasResult) => void;
  setActiveTab: (tab: string) => void;
}

export const useMarketStore = create<MarketStore>((set) => ({
  selectedInstrument: INSTRUMENTS[0],
  selectedTimeframe: "1h",
  biasTimeframe: "intraday",
  biasResults: {},
  activeTab: "overview",

  setSelectedInstrument: (instrument) => set({ selectedInstrument: instrument }),
  setSelectedTimeframe: (timeframe) => set({ selectedTimeframe: timeframe }),
  setBiasTimeframe: (timeframe) => set({ biasTimeframe: timeframe }),
  setBiasResult: (instrumentId, result) =>
    set((state) => ({
      biasResults: { ...state.biasResults, [instrumentId]: result },
    })),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
