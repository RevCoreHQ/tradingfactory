# Decision Engine — Institutional Reference

Version: 1.0 (April 2026)

This document is the authoritative design reference for the stateful trading decision engine added to TradingFactory. It covers architecture, data models, state machine, edge cases, and future roadmap.

---

## 1. Problem statement

The prior system re-evaluated markets on every refresh with no memory:
- Bias changed frequently with no structural justification
- Trade ideas were not tracked across refreshes
- There was no differentiation between "monitoring" and "executing"
- The system acted as a signal generator, not a portfolio manager

The decision engine replaces this with a system that behaves like a professional trading desk with memory, conviction, and structured decision-making.

---

## 2. Architecture

```
[Market data: candles, fundamentals, regime]
        │
        ▼
┌────────────────────────────┐
│  MarketContextEngine       │  src/lib/calculations/market-context-engine.ts
│  - calculateOverallBias    │
│  - deriveHTFStructure      │  ←── computes input hash
│  - detectStructuralBreak   │  ←── BOS/CHoCH on 4H candles
│  - evaluateBiasFlip        │  ←── consistency layer
│  - upsertSnapshot          │  ←── Supabase: bias_snapshots
└────────────┬───────────────┘
             │ committed BiasSnapshot
             ▼
┌────────────────────────────┐
│  TradeIdeaGenerator        │  src/lib/calculations/trade-idea-generator.ts
│  - extractFromAnalyst      │  ←── BiasResult.tradeSetup
│  - extractFromMechanical   │  ←── TradeDeskSetup
│  - mergeCandidates         │
│  - evaluateNewIdea         │  ←── consistency: reject / demote
│  - checkCorrelation        │
│  - isDuplicateIdea / dedup │
│  - createIdea              │  ←── Supabase: trade_ideas
└────────────┬───────────────┘
             │ TradeIdea (state=idea)
             ▼
┌────────────────────────────┐
│  LifecycleEngine           │  src/lib/calculations/lifecycle-engine.ts
│  - ALLOWED_TRANSITIONS     │  ←── table-driven
│  - transition()            │  ←── updates DB + appends log
│  - evaluatePriceTick()     │  ←── auto-advance on price
└────────────┬───────────────┘
             │ all events
             ▼
┌────────────────────────────┐
│  decision_log              │  Supabase: immutable audit trail
│  bias_snapshots            │
│  trade_ideas               │
└────────────┬───────────────┘
             │
             ▼
┌────────────────────────────┐
│  GET /api/decision/snapshot│  src/app/api/decision/snapshot/route.ts
│  DecisionSnapshot envelope │  ←── strict shape, no contradictions
└────────────┬───────────────┘
             │
             ▼
┌────────────────────────────┐
│  useDecisionEngine (SWR)   │  src/lib/hooks/useDecisionEngine.ts
│  IdeaLifecyclePanel        │  src/components/dashboard/IdeaLifecyclePanel.tsx
│  ContradictionBanner       │  src/components/dashboard/ContradictionBanner.tsx
│  CommittedBiasIndicator    │  src/components/dashboard/DecisionDeskPanel.tsx
└────────────────────────────┘
```

---

## 3. Guiding principles

1. **One canonical trade object.** `TradeIdea` is the only thing the UI, risk engine, and journal read. `BiasResult.tradeSetup` and `TradeDeskSetup` are candidate inputs.

2. **Persist first, recompute second.** Every decision writes to Supabase. The UI reads persisted state and decorates it with live data — it never re-derives state from scratch.

3. **State transitions are the only way the world changes.** Direct mutation of idea fields or bias direction is forbidden; everything goes through `transition()` which validates + logs.

4. **Bias is sticky.** A committed `BiasSnapshot` does not flip on every tick; only structural breaks or regime shifts trigger a commit.

5. **Consistency over conviction.** If a new signal contradicts an active idea, the system must either invalidate the prior idea (logged) or mark the new one secondary. Silent bias change is impossible.

---

## 4. Canonical data models

### 4.1 TradeIdea (`src/lib/types/trade-idea.ts`)

```typescript
interface TradeIdea {
  id: string;
  user_id: string;
  instrument: string;
  direction: 'long' | 'short';
  trade_type: 'scalp' | 'intraday' | 'swing';
  priority: 'primary' | 'secondary';
  origin: 'analyst' | 'mechanical' | 'hybrid' | 'manual';

  state: TradeState;
  state_since: string;   // ISO

  entry_zone: { min: number; max: number; ref: number };
  stop_loss: number;
  take_profits: TakeProfit[];

  thesis: string;
  entry_conditions: string[];
  invalidation: IdeaInvalidation;
  confidence: number;

  // Execution state
  executed_at?: string;
  avg_entry_price?: number;
  current_size_r?: number;
  scale_events?: ScaleEvent[];
  realized_r?: number;
  exited_at?: string;

  tags: string[];
  created_at: string;
  updated_at: string;
}
```

