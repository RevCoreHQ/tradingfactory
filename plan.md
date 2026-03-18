# Bias Engine Overhaul + Pro Trading Intelligence

## Problem
1. Ranking is purely by absolute bias — slow movers like USDCAD rank high despite being useless for day traders
2. No ADR/volatility weighting — traders need pairs that MOVE
3. No projected move, TP/SL levels, or risk sizing — the tool doesn't help with actual trade decisions
4. F/T weights aren't optimized per timeframe
5. LLM only provides a ±30 adjustment — should provide much richer trade intelligence
6. Conviction board is too sparse — traders need actionable data at a glance

## Architecture

### New Scoring Formula

**Trade Score (what ranks pairs):**
```
tradeScore = (|overallBias| × confidence / 100) × adrMultiplier
```
- `adrMultiplier` = `0.5 + (adrPercentile / 100)` — ranges 0.5x to 1.5x
- High-ADR pairs get boosted, low-ADR pairs get penalized
- A 60-bias GBPUSD (high ADR) outranks a 70-bias USDCAD (low ADR)

**Revised F/T Weights:**

| Timeframe | Technical | Fundamental | AI/LLM |
|-----------|-----------|-------------|--------|
| Intraday  | 60%       | 25%         | 15%    |
| Intraweek | 40%       | 45%         | 15%    |

Currently LLM just does a ±30 post-adjustment. New approach: LLM gets its own 15% weight slice and provides a full -100 to +100 bias opinion, same as F and T.

**Projected Move:**
```
projectedMovePips = ADR × (|overallBias| / 100) × (confidence / 100)
projectedMovePercent = projectedMovePips / currentPrice × 100
```

**TP/SL Levels (ATR-based):**
- SL: entry ± 0.75×ATR (day trade) or 1.5×ATR (swing)
- TP1: entry ± 1.0×ATR (conservative, ~1.3R)
- TP2: entry ± 2.0×ATR (moderate, ~2.7R)
- TP3: entry ± 3.0×ATR (aggressive, ~4R)
- Direction determined by bias direction

**Risk Sizing:**
```
if (confidence ≥ 75 && |bias| ≥ 45 && signalAgreement > 0.8) → "SIZE UP" (green)
if (confidence ≥ 50 && |bias| ≥ 20) → "NORMAL" (neutral)
else → "SIZE DOWN" (amber)
```
Factors: conviction strength, confidence, F/T agreement, volatility regime

---

## Phases

### Phase 1: Types + ADR Pipeline
**Files:** `src/lib/types/bias.ts`, `src/lib/types/llm.ts`, `src/lib/store/market-store.ts`

1. Extend `BiasResult` with new fields:
   ```typescript
   adr: { pips: number; percent: number; rank: number }  // ADR + percentile rank
   tradeSetup: {
     tradeScore: number           // ADR-weighted conviction (ranking metric)
     projectedMove: { pips: number; percent: number }
     stopLoss: number             // Price level
     takeProfit: [number, number, number]  // TP1, TP2, TP3 price levels
     riskReward: [number, number, number]  // R:R for each TP
     riskSizing: "size_up" | "normal" | "size_down"
     riskReason: string           // "High conviction + strong agreement"
   }
   ```

2. Extend `LLMAnalysisResult` with richer fields:
   ```typescript
   keyLevels: { support: number; resistance: number }
   projectedMovePercent: number  // LLM's estimate
   riskAssessment: "low" | "medium" | "high"
   catalysts: string[]           // Key upcoming catalysts
   ```

3. New API route: `/api/technicals/adr` — fetches daily candles for all instruments, returns ADR map
4. New hook: `useADRData()` — SWR with 30min refresh, stores in market-store
5. Add `adrData: Record<string, { pips: number; percent: number }> | null` to store

### Phase 2: Bias Engine Weight Overhaul
**Files:** `src/lib/calculations/bias-engine.ts`

1. New weight system with 3 components (F, T, AI) instead of 2 (F, T) + post-adjustment:
   - `calculateOverallBias()` takes optional `llmBias` parameter (-100 to +100)
   - Intraday: 0.60T + 0.25F + 0.15AI
   - Intraweek: 0.40T + 0.45F + 0.15AI
   - When AI unavailable: redistribute its 15% proportionally

2. Improved confidence calculation:
   - Factor in: F/T agreement, signal count, LLM confidence, data freshness
   - `confidence = baseAgreement × dataQualityMultiplier × llmConfidenceBoost`

3. Signal agreement metric:
   - Count how many signals agree on direction vs disagree
   - `signalAgreement = agreeingSignals / totalSignals`

