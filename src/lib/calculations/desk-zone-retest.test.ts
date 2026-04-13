import { describe, expect, it } from "vitest";
import { deskZoneTestCountForBias } from "@/lib/calculations/desk-zone-retest";

describe("deskZoneTestCountForBias", () => {
  const hint = { demandTestsInPullbackBand: 4, supplyTestsInBounceBand: 1 };

  it("maps bullish to demand retests", () => {
    expect(deskZoneTestCountForBias(hint, "bullish")).toBe(4);
    expect(deskZoneTestCountForBias(hint, "strong_bullish")).toBe(4);
  });

  it("maps bearish to supply retests", () => {
    expect(deskZoneTestCountForBias(hint, "bearish")).toBe(1);
  });

  it("returns undefined for neutral or missing hint", () => {
    expect(deskZoneTestCountForBias(hint, "neutral")).toBeUndefined();
    expect(deskZoneTestCountForBias(undefined, "bullish")).toBeUndefined();
  });
});
