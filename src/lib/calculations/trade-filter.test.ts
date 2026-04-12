import { describe, it, expect } from "vitest";
import { computeTradeFilter } from "./trade-filter";
import type { BiasResult } from "@/lib/types/bias";

function baseBias(overrides: Partial<BiasResult> = {}): BiasResult {
  return {
    instrument: "xauusd",
    overallBias: 20,
    direction: "bullish",
    confidence: 55,
    fundamentalScore: {
      total: 52,
      newsSentiment: 50,
      economicData: 50,
      centralBankPolicy: 50,
      marketSentiment: 50,
      intermarketCorrelation: 50,
    },
    technicalScore: {
      total: 52,
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
    signalAgreement: 0.55,
    ...overrides,
  };
}

describe("computeTradeFilter", () => {
  it("returns no_trade when many checklist gates fail", () => {
    const bias = baseBias({
      tradeSetup: {
        tradeScore: 1,
        projectedMove: { pips: 10, percent: 0.1 },
        stopLoss: 1,
        takeProfit: [2, 3, 4],
        riskReward: [1, 2, 3],
        riskSizing: "normal",
        riskReason: "",
        entryZone: [1, 2],
        checklist: [
          { id: "a", label: "a", pass: false },
          { id: "b", label: "b", pass: false },
          { id: "c", label: "c", pass: false },
        ],
        confluenceTier: "C",
      },
    });
    expect(computeTradeFilter(bias).verdict).toBe("no_trade");
  });

  it("returns wait when high-impact event imminent", () => {
    const bias = baseBias({
      tradeGuidance: "with_trend",
      timeframeAlignment: "aligned",
      eventGate: {
        hasMajorEventSoon: true,
        minutesUntil: 30,
        impact: "high",
        suggestion: "wait",
      },
      tradeSetup: {
        tradeScore: 1,
        projectedMove: { pips: 10, percent: 0.1 },
        stopLoss: 1,
        takeProfit: [2, 3, 4],
        riskReward: [1, 2, 3],
        riskSizing: "normal",
        riskReason: "",
        entryZone: [1, 2],
        checklist: [
          { id: "a", label: "a", pass: true },
          { id: "b", label: "b", pass: true },
        ],
        confluenceTier: "A",
      },
    });
    expect(computeTradeFilter(bias).verdict).toBe("wait");
  });

  it("returns consider for A-tier aligned with trend and clean gates", () => {
    const bias = baseBias({
      tradeGuidance: "with_trend",
      timeframeAlignment: "aligned",
      eventGate: {
        hasMajorEventSoon: false,
        impact: "low",
        suggestion: "ok",
      },
      tradeSetup: {
        tradeScore: 1,
        projectedMove: { pips: 10, percent: 0.1 },
        stopLoss: 1,
        takeProfit: [2, 3, 4],
        riskReward: [1, 2, 3],
        riskSizing: "normal",
        riskReason: "",
        entryZone: [1, 2],
        checklist: [
          { id: "a", label: "a", pass: true },
          { id: "b", label: "b", pass: true },
        ],
        confluenceTier: "A",
      },
    });
    expect(computeTradeFilter(bias).verdict).toBe("consider");
  });
});
