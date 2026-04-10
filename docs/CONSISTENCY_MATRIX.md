# Consistency matrix (scenario review)

Synthetic scenarios for cross-layer checks. Tag: **OK** = coherent or explainable multi-lens; **FIX** = requires code/copy change.

| # | Scenario | Headline | Fund | Tech | Tactical | Structural | Align | Guidance | Tier driver | Regime | Event | Notes |
|---|----------|----------|------|------|----------|------------|-------|----------|-------------|--------|-------|-------|
| 1 | Strong bull, TF aligned | +45 | 58 | 62 | +40 | +38 | aligned | with_trend | A possible | neutral | none | OK |
| 2 | Bull headline, bear tactical legs | +22 | 52 | 48 | -10 | -8 | counter | counter_trend_scalp | B/C | neutral | none | OK — tension line |
| 3 | Headline bull, weak mid legs | +24 | 51 | 55 | -5 | -4 | mixed | no_edge pre-fix | checklist | neutral | none | FIX→fixed: edge uses max(\|mid\|,\|headline\|) |
| 4 | CPI in 45m | +18 | 55 | 52 | +10 | +12 | aligned | caution_events | calendar fail | neutral | urgent | OK |
| 5 | CPI in 4h | +18 | 55 | 52 | +10 | +12 | aligned | with_trend | calendar pass | neutral | later | OK — copy cites 90m |
| 6 | Sparse news, FG only | +5 | ~50 | 48 | +2 | +1 | mixed | no_edge | low conf | neutral | none | OK |
| 7 | FT conflict80+ spread | -30 | 70 | 25 | — | — | — | — | tech-heavy | — | — | OK — dampener |
| 8 | Gold, DXY up intraday | — | <50 | — | — | — | — | — | intermarket bear | risk_off? | — | OK — DXY change from snapshot |
| 9 | LLM outlook bear, model bull | +28 | — | — | — | — | — | — | — | — | — | FIX→sanitizer aligns outlook |
| 10 | Duplicate EMA catalysts | — | — | — | — | — | — | — | — | — | — | FIX→sanitizeCatalysts |

Review quarterly or when changing `bias-engine`, `decision-context`, or LLM prompts.

## Golden fixture traces (trade setup / tier)

End-to-end **checklist + tier** regression lives in Vitest (`src/lib/calculations/trade-setup.test.ts`) with JSON under `tests/fixtures/`. Use these rows to map a fixture id to expected desk posture.

| Fixture id (JSON `id`) | File | Expected tier | Pass count (checklist) | Notes |
|------------------------|------|----------------|-------------------------|--------|
| `tier-a-aligned-all-gates` | [tests/fixtures/trade-setup-tier-a.json](../tests/fixtures/trade-setup-tier-a.json) | A | 7 | Aligned TF, strong fund/tech coherence, calendar clear, MTF and agreement gates pass |
| `tier-b-five-passes-aligned-not-a` | [tests/fixtures/trade-setup-tier-b-boundary.json](../tests/fixtures/trade-setup-tier-b-boundary.json) | B | 5 | Still **aligned** on TF, but calendar + agreement fail — blocks A (needs 6 passes + aligned) |
| `tier-c-weak-gates-mixed-tf` | [tests/fixtures/trade-setup-tier-c.json](../tests/fixtures/trade-setup-tier-c.json) | C | 3 | Mixed TF, incoherent F/T, low MTF / agreement / confidence — **edge** still passes so some gates light |

**How to verify:** run `npm test` (uses `cross-env TZ=UTC` for stable date logic in calendar tests). For headline vs desk tension and event windows, see `src/lib/calculations/decision-context.test.ts`.