### Phase 3: Trade Setup Calculator
**Files:** `src/lib/calculations/trade-setup.ts` (NEW)

1. `calculateTradeSetup(biasResult, atr, adr, currentPrice, timeframe)`:
   - Computes projected move from ADR + bias + confidence
   - Computes TP1/TP2/TP3 price levels from ATR
   - Computes SL level from ATR
   - Computes R:R ratios
   - Determines risk sizing recommendation

2. `calculateADR(dailyCandles)`:
   - 14-day average of (high - low) range
   - Returns pips + percent of price

3. `rankByTradeScore(biasResults, adrData)`:
   - Computes tradeScore for each instrument
   - Returns sorted array with percentile ranks

### Phase 4: LLM Prompt Enhancement
**Files:** `src/lib/api/llm-analysis.ts`

1. Expand system prompt to request:
   - Key support/resistance levels the AI identifies
   - Projected move % (AI's own estimate)
   - Risk assessment (low/medium/high)
   - Key catalysts to watch
   - Wider bias range: -50 to +50 (up from ±30)

2. Expand batch prompt similarly

3. Convert LLM from post-adjustment to integrated scoring:
   - LLM returns a full bias opinion (-100 to +100) instead of adjustment
   - This feeds into the 3-way weighted formula

4. Update response parsing + validation

### Phase 5: Data Pipeline Integration
**Files:** `src/lib/hooks/useAllBiasScores.ts`, `src/lib/hooks/useBiasScore.ts`

1. `useAllBiasScores`:
   - Fetch ADR data for all instruments
   - Pass ADR to trade setup calculator
   - Store enhanced BiasResult (with tradeSetup) in market store
   - Sort by tradeScore instead of absolute bias

2. `useBiasScore`:
   - Fetch daily candles for single instrument → compute ADR
   - Integrate trade setup into single-instrument result

### Phase 6: Enhanced Conviction Board UI
**Files:** `src/components/bias/TopPairs.tsx`

Redesign each conviction row to show:

**Collapsed row (always visible):**
```
#1  EUR/USD  ▲ BULLISH  F:62 T:71 AI:68  Score: 87  ADR: 82p (1.1%)  →+47p  SIZE UP
```
- Rank, Symbol, Direction badge, F/T/AI mini scores, Trade score
- ADR in pips + %, Projected move, Risk sizing badge

**Expanded row (click to expand):**
```
Trade Setup:
  Entry zone: 1.0845 – 1.0860
  Stop Loss:  1.0812 (-33p, 0.75×ATR)
  TP1: 1.0890 (+45p, 1.4R)  TP2: 1.0935 (+90p, 2.7R)  TP3: 1.0980 (+135p, 4.1R)

AI Analysis: "EUR supported by ECB hawkish pause, DXY weakness..."
Key Levels: Support 1.0820 | Resistance 1.0920
Catalysts: ECB meeting Thursday, US CPI Friday
Risk: NORMAL — moderate conviction, good F/T agreement
```

**Top pick (rank 1) gets an expanded card by default.**

### Phase 7: Instrument Analysis Enhancement
**Files:** `src/components/dashboard/InstrumentAnalysis.tsx`, new `TradeSetupCard.tsx`

1. New `TradeSetupCard` component:
   - Full trade setup with entry, SL, TP1-3, R:R ratios
   - Visual price ladder showing levels relative to current price
   - Risk sizing recommendation with reasoning
   - Projected move bar

2. Place prominently on instrument analysis page (top of left column)

### Phase 8: Build + Verify
- Build verification
- Test with live data
- Commit and push

---

## Files Changed (Summary)
- `src/lib/types/bias.ts` — Extended types
- `src/lib/types/llm.ts` — Extended LLM response types
- `src/lib/calculations/bias-engine.ts` — Weight overhaul, 3-way scoring
- `src/lib/calculations/trade-setup.ts` — NEW: trade setup calculator + ADR
- `src/lib/api/llm-analysis.ts` — Enhanced prompts + wider range
- `src/app/api/technicals/adr/route.ts` — NEW: ADR endpoint
- `src/lib/hooks/useADRData.ts` — NEW: ADR data hook
- `src/lib/hooks/useAllBiasScores.ts` — Integrate ADR + trade setup
- `src/lib/hooks/useBiasScore.ts` — Integrate ADR + trade setup
- `src/lib/store/market-store.ts` — Add adrData field
- `src/components/bias/TopPairs.tsx` — Full redesign with trade setups
- `src/components/dashboard/TradeSetupCard.tsx` — NEW: trade setup card
- `src/components/dashboard/InstrumentAnalysis.tsx` — Add TradeSetupCard
- `src/lib/utils/constants.ts` — ADR refresh interval
