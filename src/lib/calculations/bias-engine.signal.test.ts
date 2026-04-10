import { describe, expect, it } from "vitest";
import { computeSignalAgreement } from "@/lib/calculations/bias-engine";
import type { BiasSignal } from "@/lib/types/bias";

function sig(signal: BiasSignal["signal"], strength = 50): BiasSignal {
  return { source: "t", signal, strength, description: "" };
}

describe("computeSignalAgreement", () => {
  it("returns 0.5 for empty signals", () => {
    expect(computeSignalAgreement([], "bullish")).toBe(0.5);
  });

  it("returns 0.5 for neutral direction", () => {
    expect(computeSignalAgreement([sig("bullish"), sig("bearish")], "neutral")).toBe(0.5);
  });

  it("returns agreeing fraction for bullish direction (ignores neutral votes in denominator)", () => {
    const signals: BiasSignal[] = [
      sig("bullish"),
      sig("bullish"),
      sig("bearish"),
      sig("neutral"),
    ];
    expect(computeSignalAgreement(signals, "bullish")).toBe(2 / 3);
  });

  it("returns agreeing fraction for bearish direction", () => {
    const signals: BiasSignal[] = [sig("bearish"), sig("bearish"), sig("bullish")];
    expect(computeSignalAgreement(signals, "bearish")).toBe(2 / 3);
  });

  it("returns 0.5 when only neutral directional votes exist", () => {
    expect(computeSignalAgreement([sig("neutral"), sig("neutral")], "strong_bullish")).toBe(0.5);
  });

  it("treats strong_bullish like bullish for agreement", () => {
    expect(computeSignalAgreement([sig("bullish"), sig("bearish")], "strong_bullish")).toBe(0.5);
  });
});
