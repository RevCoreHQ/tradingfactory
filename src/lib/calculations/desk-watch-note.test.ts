import { describe, expect, it } from "vitest";
import {
  computeDeskZoneState,
  deskRefDivergenceNote,
  DESK_REF_DIVERGENCE_ATR_MULT,
} from "@/lib/calculations/desk-watch-note";

describe("computeDeskZoneState", () => {
  it("defaults to approaching without live price", () => {
    expect(computeDeskZoneState(undefined, 100, 110, undefined)).toBe("approaching");
  });

  it("detects inside mid-band", () => {
    expect(computeDeskZoneState(105, 100, 110, undefined)).toBe("inside");
  });

  it("detects at_edge when hugging zone boundary inside", () => {
    expect(computeDeskZoneState(100.5, 100, 110, undefined)).toBe("at_edge");
  });

  it("detects exhausted when in zone and test count high", () => {
    expect(computeDeskZoneState(105, 100, 110, 4)).toBe("exhausted");
  });

  it("detects approaching when far above zone", () => {
    expect(computeDeskZoneState(120, 100, 110, undefined)).toBe("approaching");
  });
});

describe("deskRefDivergenceNote", () => {
  it("returns null when within ATR threshold", () => {
    expect(
      deskRefDivergenceNote({ livePrice: 100.1, deskRef: 100, atrEstimate: 1 })
    ).toBeNull();
  });

  it("returns a message when beyond threshold", () => {
    const msg = deskRefDivergenceNote({ livePrice: 100.5, deskRef: 100, atrEstimate: 1 });
    expect(msg).toContain(String(DESK_REF_DIVERGENCE_ATR_MULT));
    expect(msg).toContain("technicals refresh");
  });
});
