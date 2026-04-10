# Trading Factory — Logic Audit & UI Improvement Plan

## 1. Purpose

- **Logic**: Verify technical and fundamental pipelines are mathematically consistent, correctly wired, and honestly labeled end-to-end.
- **UI**: Reduce cognitive load while preserving nuance—clear hierarchy, harmonized semantics, progressive disclosure.

## 2. Scope

| In scope | Out of scope (unless discovered blocking) |
|----------|---------------------------------------------|
| Fund scoring, tech scoring, batch MTF, headline bias | Broker execution, live order routing |
| Decision desk, event gate, regime, guidance, checklist/tier | Non-app data vendors’ accuracy (FF, Polygon, etc.) |
| LLM narrative merge and contradiction with model | Full prompt-engineering redesign without audit first |
| Instrument cards / analysis views (`InstrumentBriefings`, `InstrumentAnalysis`, `DecisionDeskPanel`) | Unrelated pages (auth, admin) |

## 3. Definitions (to lock in during audit)

Document authoritative meanings in one place (architecture note):

- **Headline bias**: blended technical + fundamental path (+ smoothing rules if any).
- **Tactical / structural**: 15m+fund vs 1h+fund only.
- **Neutral band**: numeric thresholds for “neutral” labels vs colors vs LLM.
- **Signal agreement**: formula and which signals are included/excluded.
- **Event gate**: 90m “caution” vs 48h “upcoming”—copy must not read as contradictory to checklist.

## 4. Phases & deliverables

### Phase A — Fundamental pipeline

**Activities**

- Inventory inputs to fundamental scoring (sources, defaults, missing-data behavior).
- Verify weights, sub-score bounds, instrument-specific branches (e.g. gold vs FX).
- Validate calendar relevance, time parsing, impact filtering, and event copy vs checklist semantics.
- Validate regime inputs (DXY, fear/greed, yields): units, signs, thresholds.

**Deliverables**

- Input → score trace for2–3 fixtures (including XAU/USD).
- List of anomalies (double-counting, cliffs, stale defaults).

**Exit criteria**

- Every sub-score and total explainable from documented inputs; event/regime behavior matches spec.

---

### Phase B — Technical pipeline

**Activities**

- Audit `batch-scores`: candle minimums, 15m/1h/blend paths, `technicalBasis` truthfulness.
- Audit `calculateTechnicalScore` and indicator → sub-score mapping.
- Audit MTF alignment % vs per-TF EMA display (no silent mismatch).
- Document smoothing: applies to headline only vs all displayed scores.

**Deliverables**

- Same fixtures as Phase A with technical branch annotated.
- Note any divergence between “tape” (e.g. low tech score) and “headline” bias.

**Exit criteria**

- Batch and single-instrument paths consistent; MTF narrative aligns with numbers.

---

### Phase C — Decision desk & checklist

**Activities**

- Trace tactical/structural construction and `computeTimeframeAlignment`.
- Order-of-operations for `computeTradeGuidance` (events, weak edge, counter, aligned, pullback).
- Per checklist item: predicate, data source, failure reason; tier A/B/C rules vs real distributions.
- Resolve cases like “weak edge” copy vs passing checklist rows—same metrics or document different lenses.

**Deliverables**

- Checklist spec table (item ID, pass condition, dependency).
- Contradiction list: real bugs vs labeling issues.

**Exit criteria**

- Tier and guidance always traceable to explicit rules; no unexplained pass/fail.

---

### Phase D — LLM & narrative layer

**Activities**

- Capture exact LLM inputs/outputs merge in `applyLLMAnalysis`.
- Audit catalyst list construction (e.g. duplicate or opposing EMA bullets across TFs).
- Define consistency rules: when narrative may disagree with headline, require explicit framing (“On 15m…”, “Fundamentals suggest…”).

**Deliverables**

- Prompt/input appendix (redacted ok).
- P0 fixes: drop or tag contradictory bullets; align risk/conviction badges to model bands.

**Exit criteria**

- Executive summary does not silently contradict headline without a labeled sub-view.

---

### Phase E — Cross-layer consistency matrix

**Activities**

- Build scenario grid: rows = synthetic/real sessions; columns = headline, fund, tech, tactical, structural, alignment, guidance, tier, regime, event, key checklist failures, LLM one-liner.
- Mark each row “coherent” or “explainable multi-lens” vs “bug.”

**Deliverables**

- Spreadsheet or markdown table (10+ rows minimum).
- P0/P1/P2 issue backlog linked to code paths.

**Exit criteria**

- No P0 unexplained contradictions; P1s have UI or copy mitigation plan.

---

### Phase F — UI / information architecture

**Activities**

- **Tier 1**: Hero stance (single primary), confidence, one combined risk line (event + regime as needed).
- **Tier 2**: Fund vs tech summary; optional single row for tactical/structural or MTF (avoid duplication).
- **Tier 3**: Checklist, catalysts, raw pills—accordion / “Details.”
- **Color system**: one meaning per hue (bullish / bearish / neutral / caution / model-neutral).
- **Contradiction UI**: When headline ≠ desk guidance, one data-driven reconciliation line.

**Deliverables**

- Wireframe or annotated screenshot spec; component-level checklist for `InstrumentBriefings` / analysis.
- Implementation tickets sized for1–2 iterations.

**Exit criteria**

- User testing or internal review: primary action clear in &lt;5s for3 gold-path scenarios.

---

### Phase G — Testing & regression

**Activities**

- Golden JSON fixtures: inputs → expected scores/bias/direction/checklist snapshot.
- Optional script or dev-only page: dump all instruments for PR diff.
- Property checks: bounds, monotonicity where required.

**Deliverables**

- `tests/` or `fixtures/` with 5–10 cases; CI hook optional.

**Exit criteria**

- Critical calculation paths covered; regressions caught on change.

---

## 5. Milestones (suggested order)

| Milestone | Combines | Output |
|-----------|----------|--------|
| M1 | A + B (one instrument deep) | Trace doc + first bug list |
| M2 | C + E row fill | Desk/checklist coherence |
| M3 | D | Narrative rules + fixes |
| M4 | F | UI ship (collapsed/expanded, colors) |
| M5 | G | Fixtures + optional CI |

## 6. Roles (fill names as needed)

- **Owner**: single DRI for sign-off on definitions doc.
- **Reviewers**: one person for quant logic, one for UX copy.

## 7. Risks

- **LLM variability**: mitigate with structured post-validation and templated fallback.
- **Data vendor gaps**: document fallbacks; don’t treat missing as neutral without flag.
- **Scope creep**: UI redesign waits on P0 logic fixes where they drive wrong “hero” stance.

## 8. References (code entry points)

- Fundamentals: `src/lib/calculations/bias-engine.ts` (fund scoring, overall bias, agreement).
- Technicals batch: `src/app/api/technicals/batch-scores/route.ts`.
- Decision layer: `src/lib/calculations/decision-context.ts`.
- Setup / checklist / tier: `src/lib/calculations/trade-setup.ts`.
- Hooks / smoothing: `src/lib/hooks/useBiasScore.ts`, `useAllBiasScores.ts`.
- UI: `src/components/dashboard/InstrumentBriefings.tsx`, `InstrumentAnalysis.tsx`, `DecisionDeskPanel.tsx`.

---

*Version: 1.0 — created for execution tracking; update milestones and owners as the team assigns work.*
