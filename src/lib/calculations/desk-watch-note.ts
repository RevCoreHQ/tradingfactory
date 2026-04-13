import type { BiasResult } from "@/lib/types/bias";
import { formatPrice } from "@/lib/utils/formatters";

/**
 * Reference price used to build mechanical entry zone / stops / TPs (batch technicals last close when available).
 */
export function deskSetupReferencePrice(bias: BiasResult): number | null {
  const ts = bias.tradeSetup;
  if (!ts) return null;
  const [lo, hi] = ts.entryZone;
  return bias.direction.includes("bearish") ? lo : hi;
}

export type DeskZoneState = "approaching" | "at_edge" | "inside" | "exhausted";

export type DeskZoneBasisLabel = "ATR-based" | "Structure-snapped";

export function computeDeskZoneState(
  livePrice: number | undefined,
  lo: number,
  hi: number,
  testCount: number | undefined
): DeskZoneState {
  if (livePrice === undefined || !Number.isFinite(livePrice)) {
    return "approaching";
  }
  const zLo = Math.min(lo, hi);
  const zHi = Math.max(lo, hi);
  const width = zHi - zLo;
  if (width < 1e-12) return "approaching";
  const margin = width * 0.3;

  const inside = livePrice >= zLo && livePrice <= zHi;
  if (inside && testCount != null && testCount >= 3) {
    return "exhausted";
  }
  if (inside) {
    const d = Math.min(livePrice - zLo, zHi - livePrice);
    if (d <= margin) return "at_edge";
    return "inside";
  }

  const distAbove = livePrice - zHi;
  const distBelow = zLo - livePrice;
  if ((distAbove > 0 && distAbove <= margin) || (distBelow > 0 && distBelow <= margin)) {
    return "at_edge";
  }
  return "approaching";
}

function deskZonePrimaryLine(
  state: DeskZoneState,
  bearish: boolean,
  bullish: boolean,
  fmt: (p: number) => string,
  e0: number,
  e1: number
): string {
  const band = `${fmt(e0)} and ${fmt(e1)}`;
  const range = `${fmt(e0)}–${fmt(e1)}`;

  if (bearish) {
    switch (state) {
      case "exhausted":
        return `Zone ${range} has been tested multiple times with fading bounces—wait for a fresh level or a flush above ${fmt(e1)}.`;
      case "at_edge":
        return `Price is nearing the bounce / premium zone (${range})—watch for a reaction.`;
      case "inside":
        return `Price is inside the bounce / premium zone (${range})—look for 15m structure to confirm a short.`;
      case "approaching":
      default:
        return `On a retest higher, the desk frames sells between ${band} (bounce / premium zone).`;
    }
  }
  if (bullish) {
    switch (state) {
      case "exhausted":
        return `Zone ${range} has been tested multiple times with fading bounces—wait for a fresh level or a flush below ${fmt(e0)}.`;
      case "at_edge":
        return `Price is nearing the pullback zone (${range})—watch for a reaction.`;
      case "inside":
        return `Price is inside the pullback zone (${range})—look for 15m structure to confirm entry.`;
      case "approaching":
      default:
        return `On a dip, the desk frames longs between ${band} (discount / pullback zone).`;
    }
  }
  return `No strong directional lean — mechanical scale-in band ${fmt(e0)}–${fmt(e1)} around current activity.`;
}

export interface BuildDeskWatchNoteOptions {
  /** Live mid / bid-ask mid for zone state copy (optional). */
  livePrice?: number;
  /** Supply/demand retest count or similar; ≥3 triggers exhausted copy when price is in-zone. */
  zoneTestCount?: number;
}

/**
 * Plain-language lines for the instrument card: actionable ATR-based zones from `tradeSetup`,
 * with optional live-price-aware wording and structure vs ATR basis.
 */
/** Live vs batch desk ref exceeds this × ATR estimate → show divergence hint. */
export const DESK_REF_DIVERGENCE_ATR_MULT = 0.35;

export function deskRefDivergenceNote(params: {
  livePrice: number | undefined;
  deskRef: number | null;
  atrEstimate: number | undefined;
}): string | null {
  const { livePrice, deskRef, atrEstimate } = params;
  if (
    livePrice == null ||
    deskRef == null ||
    atrEstimate == null ||
    atrEstimate <= 0 ||
    !Number.isFinite(livePrice) ||
    !Number.isFinite(deskRef)
  ) {
    return null;
  }
  if (Math.abs(livePrice - deskRef) <= DESK_REF_DIVERGENCE_ATR_MULT * atrEstimate) {
    return null;
  }
  return `Live price and desk ref differ by more than ${DESK_REF_DIVERGENCE_ATR_MULT}× the model ATR estimate — zone wording may lag until the next technicals refresh.`;
}

export function buildDeskWatchNote(
  bias: BiasResult,
  decimalPlaces: number,
  options?: BuildDeskWatchNoteOptions
): {
  lines: string[];
  footnote: string;
  referenceHint: string;
  zoneBasisLabel: DeskZoneBasisLabel;
} | null {
  const ts = bias.tradeSetup;
  if (!ts) return null;

  const fmt = (p: number) => formatPrice(p, decimalPlaces);
  const [e0, e1] = ts.entryZone;
  const bearish = bias.direction.includes("bearish");
  const bullish = bias.direction.includes("bullish");

  const zoneTestCount = options?.zoneTestCount ?? bias.deskZoneTestCount;
  const state = computeDeskZoneState(options?.livePrice, e0, e1, zoneTestCount);

  const lines: string[] = [];

  if (bearish || bullish) {
    lines.push(deskZonePrimaryLine(state, bearish, bullish, fmt, e0, e1));
  } else {
    lines.push(
      `No strong directional lean — mechanical scale-in band ${fmt(e0)}–${fmt(e1)} around current activity.`
    );
  }

  lines.push(
    `If price accepts beyond ${fmt(ts.stopLoss)}, treat it as invalidating this mechanical lean (ATR stop reference).`
  );

  lines.push(
    `ATR stretch targets: ${fmt(ts.takeProfit[0])} → ${fmt(ts.takeProfit[1])} → ${fmt(ts.takeProfit[2])} (R:R ${ts.riskReward[0]} / ${ts.riskReward[1]} / ${ts.riskReward[2]}).`
  );

  if (ts.riskReason) {
    lines.push(`Sizing: ${ts.riskReason}`);
  }

  const zoneBasisLabel: DeskZoneBasisLabel =
    ts.entryZoneBasis === "structure" ? "Structure-snapped" : "ATR-based";

  const basisExtra =
    zoneBasisLabel === "Structure-snapped"
      ? " Pullback band is tightened to the strongest in-zone pivot / S/R level when available."
      : "";

  return {
    lines,
    footnote:
      "These prices come from the desk’s ATR model, not live chart S/R. Use Deep dive for swing levels, pivots, and confluence." +
      basisExtra,
    referenceHint:
      "Levels use a daily-range volatility model; absolute prices anchor to the same last close as technicals (15m/1h batch). Match symbols when overlaying elsewhere (e.g. OANDA:XAUUSD for Gold).",
    zoneBasisLabel,
  };
}
