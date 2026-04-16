// ============================================================
// market-context-engine.ts — stateful bias wrapper
//
// Wraps calculateOverallBias + buildDecisionLayer with:
// - Deterministic input hashing (change only on material moves)
// - Structural-break detection (BOS/CHoCH from market-structure.ts)
// - Commit semantics via decision-consistency.ts evaluateBiasFlip()
// - Supabase persistence + decision_log emit
//
// The result is a "sticky" bias: once committed, it doesn't flip
// unless the market structure genuinely breaks.
// ============================================================

import crypto from 'crypto';
import type { OHLCV } from '@/lib/types/market';
import type { BiasResult, FundamentalScore, TechnicalScore } from '@/lib/types/bias';
import type { FullRegime } from '@/lib/types/signals';
import type { BiasSnapshot, BiasSnapshotDraft, HTFStructure, StructuralBreakSignals } from '@/lib/types/bias-snapshot';
import type { SnapshotDirection, SnapshotRegime } from '@/lib/types/bias-snapshot';
import type { DecisionLogDraft } from '@/lib/types/decision-log';
import { evaluateBiasFlip, findIdeasInvalidatedByBiasFlip } from './decision-consistency';
import { transition } from './lifecycle-engine';
import { upsertSnapshot, getCommittedSnapshot } from '@/lib/storage/bias-snapshot-store';
import { appendLog, appendLogs } from '@/lib/storage/decision-log-store';
import { getActiveIdeas } from '@/lib/storage/trade-ideas-store';
import {
  detectSwingPoints,
  classifySwingPoints,
  detectStructureEvents,
} from './market-structure';

// ── Input hash computation ────────────────────────────────

/**
 * Hash the material inputs that define the market context.
 * Ignores minor noise (e.g. sub-pip price changes).
 * Only changes when something structurally significant shifts.
 */
