import type {
  BiasResult,
  ADRData,
  TradeSetup,
  RiskSizing,
  SetupChecklistItem,
  ConfluenceTier,
  EntryZoneBasis,
} from "@/lib/types/bias";
import type { ADRStoreData } from "@/lib/store/market-store";
import { INSTRUMENTS } from "@/lib/utils/constants";
import type { StructuralSummaryInput } from "@/lib/calculations/structural-levels";
import { collectStructuralLevels } from "@/lib/calculations/structural-levels";

// ==================== ADR CALCULATION ====================

export function calculateADR(
  dailyCandles: { high: number; low: number; close: number }[],
  pipSize: number,
  period: number = 14
): { pips: number; percent: number } | null {
  if (dailyCandles.length < period) return null;
  const recent = dailyCandles.slice(-period);
  const totalRange = recent.reduce((sum, c) => sum + (c.high - c.low), 0);
  const avgRange = totalRange / period;
  const lastClose = recent[recent.length - 1].close;
  return {
    pips: Math.round(avgRange / pipSize),
    percent: Number(((avgRange / lastClose) * 100).toFixed(3)),
  };
}

// ==================== ADR RANKING ====================

export function computeADRRanks(
  adrData: Record<string, ADRStoreData>
): Record<string, ADRData> {
  const entries = Object.entries(adrData);
  if (entries.length === 0) return {};

  // Sort by percent for percentile ranking
  const sorted = [...entries].sort((a, b) => a[1].percent - b[1].percent);

  const result: Record<string, ADRData> = {};
  sorted.forEach(([id, data], idx) => {
    result[id] = {
      pips: data.pips,
      percent: data.percent,
      rank: Math.round((idx / (sorted.length - 1 || 1)) * 100),
    };
  });

  return result;
}

// ==================== TRADE SETUP ====================

export function calculateTradeSetup(
  biasResult: BiasResult,
  atr: number, // ATR value in price units
  adr: ADRData,
  currentPrice: number,
  timeframe: "intraday" | "intraweek"
): TradeSetup {
  const isBearish = biasResult.direction.includes("bearish");
  const biasAbs = Math.abs(biasResult.overallBias);
  const confidenceRatio = biasResult.confidence / 100;

  // --- Trade Score (ADR-weighted conviction) ---
  // adrMultiplier ranges 0.5x (lowest ADR) to 1.5x (highest ADR)
  const adrMultiplier = 0.5 + (adr.rank / 100);
  const tradeScore = (biasAbs * confidenceRatio) * adrMultiplier;

  // --- Projected Move ---
  const inst = INSTRUMENTS.find((i) => i.id === biasResult.instrument);
  const pipSize = inst?.pipSize || 0.0001;
  const adrPriceRange = adr.pips * pipSize;
  const projectedMovePrice = adrPriceRange * (biasAbs / 100) * confidenceRatio;
  const projectedMovePips = Math.round(projectedMovePrice / pipSize);
  const projectedMovePercent = Number(((projectedMovePrice / currentPrice) * 100).toFixed(3));

  // --- Stop Loss ---
  const slMultiplier = timeframe === "intraday" ? 0.75 : 1.5;
  const slDistance = atr * slMultiplier;
  const stopLoss = isBearish
    ? currentPrice + slDistance
    : currentPrice - slDistance;

  // --- Take Profit Levels ---
  // TPs calculated from current price in the direction of the trade
  const tpMultipliers = [1.0, 2.0, 3.0];
  const direction = isBearish ? -1 : 1;

  const takeProfit: [number, number, number] = tpMultipliers.map((mult) =>
    currentPrice + direction * atr * mult
  ) as [number, number, number];

  // --- Risk:Reward Ratios ---
  const riskReward: [number, number, number] = tpMultipliers.map((mult) =>
    Number((mult / slMultiplier).toFixed(1))
  ) as [number, number, number];

  // --- Entry Zone ---
  // Bullish: look to buy on a pullback (zone below current price)
  // Bearish: look to sell on a bounce (zone above current price)
  const entrySpread = atr * 0.25;
  const entryZone: [number, number] = isBearish
    ? [currentPrice, currentPrice + entrySpread]
    : [currentPrice - entrySpread, currentPrice];

  // --- Risk Sizing ---
  const { sizing, reason } = calculateRiskSizing(biasResult, adr);

  const base: TradeSetup = {
    tradeScore: Number(tradeScore.toFixed(1)),
    projectedMove: { pips: projectedMovePips, percent: projectedMovePercent },
    stopLoss,
    takeProfit,
    riskReward,
    riskSizing: sizing,
    riskReason: reason,
    entryZone,
    entryZoneBasis: "atr",
  };
  return appendSetupIntelligence(base, biasResult);
}

