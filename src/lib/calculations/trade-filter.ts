import type { BiasResult } from "@/lib/types/bias";

/**
 * Single trading filter for the desk: prioritize “don’t trade” over noisy direction.
 * Conservative defaults when data is missing.
 */
export type TradeFilterVerdict = "no_trade" | "wait" | "lean" | "consider";

export type TradeFilterResult = {
  verdict: TradeFilterVerdict;
  /** Short hero label */
  title: string;
  /** One supporting line */
  subtitle: string;
  /** For tooltips / detail */
  reasons: string[];
  /** When false, desk levels are “planning only” — not a green light */
  emphasizeLevels: boolean;
};

function addReason(reasons: string[], msg: string) {
  if (!reasons.includes(msg)) reasons.push(msg);
}

export function computeTradeFilter(bias: BiasResult): TradeFilterResult {
  const checklist = bias.tradeSetup?.checklist;
  const failCount = checklist?.filter((c) => !c.pass).length ?? 0;
  const tier = bias.tradeSetup?.confluenceTier;
  const agreement = bias.signalAgreement ?? 0.5;
  const conf = bias.confidence;
  const g = bias.tradeGuidance;
  const reasons: string[] = [];

  // --- Hard: do not initiate ---
  if (failCount >= 3) addReason(reasons, "Three or more desk checks failed");
  if (tier === "C" && failCount >= 2) addReason(reasons, "C-tier with multiple failed checks");
  if (g === "no_edge" && conf < 40 && agreement < 0.38) {
    addReason(reasons, "Weak edge plus low confidence and poor signal agreement");
  }

  const noTrade =
    failCount >= 3 ||
    (tier === "C" && failCount >= 2) ||
    (g === "no_edge" && conf < 40 && agreement < 0.38);

  if (noTrade) {
    return {
      verdict: "no_trade",
      title: "Do not initiate new risk",
      subtitle: "Conditions don’t justify opening fresh exposure here.",
      reasons,
      emphasizeLevels: false,
    };
  }

  // --- Wait / stand aside ---
  if (bias.eventGate?.hasMajorEventSoon) addReason(reasons, "High-impact event within ~90 minutes");
  if (g === "no_edge") addReason(reasons, "Desk sees no clear edge (bias magnitude / confidence)");
  if (g === "caution_events") addReason(reasons, "Catalyst risk — favor waiting or smaller size");
  if (bias.timeframeAlignment === "counter") addReason(reasons, "15m vs 1h point opposite directions");
  if (failCount >= 2) addReason(reasons, "Multiple desk checks failed");
  if (tier === "C") addReason(reasons, "C-tier confluence — weak setup quality");
  if (agreement < 0.38) addReason(reasons, "Signals poorly aligned with headline bias");
  if (conf < 42) addReason(reasons, "Low model confidence");

  const wait =
    bias.eventGate?.hasMajorEventSoon ||
    g === "no_edge" ||
    g === "caution_events" ||
    bias.timeframeAlignment === "counter" ||
    failCount >= 2 ||
    tier === "C" ||
    agreement < 0.38 ||
    conf < 42;

  if (wait) {
    return {
      verdict: "wait",
      title: "Stand aside or wait",
      subtitle: "Avoid new trades until structure, calendar, or alignment improves.",
      reasons,
      emphasizeLevels: false,
    };
  }

  // --- Lean: partial edge ---
  if (
    tier === "B" ||
    failCount === 1 ||
    g === "pullback" ||
    bias.timeframeAlignment === "mixed" ||
    g === "counter_trend_scalp"
  ) {
    if (tier === "B") addReason(reasons, "B-tier — only partial confluence");
    if (failCount === 1) addReason(reasons, "One desk check still open");
    if (g === "pullback") addReason(reasons, "Mixed structure — prefer pullback/breakout clarity");
    if (bias.timeframeAlignment === "mixed") addReason(reasons, "Timeframes not cleanly aligned");
    if (g === "counter_trend_scalp") addReason(reasons, "Counter-trend / scalp conditions only");

    return {
      verdict: "lean",
      title: g === "counter_trend_scalp" ? "Nimble / reduced size only" : "Lean only — smaller size",
      subtitle:
        g === "counter_trend_scalp"
          ? "Execution timeframe only; tight risk — not a swing mandate."
          : "Partial edge — be selective and size down.",
      reasons,
      emphasizeLevels: true,
    };
  }

  // --- Consider: strongest bucket ---
  if (tier === "A" && failCount === 0 && g === "with_trend") {
    return {
      verdict: "consider",
      title: "Edge is acceptable",
      subtitle: "A-tier checklist + aligned timeframes — still use your own rules.",
      reasons: [],
      emphasizeLevels: true,
    };
  }

  return {
    verdict: "lean",
    title: "Lean only — smaller size",
    subtitle: "Defaulting to caution — not a full-confluence setup.",
    reasons: [],
    emphasizeLevels: true,
  };
}
