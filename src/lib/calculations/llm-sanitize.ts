import type { BiasDirection } from "@/lib/types/bias";
import type { LLMAnalysisResult } from "@/lib/types/llm";

const BULLISH_LEAN_SRC =
  "\\b(bullish|long bias|longs?\\b|buyers?\\b|accumulation|upside|rally|breakout higher|favo?u?rs? longs?|strong buy)\\b";
const BEARISH_LEAN_SRC =
  "\\b(bearish|short bias|shorts?\\b|sellers?\\b|distribution|downside|selloff|breakdown lower|favo?u?rs? shorts?|strong sell)\\b";

function countLeanTokens(patternSrc: string, text: string): number {
  const m = text.match(new RegExp(patternSrc, "gi"));
  return m ? m.length : 0;
}

/** Per-sentence directional scan: drop sentences that lean the wrong way vs desk model (when bias is strong). */
export function softenReasonAgainstModel(
  text: string | undefined,
  expected: "bullish" | "bearish" | "neutral",
  strongModel: boolean
): string | undefined {
  if (!text?.trim() || !strongModel || expected === "neutral") return text;

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return text;

  const kept: string[] = [];
  let dropped = false;
  for (const s of sentences) {
    const bull = countLeanTokens(BULLISH_LEAN_SRC, s);
    const bear = countLeanTokens(BEARISH_LEAN_SRC, s);
    const conflictsBearish = expected === "bearish" && bull > bear;
    const conflictsBullish = expected === "bullish" && bear > bull;
    if (conflictsBearish || conflictsBullish) {
      dropped = true;
      continue;
    }
    kept.push(s);
  }

  if (kept.length === 0) {
    return `Drivers are mixed; the desk model leans ${expected} — see scores and MTF row for detail.`;
  }
  let out = kept.join(" ");
  if (dropped) {
    out += ` (Some phrasing was trimmed to match the ${expected} desk headline.)`;
  }
  return out;
}

/** Dev-only: true if raw text still leans opposite the expected directional headline. */
export function reasonContradictsModelBias(
  text: string | undefined,
  expected: "bullish" | "bearish" | "neutral"
): boolean {
  if (!text?.trim() || expected === "neutral") return false;
  const bull = countLeanTokens(BULLISH_LEAN_SRC, text);
  const bear = countLeanTokens(BEARISH_LEAN_SRC, text);
  if (expected === "bearish") return bull > bear + 1;
  if (expected === "bullish") return bear > bull + 1;
  return false;
}

export function biasDirectionToLean(direction: BiasDirection): "bullish" | "bearish" | "neutral" {
  if (direction === "strong_bullish" || direction === "bullish") return "bullish";
  if (direction === "strong_bearish" || direction === "bearish") return "bearish";
  return "neutral";
}

function emaCatalystConflict(a: string, b: string): boolean {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (!la.includes("ema") || !lb.includes("ema")) return false;
  const bull = (s: string) => s.includes("bullish") && (s.includes("align") || s.includes(">"));
  const bear = (s: string) => s.includes("bearish") && (s.includes("align") || s.includes("<"));
  return (bull(la) && bear(lb)) || (bear(la) && bull(lb));
}

/** Drop duplicate lines and opposing EMA alignment bullets. */
export function sanitizeCatalysts(catalysts: string[] | undefined): string[] | undefined {
  if (!catalysts?.length) return catalysts;
  const seen = new Set<string>();
  const out: string[] = [];
  let droppedOpposingEma = false;
  for (const raw of catalysts) {
    const c = raw.trim();
    if (!c) continue;
    const key = c.toLowerCase();
    if (seen.has(key)) continue;
    let skip = false;
    for (const ex of out) {
      if (emaCatalystConflict(ex, c)) {
        droppedOpposingEma = true;
        skip = true;
        break;
      }
    }
    if (skip) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= 5) break;
  }
  if (out.length === 0) return undefined;
  if (droppedOpposingEma) {
    out.push("Mixed EMA / structure cues across timeframes — see MTF row on card.");
  }
  return out.slice(0, 6);
}

/**
 * Align LLM outlook (and lightly frame summary) with rule-based bias when they * would otherwise contradict on a directional instrument.
 */
export function sanitizeLLMAnalysisForModel(
  llm: LLMAnalysisResult,
  bias: { direction: BiasDirection; overallBias: number }
): LLMAnalysisResult {
  const expected = biasDirectionToLean(bias.direction);
  const outlook = llm.outlook ?? expected;
  const strong = Math.abs(bias.overallBias) >= 15;
  let nextOutlook = outlook;
  let summary = llm.summary || "";

  if (strong && outlook !== expected && expected !== "neutral") {
    nextOutlook = expected;
    const prefix = `Model direction is ${bias.direction.replace(/_/g, " ")} (blended bias ${bias.overallBias > 0 ? "+" : ""}${Math.round(bias.overallBias)}). `;
    if (!summary.toLowerCase().includes("model")) {
      summary = prefix + summary;
    }
  }

  const catalysts = sanitizeCatalysts(llm.catalysts);

  const fundamentalReason = softenReasonAgainstModel(
    llm.fundamentalReason,
    expected,
    strong
  );
  const technicalReason = softenReasonAgainstModel(
    llm.technicalReason,
    expected,
    strong
  );

  return {
    ...llm,
    outlook: nextOutlook,
    summary,
    catalysts: catalysts ?? llm.catalysts,
    fundamentalReason,
    technicalReason,
  };
}
