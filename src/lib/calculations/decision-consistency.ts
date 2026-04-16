// ============================================================
// decision-consistency.ts — the anti-flip-flop guard
//
// Prevents two categories of bad behavior:
// 1. Bias silently flipping direction without structural change
// 2. A new idea contradicting an open position without explicit invalidation
//
// Called by MarketContextEngine (bias) and TradeIdeaGenerator (ideas)
// before any persist operation.
// ============================================================

import type { TradeIdea, TradeIdeaDraft } from '@/lib/types/trade-idea';
import { isLifecycleActive, isOpenPosition } from '@/lib/types/trade-idea';
import type { BiasSnapshot, BiasSnapshotDraft, StructuralBreakSignals } from '@/lib/types/bias-snapshot';

// ── Idea conflict evaluation ──────────────────────────────

export type NewIdeaAction = 'create' | 'reject' | 'demote_secondary';

export interface IdeaEvaluationResult {
  action: NewIdeaAction;
  reason: string;
  /** Present when action === 'demote_secondary': the conflicting idea ids */
  conflicting_ids?: string[];
}

/**
 * Decide what to do with a new idea candidate given existing active ideas.
 *
 * Rules (in priority order):
 * 1. Open position in opposite direction → REJECT entirely.
 *    We do not silently create a counter-idea while money is at risk.
 * 2. Pre-execution idea in opposite direction → DEMOTE to secondary.
 *    Allowed as a contingency plan but must not be primary.
 * 3. No conflict → CREATE as primary.
 *
 * Same-direction ideas:
 * - If an identical idea already exists (same instrument + direction + overlapping zone) → caller should dedup, not this fn.
 * - Multiple same-direction ideas on different setups are fine.
 */
export function evaluateNewIdea(
  candidate: TradeIdeaDraft,
  state: { activeIdeas: TradeIdea[] }
): IdeaEvaluationResult {
  const oppositeActive = state.activeIdeas.filter(
    (i) =>
      i.instrument === candidate.instrument &&
      i.direction !== candidate.direction &&
      isLifecycleActive(i.state)
  );

  if (oppositeActive.length === 0) {
    return { action: 'create', reason: 'no-conflict' };
  }

  // Check for open positions in opposite direction — hard block
  const openOpposite = oppositeActive.filter((i) => isOpenPosition(i.state));
  if (openOpposite.length > 0) {
    return {
      action: 'reject',
      reason: 'open-position-in-opposite-direction',
      conflicting_ids: openOpposite.map((i) => i.id),
    };
  }

  // Pre-execution conflict: demote to secondary
  return {
    action: 'demote_secondary',
    reason: 'pre-execution-conflict-with-active-idea',
    conflicting_ids: oppositeActive.map((i) => i.id),
  };
}

// ── Correlation conflict evaluation ──────────────────────

/** Currency pairs that are highly correlated (positive or negative). */
const POSITIVE_CORR_GROUPS: string[][] = [
  ['EURUSD', 'GBPUSD', 'AUDUSD', 'NZDUSD'],
  ['USDCAD', 'USDCHF', 'USDJPY'],
];
const NEGATIVE_CORR_PAIRS: [string, string][] = [
  ['EURUSD', 'USDCHF'],
  ['GBPUSD', 'USDCHF'],
  ['EURUSD', 'USDCAD'],
];

function extractCurrencies(instrument: string): [string, string] {
  const clean = instrument.replace('/', '').toUpperCase();
  return [clean.slice(0, 3), clean.slice(3, 6)];
}

/**
 * Returns true if two instruments share a currency and therefore
 * add correlated exposure in USD terms.
 */
export function areCorrelated(a: string, b: string): boolean {
  const [ab, aq] = extractCurrencies(a);
  const [bb, bq] = extractCurrencies(b);
  return ab === bb || ab === bq || aq === bb || aq === bq;
}

export interface CorrelationCheckResult {
  blocked: boolean;
  reason: string;
  correlated_ids: string[];
}

/**
 * Check if adding a new idea would breach currency correlation limits.
 * Config: max 2 correlated ideas at any time (same-direction correlated pairs).
 */
