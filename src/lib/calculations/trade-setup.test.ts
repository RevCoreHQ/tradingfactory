import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { appendSetupIntelligence, calculateTradeSetup } from "@/lib/calculations/trade-setup";
import type { BiasResult, TradeSetup } from "@/lib/types/bias";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): {
  id: string;
  bias: Partial<BiasResult>;
  expectedConfluenceTier: string;
  expectedPassCount?: number;
  expectedMinPassCount?: number;
  expectedMaxPassCount?: number;
} {
  const raw = readFileSync(join(__dirname, "../../../tests/fixtures", name), "utf8");
  return JSON.parse(raw) as ReturnType<typeof loadFixture>;
}

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

const baseSetupShell: TradeSetup = {
  tradeScore: 10,
  projectedMove: { pips: 10, percent: 0.1 },
  stopLoss: 1,
  takeProfit: [2, 3, 4],
  riskReward: [1, 1, 1],
  riskSizing: "normal",
  riskReason: "test",
  entryZone: [0.9, 1.1],
};

describe("appendSetupIntelligence", () => {
  it("golden: A-tier when all gates pass and timeframes aligned", () => {
    const fx = loadFixture("trade-setup-tier-a.json");
    const bias = minimalBias(fx.bias as BiasResult);
    const out = appendSetupIntelligence(baseSetupShell, bias);
    expect(out.confluenceTier).toBe(fx.expectedConfluenceTier);
    const n = out.checklist?.filter((c) => c.pass).length ?? 0;
    expect(n).toBeGreaterThanOrEqual(fx.expectedMinPassCount ?? 7);
    expect(out.tradeStance).toContain("A-tier");
  });

  it("golden: B-tier boundary — 5 passes, aligned, blocked from A by calendar + agreement", () => {
    const fx = loadFixture("trade-setup-tier-b-boundary.json");
    const bias = minimalBias(fx.bias as BiasResult);
    const out = appendSetupIntelligence(baseSetupShell, bias);
    expect(out.confluenceTier).toBe(fx.expectedConfluenceTier);
    const n = out.checklist?.filter((c) => c.pass).length ?? 0;
    expect(n).toBe(fx.expectedPassCount);
    expect(out.confluenceTier).toBe("B");
  });

  it("golden: C-tier when fewer than 4 gates pass", () => {
    const fx = loadFixture("trade-setup-tier-c.json");
    const bias = minimalBias(fx.bias as BiasResult);
    const out = appendSetupIntelligence(baseSetupShell, bias);
    expect(out.confluenceTier).toBe(fx.expectedConfluenceTier);
    const n = out.checklist?.filter((c) => c.pass).length ?? 0;
    expect(n).toBe(fx.expectedPassCount);
    expect(out.tradeStance).toContain("C-tier");
  });

  it("aligned bullish vs aligned bearish both yield coherent FT checklist pass", () => {
    const bull = appendSetupIntelligence(
      baseSetupShell,
      minimalBias({
        overallBias: 20,
        direction: "bullish",
        timeframeAlignment: "aligned",
        fundamentalScore: { ...minimalBias({}).fundamentalScore, total: 55 },
        technicalScore: { ...minimalBias({}).technicalScore, total: 55 },
        signalAgreement: 0.5,
        confidence: 50,
        mtfAlignmentPercent: 50,
        eventGate: { hasMajorEventSoon: false, impact: "low", suggestion: "" },
      })
    );
    const bear = appendSetupIntelligence(
      baseSetupShell,
      minimalBias({
        overallBias: -20,
        direction: "bearish",
        timeframeAlignment: "aligned",
        fundamentalScore: { ...minimalBias({}).fundamentalScore, total: 44 },
        technicalScore: { ...minimalBias({}).technicalScore, total: 44 },
        signalAgreement: 0.5,
        confidence: 50,
        mtfAlignmentPercent: 50,
        eventGate: { hasMajorEventSoon: false, impact: "low", suggestion: "" },
      })
    );
    expect(bull.checklist?.find((c) => c.id === "ft")?.pass).toBe(true);
    expect(bear.checklist?.find((c) => c.id === "ft")?.pass).toBe(true);
  });

  it("headline vs desk tension: counter TF fails tf gate", () => {
    const out = appendSetupIntelligence(
      baseSetupShell,
      minimalBias({
        overallBias: 25,
        direction: "bullish",
        timeframeAlignment: "counter",
        signalAgreement: 0.6,
        confidence: 60,
        mtfAlignmentPercent: 60,
        fundamentalScore: { ...minimalBias({}).fundamentalScore, total: 55 },
        technicalScore: { ...minimalBias({}).technicalScore, total: 55 },
        eventGate: { hasMajorEventSoon: false, impact: "low", suggestion: "" },
      })
    );
    expect(out.checklist?.find((c) => c.id === "tf")?.pass).toBe(false);
  });
});

describe("calculateTradeSetup integration", () => {
  it("returns checklist and tier on full setup", () => {
    const bias = minimalBias({
      overallBias: 20,
      direction: "bullish",
      timeframeAlignment: "aligned",
      fundamentalScore: { ...minimalBias({}).fundamentalScore, total: 55 },
      technicalScore: { ...minimalBias({}).technicalScore, total: 55 },
      signalAgreement: 0.5,
      confidence: 50,
      mtfAlignmentPercent: 50,
      tradeGuidanceSummary: "Ok",
      eventGate: { hasMajorEventSoon: false, impact: "low", suggestion: "" },
    });
    const adr = { pips: 100, percent: 1, rank: 50 };
    const setup = calculateTradeSetup(bias, 0.01, adr, 2000, "intraday");
    expect(setup.confluenceTier).toBe("A");
    expect(setup.checklist?.length).toBe(7);
  });
});
