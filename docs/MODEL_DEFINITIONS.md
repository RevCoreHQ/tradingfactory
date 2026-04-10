# Model definitions (authoritative)

This document matches the implementation in `src/lib/calculations/bias-engine.ts`, `decision-context.ts`, `trade-setup.ts`, and hooks `useBiasScore` / `useAllBiasScores`.

## Headline bias

- **Overall bias** (`overallBias`, −100…+100): weighted blend of **fundamental** and **technical** 0–100 scores, mapped through `(score − 50) × 2` per leg, then combined.
- **Intraday weights**: 70% technical, 30% fundamental (before conflict dampener).
- **Conflict dampener**: when |technicalBiasVal − fundamentalBiasVal| is large, weights shift toward technical (see `calculateOverallBias`).
- **Smoothing** (`useAllBiasScores` only): EMA on `overallBias` with α = 0.5 vs previous tick; **direction** is recomputed from smoothed bias. `useBiasScore` (instrument page) does not apply this EMA.

## Tactical vs structural (decision desk)

- **Tactical** (`tacticalBias`): `calculateOverallBias(fundamentalScore, technical15m, …)` with **only** fundamental `BiasSignal[]` in `allSignals` (no 15m indicator signals in that leg).
- **Structural** (`structuralBias`): same with `technical1h`.
- **Timeframe alignment** (`computeTimeframeAlignment`): compares tactical vs structural **bias numbers** (strong if |bias| > 12); **aligned** / **counter** / **mixed**.

## Desk guidance (`computeTradeGuidance`)

- Uses **edge** = max(|(tactical+structural)/2|, |headline overall bias|) and **confidence** = average of tactical and structural confidence (from those partial `calculateOverallBias` calls).
- Order: imminent high-impact event (90m) → weak edge → counter TF → aligned → pullback/mixed.

## Event gate (`computeEventGate`)

- Next **high** impact event relevant to the instrument within **48h**.
- **hasMajorEventSoon**: true only if that event is within **90 minutes** (checklist “calendar” gate).
- Copy distinguishes **90m caution** vs **later today** so a pass on the checklist can coexist with “next print in ~N h”.

## Market regime (`computeMarketRegime`)

- Inputs: **DXY daily change** (index points from synthetic ICE formula vs prior close), **Fear & Greed** 0–100, **10Y yield change** (FRED `change` field, typically percentage points of yield).
- Labels: `risk_on` | `risk_off` | `neutral` (thresholds in code).

## Fundamental score

- Sub-scores: news, economic placeholders, central banks, fear/greed, intermarket (DXY + yields + curve).
- Weights are **redistributed** when news/banks/bonds are missing (see `calculateFundamentalScore`).
- **Neutral band** for labels in UI/LLM: fund/tech **totals** near 50 are “neutral-leaning”; checklist **F/T coherence** uses bands around 48–52 and mild separation thresholds.

## Technical score

- From `calculateTechnicalScore`: trend (optionally blended with MTF alignment %), momentum, volatility, volume, S/R; weights in `TECHNICAL_WEIGHTS`.
- **Batch** path: blended 15m+1h technicals for the **headline** technical score on the dashboard; single-instrument page may use live chart TF + batch scores when SWR loads.

## Checklist and tier (`appendSetupIntelligence`)

- Seven gates; **A** requires ≥6 passes and **aligned**; **B** ≥4 passes; else **C**.
- See `trade-setup.ts` for exact predicates (signal agreement, confidence, `|overallBias|` ≥ 14, event90m, MTF %, etc.).

### Checklist gate spec (id → inputs)

| id | User-facing label | Pass predicate | Primary inputs |
|----|-------------------|----------------|----------------|
| `tf` | 15m & 1h bias not fighting | `timeframeAlignment !== "counter"` | Tactical vs structural bias from `buildDecisionLayer` / `computeTimeframeAlignment` |
| `ft` | Fundamentals vs technical totals coherent | Both legs >52, both <48, or either total within 6 of 50 | `fundamentalScore.total`, `technicalScore.total` |
| `mtf` | MTF alignment ≥ 45% | `(mtfAlignmentPercent ?? 50) >= 45` | Batch-scores weighted alignment % (same snapshot as optional `mtfEmaSummary`) |
| `agree` | Signal agreement ≥ 42% | `(signalAgreement ?? 0) >= 0.42` | `computeSignalAgreement` on `BiasSignal[]` vs headline direction |
| `conf` | Model confidence ≥ 48% | `confidence >= 48` | Blended confidence from `calculateOverallBias` |
| `edge` | Headline \|bias\| ≥ 14 (blended model) | `abs(overallBias) >= 14` | Smoothed headline on dashboard; raw on instrument page |
| `calendar` | No high-impact print inside 90m (desk rule) | `!eventGate?.hasMajorEventSoon` | `computeEventGate` on economic calendar |

## LLM layer

- Does **not** change scores. Sanitization aligns **outlook**, **catalysts**, and trims **fundamentalReason** / **technicalReason** sentences that lean opposite the desk direction when abs(overallBias) ≥ 15 (see `llm-sanitize.ts`).
