import { NextResponse } from "next/server";

/**
 * LLM-powered backtest optimization is disabled.
 * Audit finding: LLMs cannot detect overfitting or evaluate statistical significance.
 * Use grid search, Bayesian optimization, or walk-forward validation instead.
 * Mechanical weakness detection (analyzeWeaknesses) still runs client-side.
 */
export async function POST() {
  return NextResponse.json({
    suggestions: [],
    summary: "LLM optimization disabled. Use mechanical weakness detection and manual parameter tuning.",
    confidence: 0,
  });
}