### 4.2 BiasSnapshot (`src/lib/types/bias-snapshot.ts`)

Stores committed market context per instrument. Once committed, only changes when structural break occurs.

```typescript
interface BiasSnapshot {
  id: string;
  instrument: string;
  direction: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  regime: 'trending' | 'mean_reversion' | 'expansion' | 'choppy';
  htf_structure: {
    trend_4h: 'up' | 'down' | 'range';
    trend_daily: 'up' | 'down' | 'range';
    key_levels: Array<{ price: number; kind: 'support' | 'resistance' | 'poi' }>;
  };
  inputs_hash: string;    // SHA-256 of material inputs; deduplicates unchanged state
  committed: boolean;
  parent_id?: string;     // prior committed snapshot
  change_reason?: string;
}
```

### 4.3 DecisionLogEntry (`src/lib/types/decision-log.ts`)

Immutable audit trail. Every action the engine takes is logged. Append-only — rows are never updated or deleted.

---

## 5. State machine

```
[*] --> idea: TradeIdeaGenerator.commit()
idea --> watching: price within 1 ATR of entry_zone
watching --> ready: entry_conditions met (price in zone)
watching --> idea: price moved away (no invalidation)
ready --> executed: user confirm OR auto-execute
ready --> watching: trigger reverted
executed --> managing: auto on fill
managing --> scaled: scale-in-detector fires
scaled --> managing: after add logged
managing --> exited: TP or SL hit / manual close
scaled --> exited: TP or SL hit
[any non-terminal] --> invalidated: invalidation triggered
exited --> [*]
invalidated --> [*]
```

### Allowed transitions table (from lifecycle-engine.ts)

| From | To | Trigger |
|------|----|---------|
| idea | watching | price within 1 ATR |
| idea | invalidated | any invalidation condition |
| watching | ready | price inside entry zone |
| watching | idea | price moved away |
| watching | invalidated | any invalidation condition |
| ready | executed | user confirm |
| ready | watching | trigger reverted |
| ready | invalidated | any invalidation condition |
| executed | managing | automatic on fill |
| managing | scaled | scale-in-detector fires |
| managing | exited | TP/SL hit |
| managing | invalidated | HTF break while open |
| scaled | managing | after add logged |
| scaled | exited | TP/SL hit |
| scaled | invalidated | HTF break |

Any transition not in this table throws `TransitionError` and returns `409 TRANSITION_NOT_ALLOWED`.

---

## 6. Decision Consistency Layer

`src/lib/calculations/decision-consistency.ts`

### evaluateNewIdea()

```
candidate (draft) + state (active ideas)
        │
        ├── No opposing active ideas → CREATE (primary)
        │
        ├── Opposing OPEN position (executed/managing/scaled)
        │       → REJECT (open-position-in-opposite-direction)
        │
        └── Opposing pre-execution idea
                → DEMOTE_SECONDARY (pre-execution-conflict)
```

### evaluateBiasFlip()

```
new draft + prior snapshot + structural break signals
        │
        ├── No prior snapshot → COMMIT (initial)
        │
        ├── Same direction as prior
        │       → COMMIT if inputs_hash changed; skip if unchanged
        │
        ├── Direction flip + structuralBreak → COMMIT (structural-change)
        │
        ├── Direction flip + regimeShift → COMMIT (regime-shift)
        │
        └── Direction flip + no structural justification
                → BLOCK (bias_flip_blocked logged)
```

---

## 7. Lifecycle walkthrough — USDJPY long

| T | Event | Persisted outcome |
|---|-------|-------------------|
| T0 | Bullish 4H structure; fundamentals risk-on | `bias_snapshots`: committed=true, direction=bullish, confidence=72 |
| T1 | Analyst + mechanical both propose LONG 148.10–148.30 | `trade_ideas` #a1: state=idea, SL=147.80, TP1=148.80 (1.5R), TP2=149.50 (3R); log: idea_created |
| T2 | Price within 1 ATR of entry zone | #a1.state=watching; log: idea_transition |
| T3 | 15m bearish signal flickers | evaluateNewIdea → REJECT (open-position candidate conflict); log: conflict_blocked |
| T4 | Rejection candle at demand | #a1.state=ready; log: idea_transition |
| T5 | User confirms fill at 148.18 | #a1.state=managing, avg_entry_price=148.18, current_size_r=1; log: idea_executed |
| T6 | Price +1R; scale-in-detector fires | #a1.state=scaled, scale_events appended; log: idea_scaled |
| T7 | TP1 hit, partial close | SL moved to BE; state stays managing; log: idea_transition with payload |
| T8 | TP2 hit | #a1.state=exited, realized_r=2.1; log: idea_exited |
| T9 | New bearish candidate only permitted after T8 or explicit invalidation | |

---

## 8. Edge cases

