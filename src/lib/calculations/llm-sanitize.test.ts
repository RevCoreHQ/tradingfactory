import { describe, expect, it } from "vitest";
import {
  biasDirectionToLean,
  reasonContradictsModelBias,
  sanitizeCatalysts,
  sanitizeLLMAnalysisForModel,
  softenReasonAgainstModel,
} from "@/lib/calculations/llm-sanitize";
import type { LLMAnalysisResult } from "@/lib/types/llm";

describe("biasDirectionToLean", () => {
  it("maps strong and plain directions", () => {
    expect(biasDirectionToLean("strong_bullish")).toBe("bullish");
    expect(biasDirectionToLean("bearish")).toBe("bearish");
    expect(biasDirectionToLean("neutral")).toBe("neutral");
  });
});

describe("softenReasonAgainstModel", () => {
  it("returns unchanged when model not strong", () => {
    const t = "Price is bearish while flows look bullish.";
    expect(softenReasonAgainstModel(t, "bearish", false)).toBe(t);
  });

  it("drops bullish-leaning sentences when desk is bearish", () => {
    const raw =
      "EMAs stack bullish with buyers in control. Yields support a risk-off bid in metals.";
    const out = softenReasonAgainstModel(raw, "bearish", true);
    expect(out).not.toMatch(/buyers in control/i);
    expect(out).toMatch(/yields|risk-off|metals/i);
    expect(out).toMatch(/trimmed/i);
  });

  it("replaces body when every sentence opposes the model", () => {
    const raw = "Structure is strongly bullish. Rally favors longs.";
    const out = softenReasonAgainstModel(raw, "bearish", true);
    expect(out).toContain("desk model leans bearish");
  });
});

describe("reasonContradictsModelBias", () => {
  it("detects leftover bullish copy under bearish expectation", () => {
    expect(reasonContradictsModelBias("Rally favors longs and upside breakout.", "bearish")).toBe(
      true
    );
  });

  it("returns false when balanced or neutral expectation", () => {
    expect(reasonContradictsModelBias("Mixed tape.", "bearish")).toBe(false);
    expect(reasonContradictsModelBias("Strong bullish trend.", "neutral")).toBe(false);
  });
});

describe("sanitizeLLMAnalysisForModel", () => {
  it("aligns outlook and softens contradictory reasons for strong bearish bias", () => {
    const llm: LLMAnalysisResult = {
      biasAdjustment: 0,
      confidence: 70,
      signals: [],
      summary: "Gold catches a bid on flows.",
      outlook: "bullish",
      fundamentalReason: "Real yields dip, which is bullish for metals.",
      technicalReason: "Trend remains bearish on the 4h but intraday is choppy.",
    };
    const out = sanitizeLLMAnalysisForModel(llm, {
      direction: "bearish",
      overallBias: -22,
    });
    expect(out.outlook).toBe("bearish");
    expect(out.fundamentalReason).not.toMatch(/\bbullish\b/i);
    expect(out.technicalReason).toBeTruthy();
  });

  it("leaves reasons alone for neutral weak bias", () => {
    const llm: LLMAnalysisResult = {
      biasAdjustment: 0,
      confidence: 50,
      signals: [],
      summary: "Choppy.",
      fundamentalReason: "Bullish and bearish forces balance.",
      technicalReason: "No edge.",
    };
    const out = sanitizeLLMAnalysisForModel(llm, {
      direction: "neutral",
      overallBias: 4,
    });
    expect(out.fundamentalReason).toContain("Bullish and bearish");
  });
});

describe("sanitizeCatalysts", () => {
  it("dedupes and caps list", () => {
    const c = sanitizeCatalysts(["CPI", "CPI", " FOMC "]);
    expect(c).toEqual(["CPI", "FOMC"]);
  });
});
