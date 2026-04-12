import type { BiasResult } from "@/lib/types/bias";
import type { MarketSummaryResult } from "@/lib/types/llm";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { computeTradeFilter } from "@/lib/calculations/trade-filter";

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