export interface RefinedEntryZoneResult {
  entryZone: [number, number];
  basis: EntryZoneBasis;
}

/**
 * Narrows the ATR mechanical entry band toward the strongest in-zone structural level
 * (S/R, pivots, Fib) when one exists inside the original band.
 */
export function refineEntryZone(
  setup: TradeSetup,
  biasResult: BiasResult,
  atr: number,
  anchorPrice: number,
  structural: StructuralSummaryInput | null | undefined
): RefinedEntryZoneResult {
  const [lo, hi] = setup.entryZone;
  if (!structural || atr <= 0 || !Number.isFinite(anchorPrice)) {
    return { entryZone: [lo, hi], basis: setup.entryZoneBasis ?? "atr" };
  }

  const isBearish = biasResult.direction.includes("bearish");
  const isBullish = biasResult.direction.includes("bullish");
  if (!isBearish && !isBullish) {
    return { entryZone: [lo, hi], basis: setup.entryZoneBasis ?? "atr" };
  }

  const levels = collectStructuralLevels(structural, anchorPrice);

  if (isBullish) {
    const candidates = levels.filter(
      (l) => l.type === "support" && l.price >= lo - 1e-9 && l.price <= hi + 1e-9
    );
    if (candidates.length === 0) {
      return { entryZone: [lo, hi], basis: "atr" };
    }
    const best = candidates.sort((a, b) => b.strength - a.strength)[0];
    if (best.price >= hi - 1e-9) {
      return { entryZone: [lo, hi], basis: "atr" };
    }
    const newLo = Math.min(Math.max(best.price, lo), hi);
    if (hi - newLo < atr * 0.05 || Math.abs(newLo - lo) < 1e-6) {
      return { entryZone: [lo, hi], basis: "atr" };
    }
    return { entryZone: [newLo, hi], basis: "structure" };
  }

  const candidates = levels.filter(
    (l) => l.type === "resistance" && l.price >= lo - 1e-9 && l.price <= hi + 1e-9
  );
  if (candidates.length === 0) {
    return { entryZone: [lo, hi], basis: "atr" };
  }
  const best = candidates.sort((a, b) => b.strength - a.strength)[0];
  if (best.price <= lo + 1e-9) {
    return { entryZone: [lo, hi], basis: "atr" };
  }
  const newHi = Math.max(Math.min(best.price, hi), lo);
  if (newHi - lo < atr * 0.05 || Math.abs(newHi - hi) < 1e-6) {
    return { entryZone: [lo, hi], basis: "atr" };
  }
  return { entryZone: [lo, newHi], basis: "structure" };
}

