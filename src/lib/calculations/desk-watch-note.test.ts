import { describe, expect, it } from "vitest";
import type { BiasResult } from "@/lib/types/bias";
import { deskSetupReferencePrice } from "@/lib/calculations/desk-watch-note";

function minimalBias(partial: Partial<BiasResult>): BiasResult {
  return {
    instrument: "XAU_USD",
    overallBias: 0,
    direction: "neutral",
    confidence: 50,
    fundamentalScore: {
      total: 50,
      newsSentiment: 50,
      economicData: 50,
      centralBankPolicy: 50,
      marketSentiment: 50,
      intermarketCorrelation: 50,
    },
    technicalScore: {
      total: 50,
      trendDirection: 50,
      momentum: 50,
      volatility: 50,
      volumeAnalysis: 50,
      supportResistance: 50,
    },
    aiBias: 0,
    timeframe: "intraday",
    timestamp: Date.now(),
    signals: [],
    adr: null,
    tradeSetup: null,
    signalAgreement: 0.5,
    ...partial,
  };
}

const setupShell = {
  tradeScore: 1,
  projectedMove: { pips: 1, percent: 0.1 },
  stopLoss: 1,
  takeProfit: [2, 3, 4] as [number, number, number],
  riskReward: [1, 1, 1] as [number, number, number],
  riskSizing: "normal" as const,
  riskReason: "",
  entryZone: [100.0, 110.0] as [number, number],
};

describe("deskSetupReferencePrice", () => {
  it("uses entry zone low for bearish (anchor is current at lower bound)", () => {
    const b = minimalBias({
      direction: "bearish",
      tradeSetup: { ...setupShell, entryZone: [4746.44, 4782.24] },
    });
    expect(deskSetupReferencePrice(b)).toBe(4746.44);
  });

  it("uses entry zone high for bullish (anchor at upper bound)", () => {
    const b = minimalBias({
      direction: "bullish",
      tradeSetup: { ...setupShell, entryZone: [2600.0, 2650.0] },
    });
    expect(deskSetupReferencePrice(b)).toBe(2650.0);
  });

  it("returns null when no trade setup", () => {
    expect(deskSetupReferencePrice(minimalBias({ tradeSetup: null }))).toBeNull();
  });
});