### Choppy markets
`regime='choppy'` → `TradeIdeaGenerator` refuses to create new `primary` ideas. Existing ideas keep their state. Action logged as `no_action_reasons=['regime_choppy']`.

### Fakeouts / wick hunts
- Entry conditions require **close candle inside zone**, not touch.
- Invalidation uses close-based structure break.
- Stop loss is placed beyond the liquidity pool, not at it.
- `watching → idea` revert (price moved away) avoids premature invalidation.

### News events
- Reuse event gate from `decision-context.ts`.
- 90m pre-window: block `idea_created` and `executed`.
- High-impact post-window: pre-open ideas auto-`invalidated` with reason `news_event_<id>`.
- Executed positions: SL widened (caller's responsibility), not closed.

### Stale snapshot
- If `now - snapshot.created_at > TTL` (4h intraday / 24h swing), force re-evaluation.
- Still only commits on structural change.

### Duplicate ideas
- Same instrument + same direction + entry zones overlap > 50% within 24h → refresh existing idea (bump `updated_at`, append `source_candidate_refs`), not new row.

### Correlation cap
- Max 2 correlated (same currency) ideas at any time.
- New idea in correlated pair enters as `secondary` or is rejected with `correlation_cap_exceeded`.

### HTF break while in a trade
- `market-context-engine` commits new direction → `findIdeasInvalidatedByBiasFlip` → cascade `managing → invalidated`.
- UI shows forced-close recommendation via `ContradictionBanner`.

### User override
- Every block returns a structured `{ code, reason }` error.
- User can POST `/api/decision/ideas/[id]/transition` with `actor='user'` and explicit reason to force a change.
- Still audited in `decision_log`.

---

## 9. API reference

### GET /api/decision/snapshot
Returns `DecisionSnapshot`. No-store cache. Rate: 60/min.

Query params:
- `since` (ISO) — only return log entries newer than this cursor
- `new_window_s` (int) — how many seconds back counts as "new" idea (default: 60)

### GET /api/decision/ideas
Returns `{ active: TradeIdea[], terminal?: TradeIdea[], total_active: number }`. Rate: 120/min.

Query params:
- `include_terminal=true` — also return exited/invalidated ideas
- `limit` (int, max 200)

### POST /api/decision/ideas
Create a manual idea. Body: see `CreateIdeaSchema` in route.ts. Rate: 20/min.

Returns `201 { idea }` on success.
Returns `409 { code: 'CONSISTENCY_BLOCK', reason }` if conflict/correlation block.

### POST /api/decision/ideas/[id]/transition
Transition an idea to a new state. Body: `{ to, reason, payload? }`. Rate: 30/min.

Returns `200 { idea }` on success.
Returns `409 { code: 'TRANSITION_NOT_ALLOWED', from_state, to_state }` if disallowed.

### GET /api/decision/log
Returns `{ entries: DecisionLogEntry[], count, generated_at }`. Rate: 60/min.

Query params:
- `idea_id` (UUID) — filter by idea
- `since` (ISO) — cursor
- `limit` (int, max 500)

---

## 10. Database schema

Tables (all in `public` schema, `supabase/migrations/002_decision_engine.sql`):

- `bias_snapshots` — committed bias per instrument; unique on (user_id, instrument, inputs_hash) where committed=true
- `trade_ideas` — canonical idea rows; all state managed via server API
- `decision_log` — append-only audit trail

All tables:
- RLS enabled; users can only SELECT own rows
- Writes are service-role only (API routes)
- Admin role bypasses RLS for support

---

## 11. Future intelligence upgrades

These are deliberately out of scope until the structure is proven stable, but the architecture is designed to enable them:

1. **Bayesian confidence update** — use realized R distribution from `decision_log` to update per-instrument confidence priors.
2. **Walk-forward calibration** — per-instrument / per-regime entry-condition threshold optimization (already have `walk-forward.ts`).
3. **LLM review agent** — consume `decision_log` nightly; propose rule changes with backtested impact.
4. **Hidden Markov regime model** — replace rule-based regime classifier with probabilistic state estimation.
5. **Auto-SL trailing** — per `trade_type` trailing-stop policies triggered by scale events.
6. **Execution quality log** — slippage, hit-rate of `ready → executed` as new `decision_log` event types.
7. **Peer-correlation heat map** — portfolio-level exposure from live `trade_ideas` fed into `portfolio-risk-gate.ts`.

---

## 12. Security

Every API route:
- `requireAuth()` (session-based, `@/lib/auth/require-auth`)
- `checkUserRateLimit()` (per-user, per-route)
- Zod input validation on all body params and path params
- RLS on all three new tables scoped to `auth.uid()`
- No stack traces to client; errors mapped to `{ error, code, reason }`
- Structured errors for state-machine violations and consistency blocks
- All decisions logged — `decision_log` is the system's conscience
