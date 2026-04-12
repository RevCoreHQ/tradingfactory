import { describe, expect, it } from "vitest";
import {
  computeEventGate,
  computeTimeframeAlignment,
  computeTradeGuidance,
  describeHeadlineVsDeskTension,
} from "@/lib/calculations/decision-context";
import type { EventGateInfo } from "@/lib/types/bias";
import type { BiasResult } from "@/lib/types/bias";
import type { EconomicEvent } from "@/lib/types/market";

function baseBias(partial: Partial<BiasResult>): BiasResult {
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

const idleGate: EventGateInfo = {
  hasMajorEventSoon: false,
  impact: "low",
  suggestion: "—",
};

describe("computeTradeGuidance", () => {
  it("uses blended confidence for weak edge, not leg average alone", () => {
    const strongBlended = computeTradeGuidance("aligned", idleGate, 22, 25, 68);
    expect(strongBlended.kind).toBe("with_trend");

    const weakBlended = computeTradeGuidance("aligned", idleGate, 22, 25, 30);
    expect(weakBlended.kind).toBe("no_edge");
  });

  it("still flags no_edge when blended is fine but magnitude is tiny", () => {
    const tiny = computeTradeGuidance("aligned", idleGate, 8, 60, 65);
    expect(tiny.kind).toBe("no_edge");
  });
});

describe("computeTimeframeAlignment", () => {
  it("returns counter when both legs strongly disagree in sign", () => {
    expect(computeTimeframeAlignment(20, -20)).toBe("counter");
  });
  it("returns aligned when both legs strongly agree", () => {
    expect(computeTimeframeAlignment(20, 15)).toBe("aligned");
  });
  it("returns mixed when one leg is weak", () => {
    expect(computeTimeframeAlignment(5, 20)).toBe("mixed");
  });
});

describe("computeEventGate", () => {
  const mk = (anchor: Date, minsFromNow: number): EconomicEvent => {
    const d = new Date(anchor.getTime() + minsFromNow * 60_000);
    const iso = d.toISOString().slice(0, 10);
    const time = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
    return {
      id: "t",
      country: "USD",
      event: "CPI",
      date: iso,
      time,
      impact: "high",
      currency: "USD",
    };
  };

  it("marks caution inside 90m and extends suggestion for outside window", () => {
    const now = new Date("2026-06-15T12:00:00Z");
    const soon = computeEventGate([mk(now, 60)], "XAU_USD", now);
    expect(soon.hasMajorEventSoon).toBe(true);

    const later = computeEventGate([mk(now, 180)], "XAU_USD", now);
    expect(later.hasMajorEventSoon).toBe(false);
    expect(later.suggestion).toContain("90m");
  });
});

describe("describeHeadlineVsDeskTension", () => {
  it("returns copy when headline and desk mid disagree in sign", () => {
    const s = describeHeadlineVsDeskTension(
      baseBias({
        overallBias: 25,
        tacticalBias: -15,
        structuralBias: -18,
        tradeGuidance: "pullback",
      })
    );
    expect(s).toBeTruthy();
    expect(s).toContain("Headline");
  });

  it("returns undefined when legs align with headline", () => {
    const s = describeHeadlineVsDeskTension(
      baseBias({
        overallBias: 20,
        tacticalBias: 18,
        structuralBias: 16,
      })
    );
    expect(s).toBeUndefined();
  });
});
