import type { EconomicEvent } from "@/lib/types/market";
import type {
  BiasResult,
  BiasSignal,
  FundamentalScore,
  TechnicalScore,
  EventGateInfo,
  TimeframeAlignment,
  MarketRegime,
  TradeGuidanceKind,
  ConfluenceTier,
} from "@/lib/types/bias";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { calculateOverallBias } from "@/lib/calculations/bias-engine";

function eventRelevantToInstrument(ev: EconomicEvent, instrumentId: string): boolean {
  const inst = INSTRUMENTS.find((i) => i.id === instrumentId);
  if (!inst) return false;
  const c = (ev.currency || ev.country || "").toUpperCase().slice(0, 3);
  if (!c) return false;
  if (inst.baseCurrency === c || inst.quoteCurrency === c) return true;
  if (inst.category === "commodity" || inst.category === "crypto" || inst.category === "index") {
    return c === "USD";
  }
  return false;
}

function parseEventTime(ev: EconomicEvent): number | null {
  if (!ev.date) return null;
  const time = ev.time && ev.time.length >= 4 ? ev.time : "12:00";
  const ms = new Date(`${ev.date}T${time}:00`).getTime();
  if (Number.isNaN(ms)) return null;
  return ms;
}

export function computeEventGate(
  events: EconomicEvent[],
  instrumentId: string,
  now: Date = new Date(),
  windowHours = 48,
  cautionWithinMinutes = 90
): EventGateInfo {
  const windowEnd = now.getTime() + windowHours * 3600_000;
  let best: { ms: number; ev: EconomicEvent } | null = null;

  for (const ev of events) {
    if (ev.impact !== "high") continue;
    if (!eventRelevantToInstrument(ev, instrumentId)) continue;
    const ms = parseEventTime(ev);
    if (ms === null || ms <= now.getTime() || ms > windowEnd) continue;
    if (!best || ms < best.ms) best = { ms, ev };
  }

  if (!best) {
    return {
      hasMajorEventSoon: false,
      impact: "low",
      suggestion: "No major calendar prints flagged in the next 48h for this pair.",
    };
  }

  const minutesUntil = Math.round((best.ms - now.getTime()) / 60_000);
  const urgent = minutesUntil <= cautionWithinMinutes;

  return {
    hasMajorEventSoon: urgent,
    minutesUntil,
    eventTitle: best.ev.event,
    impact: best.ev.impact,
    suggestion: urgent
      ? `High-impact data in ~${minutesUntil}m — reduce size or wait for post-release structure.`
      : `Next major print in ~${Math.round(minutesUntil / 60)}h (${best.ev.event}). Outside the 90m execution window — calendar checklist can still pass.`,
  };
}

export function computeMarketRegime(
  dxyChange: number,
  fearGreed: number,
  yield10Change: number
): MarketRegime {
  if (dxyChange > 0.08 && (fearGreed < 38 || yield10Change > 0.04)) return "risk_off";
  if (dxyChange < -0.07 && fearGreed > 58) return "risk_on";
  if (fearGreed < 22) return "risk_off";
  if (fearGreed > 78) return "risk_on";
  return "neutral";
}

export function computeTimeframeAlignment(bias15m: number, bias1h: number): TimeframeAlignment {
  const strong = (x: number) => Math.abs(x) > 12;
  const s15 = Math.sign(bias15m);
  const s1 = Math.sign(bias1h);
  if (strong(bias15m) && strong(bias1h) && s15 !== 0 && s1 !== 0 && s15 !== s1) {
    return "counter";
  }
  if (strong(bias15m) && strong(bias1h) && s15 === s1 && s15 !== 0) {
    return "aligned";
  }
  return "mixed";
}

export function computeTradeGuidance(
  alignment: TimeframeAlignment,
  eventGate: EventGateInfo,
  biasAbs: number,
  confidence: number
): { kind: TradeGuidanceKind; summary: string } {
  if (eventGate.hasMajorEventSoon) {
    return {
      kind: "caution_events",
      summary: "Catalyst risk — favor smaller size or wait for the print to clear.",
    };
  }
  if (biasAbs < 12 || confidence < 38) {
    return {
      kind: "no_edge",
      summary: "Edge is weak — stand aside or favor instruments with clearer alignment.",
    };
  }
  if (alignment === "counter") {
    return {
      kind: "counter_trend_scalp",
      summary: "15m vs 1h disagree — only nimble scalps; tighten risk and use execution TF.",
    };
  }
  if (alignment === "aligned") {
    return {
      kind: "with_trend",
      summary: "Timeframes line up — prioritize continuation setups in the bias direction.",
    };
  }
  return {
    kind: "pullback",
    summary: "Mixed structure — wait for a pullback or breakout that aligns 15m with 1h.",
  };
}

