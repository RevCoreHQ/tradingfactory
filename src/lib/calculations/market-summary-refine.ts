import type { BiasResult } from "@/lib/types/bias";
import type { MarketSummaryResult } from "@/lib/types/llm";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { computeTradeFilter } from "@/lib/calculations/trade-filter";

/** Strong bias magnitude used when injecting missing instruments into Risk Auditor focus */
export const ADVISOR_STRONG_BIAS_THRESHOLD = 45;

/** Normalize for loose matching: "EUR/USD", "EURUSD", "eurusd" → comparable */
function compactSymbol(s: string): string {
  return s.replace(/[/\s_]/g, "").toUpperCase();
}

/** Resolve a focus chip / label to an instrument id when possible */
export function matchInstrumentIdFromFocusLabel(label: string): string | undefined {
  const t = label.trim();
  if (!t) return undefined;
  const c = compactSymbol(t);
  for (const inst of INSTRUMENTS) {
    const symC = compactSymbol(inst.symbol);
    if (c === symC || t === inst.symbol) return inst.id;
  }
  for (const inst of INSTRUMENTS) {
    if (t.includes(inst.symbol) || t.includes(inst.symbol.replace("/", ""))) return inst.id;
  }
  return undefined;
}

function lineReferencesAnySymbol(line: string, symbols: string[]): boolean {
  const lower = line.toLowerCase();
  for (const sym of symbols) {
    if (lower.includes(sym.toLowerCase())) return true;
    const noSlash = sym.replace("/", "").toLowerCase();
    if (noSlash.length >= 6 && lower.includes(noSlash)) return true;
  }
  return false;
}

/**
 * Split Focus today by trade filter; dedupe opportunity bullets that repeat focus symbols.
 * Keeps Market Intelligence aligned with per-instrument cards.
 */
export function refineMarketSummary(
  summary: MarketSummaryResult,
  biasByInstrument: Record<string, BiasResult>
): MarketSummaryResult {
  const focusRaw = summary.focusToday ?? [];
  const focusPrimary: string[] = [];
  const focusSecondary: string[] = [];

  for (const item of focusRaw) {
    const id = matchInstrumentIdFromFocusLabel(item);
    if (!id || !biasByInstrument[id]) {
      focusPrimary.push(item);
      continue;
    }
    const { verdict } = computeTradeFilter(biasByInstrument[id]);
    if (verdict === "consider" || verdict === "lean") {
      focusPrimary.push(item);
    } else {
      focusSecondary.push(item);
    }
  }

  if (focusPrimary.length === 0 && focusSecondary.length > 0) {
    return {
      ...summary,
      focusToday: focusRaw,
      focusTodaySecondary: undefined,
    };
  }

  const allFocusSymbols = [...new Set([...focusPrimary, ...focusSecondary])]
    .map((x) => {
      const id = matchInstrumentIdFromFocusLabel(x);
      if (!id) return x.trim();
      return INSTRUMENTS.find((i) => i.id === id)?.symbol ?? x.trim();
    })
    .filter(Boolean);

  let opportunities = [...(summary.opportunities ?? [])];
  opportunities = opportunities.filter((line) => !lineReferencesAnySymbol(line, allFocusSymbols));

  return {
    ...summary,
    focusToday: focusPrimary,
    focusTodaySecondary: focusSecondary.length > 0 ? focusSecondary : undefined,
    opportunities,
  };
}

export type AdvisorFocusChip = { symbol: string; action: "LONG" | "SHORT" };

function symbolsLooselyMatch(a: string, b: string): boolean {
  const na = a.replace(/[/\s_]/g, "").toUpperCase();
  const nb = b.replace(/[/\s_]/g, "").toUpperCase();
  return na === nb || a.includes(b) || b.includes(a);
}

function chipListHasSymbol(chips: AdvisorFocusChip[], sym: string): boolean {
  return chips.some((c) => symbolsLooselyMatch(c.symbol, sym));
}

/** Sit-out line references a symbol we are showing in focus/watch */
function sitOutLineReferencesSymbol(line: string, sym: string): boolean {
  const lower = line.toLowerCase();
  const s = sym.toLowerCase();
  if (lower.includes(s)) return true;
  const compact = sym.replace("/", "").toLowerCase();
  return compact.length >= 4 && lower.includes(compact);
}

/**
 * Align Risk Auditor focus chips with the desk trade filter (same brain as Market Intelligence).
 * Injects strong-bias instruments only when missing; routes wait/no_trade to a watch tier.
 */
export function refineAdvisorFocusLists(
  focusToday: AdvisorFocusChip[],
  sitOutToday: string[],
  biasByInstrument: Record<string, BiasResult>,
  options?: { strongThreshold?: number }
): {
  focusToday: AdvisorFocusChip[];
  focusTodaySecondary: AdvisorFocusChip[] | undefined;
  sitOutToday: string[];
} {
  const strongThreshold = options?.strongThreshold ?? ADVISOR_STRONG_BIAS_THRESHOLD;

  const merged: AdvisorFocusChip[] = [...focusToday];

  for (const [id, result] of Object.entries(biasByInstrument)) {
    if (Math.abs(result.overallBias) < strongThreshold) continue;
    const inst = INSTRUMENTS.find((i) => i.id === id);
    if (!inst) continue;
    if (chipListHasSymbol(merged, inst.symbol)) continue;
    const action: "LONG" | "SHORT" = result.overallBias > 0 ? "LONG" : "SHORT";
    merged.push({ symbol: inst.symbol, action });
  }

  const primary: AdvisorFocusChip[] = [];
  const secondary: AdvisorFocusChip[] = [];

  for (const chip of merged) {
    const instId = matchInstrumentIdFromFocusLabel(chip.symbol);
    if (!instId || !biasByInstrument[instId]) {
      primary.push(chip);
      continue;
    }
    const { verdict } = computeTradeFilter(biasByInstrument[instId]);
    if (verdict === "consider" || verdict === "lean") {
      primary.push(chip);
    } else {
      secondary.push(chip);
    }
  }

  let focusPrimary = primary;
  let focusSecondary = secondary;
  if (focusPrimary.length === 0 && focusSecondary.length > 0) {
    focusPrimary = [...focusSecondary];
    focusSecondary = [];
  }

  const allChips = [...focusPrimary, ...focusSecondary];
  const sitFiltered = sitOutToday.filter(
    (line) => !allChips.some((c) => sitOutLineReferencesSymbol(line, c.symbol))
  );

  return {
    focusToday: focusPrimary,
    focusTodaySecondary: focusSecondary.length > 0 ? focusSecondary : undefined,
    sitOutToday: sitFiltered,
  };
}