export function checkCorrelation(
  candidate: TradeIdeaDraft,
  activeIdeas: TradeIdea[],
  maxCorrelated = 2
): CorrelationCheckResult {
  const correlated = activeIdeas.filter(
    (i) => isLifecycleActive(i.state) && areCorrelated(i.instrument, candidate.instrument)
  );

  if (correlated.length >= maxCorrelated) {
    return {
      blocked: true,
      reason: `correlation_cap_exceeded: ${correlated.length} correlated positions already active`,
      correlated_ids: correlated.map((i) => i.id),
    };
  }

  // Check explicit negative-correlation counter-trade
  for (const [pairA, pairB] of NEGATIVE_CORR_PAIRS) {
    const isA = candidate.instrument === pairA || candidate.instrument === pairB;
    if (!isA) continue;
    const other = candidate.instrument === pairA ? pairB : pairA;
    const openOther = activeIdeas.find(
      (i) => i.instrument === other && isOpenPosition(i.state)
    );
    if (openOther) {
      // A long EURUSD + long USDCHF = conflicting exposure; treat as correlated block
      return {
        blocked: true,
        reason: `negative-correlation conflict with open ${other} position`,
        correlated_ids: [openOther.id],
      };
    }
  }

  return { blocked: false, reason: 'ok', correlated_ids: [] };
}

// ── Bias flip evaluation ──────────────────────────────────

export interface BiasFlipResult {
  commit: boolean;
  reason: string;
}

/**
 * Decide whether a new bias snapshot should be committed.
 *
 * Rules:
 * - No prior snapshot → always commit (initial).
 * - Same direction as prior → commit if inputs_hash changed (refresh).
 * - Direction flip:
 *   - structuralBreak OR regimeShift → commit (legitimate change).
 *   - Neither → BLOCK the flip (noise, not signal).
 */
export function evaluateBiasFlip(
  next: BiasSnapshotDraft,
  prev: BiasSnapshot | null,
  signals: StructuralBreakSignals
): BiasFlipResult {
  if (!prev) {
    return { commit: true, reason: 'initial-snapshot' };
  }

  if (next.direction === prev.direction) {
    const changed = next.inputs_hash !== prev.inputs_hash;
    return {
      commit: changed,
      reason: changed ? 'same-direction-material-change' : 'same-direction-no-change',
    };
  }

  // Direction is flipping
  if (signals.structuralBreak) {
    return { commit: true, reason: signals.reason ?? 'structural-break-detected' };
  }
  if (signals.regimeShift) {
    return { commit: true, reason: signals.reason ?? 'regime-shift-detected' };
  }

  // No structural justification — block the flip
  return {
    commit: false,
    reason: `bias-flip-blocked: ${prev.direction} → ${next.direction} without structural break`,
  };
}

// ── Open-idea cascade check ───────────────────────────────

/**
 * After a bias is committed in a new direction, find any active ideas
 * in the opposite direction that should be flagged for forced invalidation
 * (e.g. open long while bias just became strongly bearish after HTF break).
 *
 * Returns the ids of ideas that the caller should explicitly invalidate.
 */
export function findIdeasInvalidatedByBiasFlip(
  newDirection: 'bullish' | 'bearish' | 'neutral',
  instrument: string,
  activeIdeas: TradeIdea[]
): string[] {
  if (newDirection === 'neutral') return []; // neutral doesn't force-close positions

  const oppositeDir: 'long' | 'short' = newDirection === 'bullish' ? 'short' : 'long';

  return activeIdeas
    .filter(
      (i) =>
        i.instrument === instrument &&
        i.direction === oppositeDir &&
        isLifecycleActive(i.state)
    )
    .map((i) => i.id);
}

// ── Dedup / refresh detection ─────────────────────────────

/**
 * Determine if a draft matches an existing idea close enough to be
 * treated as a refresh (bump updated_at) rather than a new row.
 *
 * Criteria: same instrument + same direction + entry zones overlap > 50%.
 */
export function isDuplicateIdea(
  draft: TradeIdeaDraft,
  existing: TradeIdea,
  windowHours = 24
): boolean {
  if (existing.instrument !== draft.instrument) return false;
  if (existing.direction !== draft.direction) return false;

  const ageMs = Date.now() - new Date(existing.created_at).getTime();
  if (ageMs > windowHours * 3_600_000) return false;

  // Check entry zone overlap > 50%
  const dMin = draft.entry_zone.min;
  const dMax = draft.entry_zone.max;
  const eMin = existing.entry_zone.min;
  const eMax = existing.entry_zone.max;

  const overlapLo = Math.max(dMin, eMin);
  const overlapHi = Math.min(dMax, eMax);
  if (overlapHi <= overlapLo) return false;

  const overlapPct = (overlapHi - overlapLo) / Math.max(dMax - dMin, eMax - eMin, 1);
  return overlapPct > 0.5;
}