export function buildDecisionLayer(
  instrumentId: string,
  fundamentalScore: FundamentalScore,
  technical15m: TechnicalScore,
  technical1h: TechnicalScore,
  fundSignals: BiasSignal[],
  fearGreedValue: number,
  dxyChange: number,
  yield10Change: number,
  calendarEvents: EconomicEvent[],
  /** Blended headline bias (70/30 tech/fund) so desk guidance is not only mid-TF legs. */
  headlineOverallBias: number
): Pick<
  BiasResult,
  | "tacticalBias"
  | "structuralBias"
  | "timeframeAlignment"
  | "marketRegime"
  | "tradeGuidance"
  | "tradeGuidanceSummary"
  | "eventGate"
> {
  const tactical = calculateOverallBias(
    fundamentalScore,
    technical15m,
    "intraday",
    instrumentId,
    undefined,
    fundSignals
  );
  const structural = calculateOverallBias(
    fundamentalScore,
    technical1h,
    "intraday",
    instrumentId,
    undefined,
    fundSignals
  );

  const timeframeAlignment = computeTimeframeAlignment(tactical.overallBias, structural.overallBias);
  const marketRegime = computeMarketRegime(dxyChange, fearGreedValue, yield10Change);
  const eventGate = computeEventGate(calendarEvents, instrumentId);
  const mid = (tactical.overallBias + structural.overallBias) / 2;
  const midConf = (tactical.confidence + structural.confidence) / 2;
  const edgeAbs = Math.max(Math.abs(mid), Math.abs(headlineOverallBias));
  const { kind, summary } = computeTradeGuidance(
    timeframeAlignment,
    eventGate,
    edgeAbs,
    midConf
  );

  return {
    tacticalBias: tactical.overallBias,
    structuralBias: structural.overallBias,
    timeframeAlignment,
    marketRegime,
    tradeGuidance: kind,
    tradeGuidanceSummary: summary,
    eventGate,
  };
}

/** Short trust line: why the desk landed on this tier / stance (after trade setup exists). */
export function computeDecisionRationale(bias: BiasResult): string | undefined {
  const tier: ConfluenceTier | undefined = bias.tradeSetup?.confluenceTier;
  const checklist = bias.tradeSetup?.checklist;
  const failed = checklist?.filter((c) => !c.pass) ?? [];
  if (!tier && failed.length === 0 && !bias.timeframeAlignment) return undefined;

  const tierPhrase =
    tier === "A"
      ? "A-tier: strong checklist confluence"
      : tier === "B"
        ? "B-tier: partial confluence"
        : tier === "C"
          ? "C-tier: weak confluence"
          : "Confluence pending";

  const miss =
    failed.length > 0
      ? ` — ${failed.length} gate${failed.length > 1 ? "s" : ""} open (${failed
          .slice(0, 2)
          .map((c) => c.label.replace(/\s+/g, " ").slice(0, 42))
          .join("; ")})`
      : checklist?.length
        ? " — all listed gates pass"
        : "";

  const tf =
    bias.timeframeAlignment === "counter"
      ? "15m vs 1h conflict."
      : bias.timeframeAlignment === "aligned"
        ? "15m and 1h agree."
        : bias.timeframeAlignment === "mixed"
          ? "Mixed TF structure."
          : "";

  const regime =
    bias.marketRegime === "risk_off"
      ? "Risk-off backdrop."
      : bias.marketRegime === "risk_on"
        ? "Risk-on backdrop."
        : "";

  const mtf =
    bias.mtfAlignmentPercent !== undefined
      ? `MTF model ${bias.mtfAlignmentPercent}%.`
      : "";

  const parts = [tierPhrase + miss, tf, regime, mtf].filter(Boolean);
  const line = parts.join(" ");
  return line.length > 0 ? line : undefined;
}

/**
 * When headline (blended) and15m/1h+fund legs disagree materially, explain without changing scores.
 */
export function describeHeadlineVsDeskTension(bias: BiasResult): string | undefined {
  const h = bias.overallBias;
  const t = bias.tacticalBias;
  const s = bias.structuralBias;
  if (t === undefined || s === undefined) return undefined;
  const mid = (t + s) / 2;
  const hs = Math.sign(h);
  const ms = Math.sign(mid);
  if (
    hs !== 0 &&
    ms !== 0 &&
    hs !== ms &&
    Math.abs(h) >= 12 &&
    Math.abs(mid) >= 10
  ) {
    return `Headline ${h > 0 ? "+" : ""}${Math.round(h)} blends intraday technicals with fundamentals; 15m/1h+fund legs average ${mid > 0 ? "+" : ""}${Math.round(mid)} — use the desk row for execution timing.`;
  }
  if (
    bias.tradeGuidance === "no_edge" &&
    Math.abs(h) >= 18 &&
    Math.abs(mid) < 12
  ) {
    return `Headline shows directional lean, but 15m/1h+fund legs are weak — desk “no edge” refers to that tactical stack, not necessarily the blended headline alone.`;
  }
  return undefined;
}