export function computeInputsHash(
  direction: SnapshotDirection,
  regime: SnapshotRegime,
  fundamentalScore: number,
  technicalScore: number,
  htfStructure: HTFStructure
): string {
  // Round scores to nearest 5 to absorb micro-fluctuations
  const roundedFund = Math.round(fundamentalScore / 5) * 5;
  const roundedTech = Math.round(technicalScore / 5) * 5;
  // Key levels rounded to 2 decimal places
  const levelsKey = htfStructure.key_levels
    .map((l) => `${l.kind}:${l.price.toFixed(2)}`)
    .sort()
    .join(',');

  const raw = [
    direction,
    regime,
    roundedFund,
    roundedTech,
    htfStructure.trend_4h,
    htfStructure.trend_daily,
    levelsKey,
  ].join('|');

  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

// ── Regime mapping ────────────────────────────────────────

function mapFullRegimeToSnapshot(fullRegime: FullRegime | undefined): SnapshotRegime {
  if (!fullRegime) return 'trending';
  switch (fullRegime.structure) {
    case 'breakout':  return 'expansion';
    case 'range':     return 'mean_reversion';
    case 'trend':
      return fullRegime.volatility === 'high' ? 'expansion' : 'trending';
    default:
      return fullRegime.phase === 'accumulation' || fullRegime.phase === 'distribution'
        ? 'mean_reversion'
        : 'trending';
  }
}

function mapBiasDirectionToSnapshot(direction: BiasResult['direction']): SnapshotDirection {
  if (direction === 'bullish' || direction === 'strong_bullish') return 'bullish';
  if (direction === 'bearish' || direction === 'strong_bearish') return 'bearish';
  return 'neutral';
}

// ── HTF structure derivation from candles ─────────────────

function deriveTrend(candles: OHLCV[]): 'up' | 'down' | 'range' {
  if (candles.length < 10) return 'range';
  const swings = classifySwingPoints(detectSwingPoints(candles, 50));
  if (swings.length < 4) return 'range';
  const recents = swings.slice(-4);
  const highs = recents.filter((s) => s.type === 'high');
  const lows  = recents.filter((s) => s.type === 'low');
  if (highs.length >= 2 && lows.length >= 2) {
    const hhhl = highs.every((h, i) => i === 0 || h.price > highs[i - 1].price) &&
                 lows.every((l, i)  => i === 0 || l.price > lows[i - 1].price);
    const lhlh = highs.every((h, i) => i === 0 || h.price < highs[i - 1].price) &&
                 lows.every((l, i)  => i === 0 || l.price < lows[i - 1].price);
    if (hhhl) return 'up';
    if (lhlh) return 'down';
  }
  return 'range';
}

export function deriveHTFStructure(
  candles4h: OHLCV[],
  candlesDaily: OHLCV[]
): HTFStructure {
  const trend4h    = deriveTrend(candles4h);
  const trendDaily = deriveTrend(candlesDaily);

  // Key levels: last 3 significant swing points on 4H
  const swings4h = classifySwingPoints(detectSwingPoints(candles4h, 80)).slice(-6);
  const key_levels = swings4h.map((s) => ({
    price: s.price,
    kind: s.type === 'high' ? 'resistance' as const : 'support' as const,
  }));

  return { trend_4h: trend4h, trend_daily: trendDaily, key_levels };
}

// ── Structural break detection ────────────────────────────

/**
 * Detect whether the market structure has genuinely broken
 * compared to the prior committed snapshot.
 *
 * Uses BOS/CHoCH events from detectStructureEvents on the 4H candles.
 */
export function detectStructuralBreak(
  candles4h: OHLCV[],
  prevSnapshot: BiasSnapshot | null,
  newDirection: SnapshotDirection,
  fullRegime: FullRegime | undefined
): StructuralBreakSignals {
  // No prior snapshot → always treat as initial (no break needed)
  if (!prevSnapshot) return { structuralBreak: false, regimeShift: false };

  // Same direction → never a flip, so break detection irrelevant
  if (prevSnapshot.direction === newDirection) return { structuralBreak: false, regimeShift: false };

  const swings4h = classifySwingPoints(detectSwingPoints(candles4h, 80));
  const structureEvents = detectStructureEvents(candles4h, swings4h);

  const recentEvents = structureEvents.slice(-5);
  const bos  = recentEvents.find((e: import('@/lib/types/signals').StructureEvent) => e.type === 'BOS');
  const choch = recentEvents.find((e: import('@/lib/types/signals').StructureEvent) => e.type === 'CHoCH');

  const bosAligned =
    bos &&
    ((newDirection === 'bullish' && bos.direction === 'bullish') ||
     (newDirection === 'bearish' && bos.direction === 'bearish'));
  const chochAligned =
    choch &&
    ((newDirection === 'bullish' && choch.direction === 'bullish') ||
     (newDirection === 'bearish' && choch.direction === 'bearish'));

  const structuralBreak = !!(bosAligned || chochAligned);

  // Regime shift: phase transition in FullRegime
  const regimeShift = !!(
    fullRegime?.phaseTransition?.isActionable &&
    fullRegime.phaseTransition.to !== fullRegime.phaseTransition.from
  );

  const reason = structuralBreak
    ? `${bosAligned ? 'BOS' : 'CHoCH'} detected on 4H — ${newDirection} structure confirmed`
    : regimeShift
      ? `Phase transition: ${fullRegime?.phaseTransition?.from} → ${fullRegime?.phaseTransition?.to}`
      : undefined;

  return { structuralBreak, regimeShift, reason };
}

// ── Main entry point ──────────────────────────────────────

export interface MarketContextInput {
  userId:            string;
  instrument:        string;
  biasResult:        BiasResult;
  fundamentalScore:  FundamentalScore;
  technicalScore:    TechnicalScore;
  candles4h:         OHLCV[];
  candlesDaily:      OHLCV[];
  fullRegime?:       FullRegime;
}

export interface MarketContextOutput {
  snapshot:   BiasSnapshot;
  committed:  boolean;
  reason:     string;
  /** Ideas that were force-invalidated because bias flipped against them. */
  invalidatedIdeaIds: string[];
}

/**
 * Run the market context engine for one instrument.
 *
 * 1. Compute HTF structure and input hash.
 * 2. Detect structural break vs prior committed snapshot.
 * 3. Evaluate whether to commit (via evaluateBiasFlip).
 * 4. Persist the snapshot (committed or uncommitted).
 * 5. If committed and direction changed, cascade-invalidate opposing ideas.
 * 6. Log everything to decision_log.
 *
 * Safe to call on every price tick — uncommitted snapshots are lightweight
 * and don't trigger cascades.
 */
export async function runMarketContextEngine(
  input: MarketContextInput
): Promise<MarketContextOutput> {
  const {
    userId, instrument, biasResult, fundamentalScore, technicalScore,
    candles4h, candlesDaily, fullRegime,
  } = input;

  // 1. Derive HTF structure
  const htfStructure = deriveHTFStructure(candles4h, candlesDaily);

  // 2. Map bias to snapshot direction / regime
  const direction  = mapBiasDirectionToSnapshot(biasResult.direction);
  const regime     = mapFullRegimeToSnapshot(fullRegime);

  // 3. Input hash (dedup & change detection)
  const inputs_hash = computeInputsHash(
    direction, regime,
    fundamentalScore.total, technicalScore.total,
    htfStructure
  );

  // 4. Load prior committed snapshot
  const prev = await getCommittedSnapshot(userId, instrument);

  // 5. Detect structural break (only relevant when direction would flip)
  const breakSignals = detectStructuralBreak(candles4h, prev, direction, fullRegime);

  // 6. Evaluate commit
  const draft: BiasSnapshotDraft = {
    user_id:           userId,
    instrument,
    direction,
    confidence:        biasResult.confidence,
    regime,
    htf_structure:     htfStructure,
    fundamental_score: fundamentalScore.total,
    technical_score:   technicalScore.total,
    inputs_hash,
    committed:         false,
    parent_id:         prev?.id,
    change_reason:     undefined,
  };

  const flipResult = evaluateBiasFlip(draft, prev, breakSignals);

  draft.committed     = flipResult.commit;
  draft.change_reason = flipResult.reason;

  // 7. Persist snapshot
  const snapshot = await upsertSnapshot(userId, draft);
  if (!snapshot) {
    throw new Error(`[market-context-engine] Failed to persist snapshot for ${instrument}`);
  }

  // 8. Log the commit/block decision
  const logDraft: DecisionLogDraft = {
    user_id:     userId,
    event:       flipResult.commit ? 'bias_committed' : (prev && prev.direction !== direction ? 'bias_flip_blocked' : 'bias_uncommitted'),
    snapshot_id: snapshot.id,
    actor:       'system',
    reason:      flipResult.reason,
    payload: {
      instrument,
      direction,
      confidence: biasResult.confidence,
      regime,
      inputs_hash,
      structural_break: breakSignals.structuralBreak,
      regime_shift:     breakSignals.regimeShift,
    },
  };
  await appendLog(userId, logDraft);

  let invalidatedIdeaIds: string[] = [];

  // 9. If committed and direction changed, cascade-invalidate opposing ideas
  if (flipResult.commit && prev && prev.direction !== direction) {
    const activeIdeas = await getActiveIdeas(userId);
    const toInvalidate = findIdeasInvalidatedByBiasFlip(direction, instrument, activeIdeas);

    if (toInvalidate.length > 0) {
      const logs: DecisionLogDraft[] = [];
      for (const id of toInvalidate) {
        const idea = activeIdeas.find((i) => i.id === id);
        if (!idea) continue;
        await transition(idea, 'invalidated', {
          actor: 'system',
          reason: `HTF bias flipped to ${direction} — ${flipResult.reason}`,
          payload: { snapshot_id: snapshot.id, instrument },
        });
        logs.push({
          user_id:    userId,
          event:      'idea_invalidated',
          idea_id:    id,
          snapshot_id: snapshot.id,
          from_state: idea.state,
          to_state:   'invalidated',
          actor:      'system',
          reason:     `Cascaded from HTF bias flip: ${direction}`,
          payload:    { instrument, snapshot_id: snapshot.id },
        });
      }
      if (logs.length > 0) await appendLogs(userId, logs);
      invalidatedIdeaIds = toInvalidate;
    }
  }

  return {
    snapshot,
    committed:           flipResult.commit,
    reason:              flipResult.reason,
    invalidatedIdeaIds,
  };
}