/** Exported for unit tests and golden regression on checklist / tier rules. */
export function appendSetupIntelligence(setup: TradeSetup, bias: BiasResult): TradeSetup {
  const f = bias.fundamentalScore.total;
  const t = bias.technicalScore.total;
  const ftCoherent =
    (f > 52 && t > 52) ||
    (f < 48 && t < 48) ||
    Math.abs(f - 50) < 6 ||
    Math.abs(t - 50) < 6;

  const alignment = bias.timeframeAlignment ?? "mixed";
  const tfPass = alignment !== "counter";
  const agreementPass = (bias.signalAgreement ?? 0) >= 0.42;
  const confPass = bias.confidence >= 48;
  const biasPass = Math.abs(bias.overallBias) >= 14;
  const eventPass = !bias.eventGate?.hasMajorEventSoon;
  const mtfPass = (bias.mtfAlignmentPercent ?? 50) >= 45;

  const checklist: SetupChecklistItem[] = [
    { id: "tf", label: "15m & 1h bias not fighting", pass: tfPass },
    { id: "ft", label: "Fundamentals vs technical totals coherent", pass: ftCoherent },
    { id: "mtf", label: "MTF alignment ≥ 45%", pass: mtfPass },
    { id: "agree", label: "Signal agreement ≥ 42%", pass: agreementPass },
    { id: "conf", label: "Model confidence ≥ 48%", pass: confPass },
    { id: "edge", label: "Headline |bias| ≥ 14 (blended model)", pass: biasPass },
    {
      id: "calendar",
      label: "No high-impact print inside 90m (desk rule)",
      pass: eventPass,
    },
  ];

  const passCount = checklist.filter((c) => c.pass).length;
  let confluenceTier: ConfluenceTier = "C";
  // A-tier requires a real directional edge — avoid A + "weak bias" sizing contradictions.
  if (passCount >= 6 && alignment === "aligned" && biasPass) confluenceTier = "A";
  else if (passCount >= 4) confluenceTier = "B";

  /** A-tier cannot coexist with desk “no edge” — avoids green badge + weak-edge copy. */
  if (confluenceTier === "A" && bias.tradeGuidance === "no_edge") {
    confluenceTier = "B";
  }

  const guidance = bias.tradeGuidanceSummary || "Review checklist before sizing.";
  let tradeStance = guidance;
  if (confluenceTier === "A") tradeStance = `A-tier — ${guidance}`;
  else if (confluenceTier === "C") tradeStance = `C-tier — reduce size or skip. ${guidance}`;

  return { ...setup, checklist, confluenceTier, tradeStance };
}

// ==================== RISK SIZING ====================

function calculateRiskSizing(
  biasResult: BiasResult,
  adr: ADRData
): { sizing: RiskSizing; reason: string } {
  const biasAbs = Math.abs(biasResult.overallBias);
  const { confidence, signalAgreement } = biasResult;

  // Size Up: high conviction + strong agreement + good ADR
  if (confidence >= 75 && biasAbs >= 45 && signalAgreement > 0.7) {
    return {
      sizing: "size_up",
      reason: "High conviction, strong signal agreement, directional confidence",
    };
  }

  // Size Down: low conviction OR poor agreement OR extreme volatility
  // Use same |bias| floor as checklist "edge" gate (≥14) so A-tier cannot pair with weak-edge sizing.
  if (confidence < 45 || biasAbs < 14) {
    return {
      sizing: "size_down",
      reason: confidence < 45
        ? "Low confidence — signals are conflicting"
        : "Weak directional bias — no clear edge",
    };
  }

  if (signalAgreement < 0.35 && biasResult.signals.length > 3) {
    return {
      sizing: "size_down",
      reason: "Poor signal agreement — mixed signals across indicators",
    };
  }

  // Very high ADR with moderate conviction = reduce size (wider stops needed)
  if (adr.rank > 90 && confidence < 65) {
    return {
      sizing: "size_down",
      reason: "High volatility with moderate conviction — wider stops required",
    };
  }

  // Normal: moderate conviction + reasonable agreement
  return {
    sizing: "normal",
    reason: "Standard conviction and signal alignment",
  };
}

// ==================== RANKING ====================

export function rankByTradeScore(
  biasResults: Record<string, BiasResult>,
  adrData: Record<string, ADRData>
): { instrumentId: string; tradeScore: number; biasResult: BiasResult }[] {
  return Object.entries(biasResults)
    .map(([id, result]) => {
      const adr = adrData[id];
      const adrMultiplier = adr ? 0.5 + (adr.rank / 100) : 0.75;
      const biasAbs = Math.abs(result.overallBias);
      const confidenceRatio = result.confidence / 100;
      const tradeScore = (biasAbs * confidenceRatio) * adrMultiplier;
      return { instrumentId: id, tradeScore, biasResult: result };
    })
    .sort((a, b) => b.tradeScore - a.tradeScore);
}
