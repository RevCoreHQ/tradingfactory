"use client";

import { create } from "zustand";
import type { Instrument } from "@/lib/types/market";
import type { BiasResult } from "@/lib/types/bias";
import type { LLMAnalysisResult } from "@/lib/types/llm";
import { INSTRUMENTS } from "@/lib/utils/constants";

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
  activeTab: string;

  setSelectedInstrument: (instrument: Instrument) => void;
  setSelectedTimeframe: (timeframe: string) => void;
  setBiasTimeframe: (timeframe: "intraday" | "intraweek") => void;
  setBiasResult: (instrumentId: string, result: BiasResult) => void;
  setAllBiasResults: (timeframe: "intraday" | "intraweek", results: Record<string, BiasResult>) => void;
  setBatchLLMResults: (results: Record<string, LLMAnalysisResult> | null) => void;
  setActiveTab: (tab: string) => void;
}

export const useMarketStore = create<MarketStore>((set) => ({
  selectedInstrument: INSTRUMENTS[0],
  selectedTimeframe: "1h",
  biasTimeframe: "intraday",
  biasResults: {},
  allBiasResults: { intraday: {}, intraweek: {} },
  batchLLMResults: null,
  activeTab: "overview",

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
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
