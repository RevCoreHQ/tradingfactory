import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { appendSetupIntelligence, calculateTradeSetup, refineEntryZone } from "@/lib/calculations/trade-setup";
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

  it("does not grant A-tier when headline |bias| is below the edge gate", () => {
    const out = appendSetupIntelligence(
      baseSetupShell,
      minimalBias({
        overallBias: -6,
        direction: "neutral",
        confidence: 74,
        signalAgreement: 0.7,
        timeframeAlignment: "aligned",
        mtfAlignmentPercent: 60,
        fundamentalScore: { ...minimalBias({}).fundamentalScore, total: 51 },
        technicalScore: { ...minimalBias({}).technicalScore, total: 40 },
        eventGate: { hasMajorEventSoon: false, impact: "low", suggestion: "" },
      })
    );
    expect(out.confluenceTier).toBe("B");
    expect(out.checklist?.find((c) => c.id === "edge")?.pass).toBe(false);
  });

  it("downgrades A-tier to B when tradeGuidance is no_edge", () => {
    const out = appendSetupIntelligence(
      baseSetupShell,
      minimalBias({
        overallBias: 22,
        direction: "bullish",
        confidence: 52,
        signalAgreement: 0.55,
        timeframeAlignment: "aligned",
        mtfAlignmentPercent: 62,
        tradeGuidance: "no_edge",
        tradeGuidanceSummary: "Edge is weak — stand aside.",
        eventGate: { hasMajorEventSoon: false, impact: "low", suggestion: "Clear calendar." },
        fundamentalScore: {
          total: 58,
          newsSentiment: 50,
          economicData: 50,
          centralBankPolicy: 50,
          marketSentiment: 50,
          intermarketCorrelation: 50,
        },
        technicalScore: {
          total: 56,
          trendDirection: 50,
          momentum: 50,
          volatility: 50,
          volumeAnalysis: 50,
          supportResistance: 50,
        },
      })
    );
    expect(out.confluenceTier).toBe("B");
  });
});

describe("calculateTradeSetup integration", () => {
  it("anchors entry zone to the provided currentPrice (same vol, different anchor shifts zone)", () => {
    const bias = minimalBias({
      overallBias: -22,
      direction: "bearish",
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
    const atr = 40;
    const lowAnchor = calculateTradeSetup(bias, atr, adr, 4746, "intraday");
    const highAnchor = calculateTradeSetup(bias, atr, adr, 4800, "intraday");
    expect(lowAnchor.entryZone[0]).toBe(4746);
    expect(highAnchor.entryZone[0]).toBe(4800);
    const spreadLow = lowAnchor.entryZone[1] - lowAnchor.entryZone[0];
    const spreadHigh = highAnchor.entryZone[1] - highAnchor.entryZone[0];
    expect(spreadLow).toBeCloseTo(spreadHigh, 5);
  });

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

describe("refineEntryZone", () => {
  it("narrows bullish zone to strongest in-band support", () => {
    const bias = minimalBias({
      direction: "bullish",
      overallBias: 20,
    });
    const setup: TradeSetup = {
      ...baseSetupShell,
      entryZone: [970, 1000],
      entryZoneBasis: "atr",
    };
    const structural = {
      supportResistance: [{ price: 980, type: "support" as const, strength: 5, timeframe: "15m" }],
      pivotPoints: [],
      fibonacci: [],
    };
    const out = refineEntryZone(setup, bias, 120, 1000, structural);
    expect(out.basis).toBe("structure");
    expect(out.entryZone[0]).toBe(980);
    expect(out.entryZone[1]).toBe(1000);
  });

  it("keeps ATR zone when no structural level in band", () => {
    const bias = minimalBias({ direction: "bullish", overallBias: 20 });
    const setup: TradeSetup = { ...baseSetupShell, entryZone: [970, 1000] };
    const structural = {
      supportResistance: [{ price: 900, type: "support" as const, strength: 9, timeframe: "15m" }],
      pivotPoints: [],
      fibonacci: [],
    };
    const out = refineEntryZone(setup, bias, 120, 1000, structural);
    expect(out.basis).toBe("atr");
    expect(out.entryZone).toEqual([970, 1000]);
  });
});
