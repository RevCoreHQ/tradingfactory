import { describe, it, expect } from "vitest";
import { refineMarketSummary, matchInstrumentIdFromFocusLabel } from "./market-summary-refine";
import type { BiasResult } from "@/lib/types/bias";
import type { MarketSummaryResult } from "@/lib/types/llm";

function bias(partial: Partial<BiasResult>): BiasResult {
  return {
    instrument: "XAU_USD",
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
    ...partial,
  };
}

describe("matchInstrumentIdFromFocusLabel", () => {
  it("matches XAU/USD and compact forms", () => {
    expect(matchInstrumentIdFromFocusLabel("XAU/USD")).toBe("XAU_USD");
    expect(matchInstrumentIdFromFocusLabel("XAUUSD")).toBe("XAU_USD");
  });
});

describe("refineMarketSummary", () => {
  const base: MarketSummaryResult = {
    overview: "Test.",
    risks: [],
    opportunities: ["USD carry theme", "Long XAU/USD on fear"],
    outlook: "neutral",
    timestamp: Date.now(),
    provider: "anthropic",
    focusToday: ["XAU/USD", "EUR/USD"],
  };

  it("moves wait-filter symbols to secondary and strips duplicate tickers from opportunities", () => {
    const results: Record<string, BiasResult> = {
      XAU_USD: bias({
        tradeGuidance: "no_edge",
        tradeSetup: {
          tradeScore: 1,
          projectedMove: { pips: 1, percent: 0.1 },
          stopLoss: 1,
          takeProfit: [2, 3, 4],
          riskReward: [1, 2, 3],
          riskSizing: "normal",
          riskReason: "",
          entryZone: [1, 2],
          checklist: [],
          confluenceTier: "B",
        },
        eventGate: { hasMajorEventSoon: false, impact: "low", suggestion: "" },
      }),
      EUR_USD: bias({
        tradeGuidance: "with_trend",
        timeframeAlignment: "aligned",
        tradeSetup: {
          tradeScore: 1,
          projectedMove: { pips: 1, percent: 0.1 },
          stopLoss: 1,
          takeProfit: [2, 3, 4],
          riskReward: [1, 2, 3],
          riskSizing: "normal",
          riskReason: "",
          entryZone: [1, 2],
          checklist: [],
          confluenceTier: "A",
        },
        eventGate: { hasMajorEventSoon: false, impact: "low", suggestion: "" },
      }),
    };

    const out = refineMarketSummary(base, results);
    expect(out.focusToday).toContain("EUR/USD");
    expect(out.focusTodaySecondary).toContain("XAU/USD");
    expect(out.opportunities.some((o) => o.includes("XAU"))).toBe(false);
    expect(out.opportunities).toContain("USD carry theme");
  });
});
