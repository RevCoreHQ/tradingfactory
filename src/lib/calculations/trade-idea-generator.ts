// ============================================================
// trade-idea-generator.ts — fuse analyst + mechanical candidates
// into a single canonical TradeIdea
//
// Inputs: committed BiasSnapshot + BiasResult.tradeSetup (analyst)
//         + TradeDeskSetup (mechanical)
// Output: TradeIdea persisted in Supabase (or null if blocked)
//
// Pipeline:
// 1. Build draft from best available candidate
// 2. Classify (scalp/intraday/swing)
// 3. Evaluate against active ideas (consistency layer)
// 4. Dedup check against recent non-terminal ideas
// 5. Persist and log
// ============================================================

import type { TradeIdeaDraft, TakeProfit, IdeaInvalidation, IdeaOrigin } from '@/lib/types/trade-idea';
import type { BiasSnapshot } from '@/lib/types/bias-snapshot';
import type { BiasResult, TradeSetup } from '@/lib/types/bias';
import type { TradeDeskSetup } from '@/lib/types/signals';
import type { DecisionLogDraft } from '@/lib/types/decision-log';
import {
  evaluateNewIdea,
  checkCorrelation,
  isDuplicateIdea,
} from './decision-consistency';
import {
  classifyTradeType,
  slInATR,
  getIdeaExpiry,
} from './trade-classifier';
import { createIdea, getActiveIdeas } from '@/lib/storage/trade-ideas-store';
import { appendLog } from '@/lib/storage/decision-log-store';
import { INSTRUMENTS } from '@/lib/utils/constants';

// ── Candidate wrappers ────────────────────────────────────

export interface AnalystCandidate {
  kind: 'analyst';
  setup: TradeSetup;
  biasResult: BiasResult;
}

export interface MechanicalCandidate {
  kind: 'mechanical';
  setup: TradeDeskSetup;
}

export type IdeaCandidate = AnalystCandidate | MechanicalCandidate;

// ── Level extraction ──────────────────────────────────────

function extractFromAnalyst(
  c: AnalystCandidate,
  snapshot: BiasSnapshot
): TradeIdeaDraft | null {
  const { setup, biasResult } = c;
  if (!setup) return null;

  const isBearish = biasResult.direction.includes('bearish');
  const direction: 'long' | 'short' = isBearish ? 'short' : 'long';
  const entryZone = { min: setup.entryZone[0], max: setup.entryZone[1], ref: (setup.entryZone[0] + setup.entryZone[1]) / 2 };
  const inst = INSTRUMENTS.find((i) => i.id === biasResult.instrument);
  const pipSize = inst?.pipSize ?? 0.0001;

  const take_profits: TakeProfit[] = setup.takeProfit.map((level, idx) => ({
    level,
    r_multiple: setup.riskReward[idx] ?? idx + 1,
    weight: idx === 0 ? 0.5 : idx === 1 ? 0.3 : 0.2,
  }));

  const slDist = slInATR(entryZone.ref, setup.stopLoss, entryZone.ref * 0.001 || 0.001);

  const tradeClassification = classifyTradeType({
    slDistanceATR: slDist,
    maxTPMultiple: Math.max(...take_profits.map((t) => t.r_multiple)),
    biasTimeframe: biasResult.timeframe,
  });

  const expiryMs = getIdeaExpiry(tradeClassification.trade_type);
  const time_expiry = new Date(Date.now() + expiryMs).toISOString();

  const invalidation: IdeaInvalidation = {
    price: isBearish ? entryZone.max + (entryZone.max - setup.stopLoss) * 0.2 : entryZone.min - (setup.stopLoss - entryZone.min) * 0.2,
    structure: `${isBearish ? 'Close above' : 'Close below'} ${setup.stopLoss.toFixed(5)} on execution TF`,
    time_expiry,
  };

  const tier = setup.confluenceTier ?? 'C';
  const checklist = setup.checklist ?? [];
  const passing  = checklist.filter((c) => c.pass).map((c) => c.label);
  const failing  = checklist.filter((c) => !c.pass).map((c) => c.label);
  const thesis = [
    `${biasResult.direction} bias (confidence: ${biasResult.confidence}%) — ${biasResult.tradeGuidanceSummary ?? ''}`,
    `Tier ${tier}${passing.length ? `. Passing gates: ${passing.slice(0, 3).join(', ')}` : ''}`,
    failing.length ? `Open gates: ${failing.slice(0, 2).join(', ')}` : '',
  ].filter(Boolean).join('. ');

  const candidateRef = `analyst:${biasResult.instrument}:${biasResult.timestamp}`;

  return {
    instrument:              biasResult.instrument,
    direction,
    trade_type:              tradeClassification.trade_type,
    priority:                'primary',
    origin:                  'analyst' as IdeaOrigin,
    entry_zone:              entryZone,
    stop_loss:               setup.stopLoss,
    take_profits,
    thesis,
    entry_conditions: [
      `Close candle inside entry zone [${(entryZone.min / pipSize).toFixed(0)}–${(entryZone.max / pipSize).toFixed(0)} pips]`,
      `Bias direction ${direction === 'long' ? 'bullish' : 'bearish'} on execution TF`,
      `No major event within 90m`,
    ],
    invalidation,
    confidence:              biasResult.confidence,
    source_bias_snapshot_id: snapshot.id,
    source_candidate_refs:   [candidateRef],
    tags: [`tier-${tier}`, tradeClassification.trade_type],
  };
}

function extractFromMechanical(
  c: MechanicalCandidate,
  snapshot: BiasSnapshot
): TradeIdeaDraft | null {
  const { setup } = c;
  if (!setup.entry || !setup.stopLoss) return null;

  const direction: 'long' | 'short' = setup.direction === 'bullish' ? 'long' : 'short';
  const entryRef = (setup.entry[0] + setup.entry[1]) / 2;
  const entryZone = { min: setup.entry[0], max: setup.entry[1], ref: entryRef };

  const take_profits: TakeProfit[] = setup.takeProfit.map((level, idx) => ({
    level,
    r_multiple: setup.riskReward[idx] ?? idx + 1,
    weight: idx === 0 ? 0.5 : idx === 1 ? 0.3 : 0.2,
  }));

  const slDist = slInATR(entryRef, setup.stopLoss, setup.atr);
  const mTF = setup.timeframe as '1h' | '4h';

  const tradeClassification = classifyTradeType({
    slDistanceATR: slDist,
    maxTPMultiple: Math.max(...take_profits.map((t) => t.r_multiple)),
    biasTimeframe: setup.tradingStyle === 'swing' ? 'intraweek' : 'intraday',
    mechanicalTimeframe: mTF,
    convictionTier: setup.conviction,
    regimeStructure: setup.fullRegime?.structure,
  });

  const expiryMs = getIdeaExpiry(tradeClassification.trade_type);
  const time_expiry = new Date(Date.now() + expiryMs).toISOString();

  const invalidation: IdeaInvalidation = {
    price: setup.stopLoss,
    structure: `Stop loss hit at ${setup.stopLoss.toFixed(5)} (${direction === 'long' ? 'price falls below' : 'price rises above'} SL)`,
    time_expiry,
  };

  const agreeingSignals = setup.signals
    .filter((s) => s.direction === setup.direction)
    .map((s) => s.system);

  const thesis = [
    `${setup.conviction} conviction ${direction} on ${setup.displayName} — ${setup.regimeLabel}`,
    `Signals: ${agreeingSignals.slice(0, 4).join(', ')}`,
    setup.fullRegime ? `Phase: ${setup.fullRegime.phase} (${setup.fullRegime.label})` : '',
  ].filter(Boolean).join('. ');

  const candidateRef = `mechanical:${setup.instrumentId}:${Date.now()}`;

  return {
    instrument:              setup.instrumentId,
    direction,
    trade_type:              tradeClassification.trade_type,
    priority:                'primary',
    origin:                  'mechanical' as IdeaOrigin,
    entry_zone:              entryZone,
    stop_loss:               setup.stopLoss,
    take_profits,
    thesis,
    entry_conditions: [
      `Price enters entry zone [${setup.entry[0].toFixed(5)}–${setup.entry[1].toFixed(5)}]`,
      `Impulse confirms ${direction === 'long' ? 'bullish' : 'bearish'} (${setup.impulse} bar)`,
      `Conviction ≥ A tier`,
    ],
    invalidation,
    confidence:              setup.convictionScore,
    source_bias_snapshot_id: snapshot.id,
    source_candidate_refs:   [candidateRef],
    tags: [`conviction-${setup.conviction}`, tradeClassification.trade_type, setup.regime],
  };
}

// ── Merge analyst + mechanical when both available ────────

function mergeCandidates(
  analyst: TradeIdeaDraft,
  mechanical: TradeIdeaDraft
): TradeIdeaDraft {
  // Prefer mechanical levels (more precise), analyst thesis + conditions
  return {
    ...mechanical,
    thesis:            analyst.thesis,                              // analyst prose is richer
    entry_conditions:  [...new Set([...mechanical.entry_conditions, ...analyst.entry_conditions.slice(0, 1)])],
    source_candidate_refs: [...mechanical.source_candidate_refs, ...analyst.source_candidate_refs],
    origin:            'hybrid',
    // Blend confidence: weight mechanical 60% + analyst 40%
    confidence:        Math.round(mechanical.confidence * 0.6 + analyst.confidence * 0.4),
    tags:              [...new Set([...mechanical.tags, ...analyst.tags])],
  };
}

// ── Main entry point ──────────────────────────────────────

export interface IdeaGeneratorInput {
  userId:            string;
  committedSnapshot: BiasSnapshot;
  analyst?:          AnalystCandidate;
  mechanical?:       MechanicalCandidate;
  /** Regime choppy flag — blocks new primary ideas when true */
  isChoppy?:         boolean;
}

export interface IdeaGeneratorOutput {
  idea?:   import('@/lib/types/trade-idea').TradeIdea;
  action:  'created' | 'refreshed' | 'rejected' | 'demoted' | 'no_candidate' | 'choppy_regime';
  reason:  string;
  log?:    DecisionLogDraft;
}

/**
 * Generate or update a canonical TradeIdea from available candidates.
 *
 * Returns the new/updated idea and the action taken.
 * The caller is responsible for rendering the UI — this function
 * only persists and logs; it does not emit to the browser.
 */
export async function generateTradeIdea(
  input: IdeaGeneratorInput
): Promise<IdeaGeneratorOutput> {
  const { userId, committedSnapshot, analyst, mechanical, isChoppy } = input;
  const instrument = committedSnapshot.instrument;

  // 1. Block new primary ideas in choppy regime
  if (isChoppy) {
    await appendLog(userId, {
      user_id:    userId,
      event:      'idea_created',
      snapshot_id: committedSnapshot.id,
      actor:      'system',
      reason:     'regime_choppy',
      payload:    { instrument, blocked: true },
    });
    return { action: 'choppy_regime', reason: 'Regime is choppy — no new primary ideas' };
  }

  // 2. Build individual drafts
  let analystDraft:    TradeIdeaDraft | null = analyst    ? extractFromAnalyst(analyst, committedSnapshot)    : null;
  let mechanicalDraft: TradeIdeaDraft | null = mechanical ? extractFromMechanical(mechanical, committedSnapshot) : null;

  // Direction alignment check: skip candidates opposing committed bias
  const biasDir = committedSnapshot.direction;
  if (biasDir !== 'neutral') {
    const biasLong = biasDir === 'bullish';
    if (analystDraft    && analystDraft.direction    !== (biasLong ? 'long' : 'short')) analystDraft    = null;
    if (mechanicalDraft && mechanicalDraft.direction !== (biasLong ? 'long' : 'short')) mechanicalDraft = null;
  }

  if (!analystDraft && !mechanicalDraft) {
    return { action: 'no_candidate', reason: 'No valid candidates after bias direction filter' };
  }

  // 3. Merge or pick best
  let draft: TradeIdeaDraft;
  if (analystDraft && mechanicalDraft) {
    draft = mergeCandidates(analystDraft, mechanicalDraft);
  } else {
    draft = (mechanicalDraft ?? analystDraft)!;
  }

  // 4. Load active ideas for consistency checks
  const activeIdeas = await getActiveIdeas(userId);

  // 5. Dedup check — refresh if near-identical idea already exists
  const duplicate = activeIdeas.find((i) => isDuplicateIdea(draft, i));
  if (duplicate) {
    // Bump source_candidate_refs and updated_at on the existing idea
    const updatedRefs = [...new Set([...duplicate.source_candidate_refs, ...draft.source_candidate_refs])];
    const { updateIdea } = await import('@/lib/storage/trade-ideas-store');
    const refreshed = await updateIdea(duplicate.id, { source_candidate_refs: updatedRefs });
    return {
      idea:   refreshed ?? duplicate,
      action: 'refreshed',
      reason: 'Duplicate entry zone — refreshed existing idea',
    };
  }

  // 6. Conflict / correlation check
  const conflictResult = evaluateNewIdea(draft, { activeIdeas });
  const corrResult     = checkCorrelation(draft, activeIdeas);

  if (conflictResult.action === 'reject') {
    const log: DecisionLogDraft = {
      user_id:    userId,
      event:      'conflict_blocked',
      snapshot_id: committedSnapshot.id,
      actor:      'system',
      reason:     conflictResult.reason,
      payload:    { instrument, direction: draft.direction, conflicting_ids: conflictResult.conflicting_ids },
    };
    await appendLog(userId, log);
    return { action: 'rejected', reason: conflictResult.reason, log };
  }

  if (corrResult.blocked) {
    const log: DecisionLogDraft = {
      user_id:    userId,
      event:      'conflict_blocked',
      snapshot_id: committedSnapshot.id,
      actor:      'system',
      reason:     corrResult.reason,
      payload:    { instrument, direction: draft.direction, correlated_ids: corrResult.correlated_ids },
    };
    await appendLog(userId, log);
    return { action: 'rejected', reason: corrResult.reason, log };
  }

  if (conflictResult.action === 'demote_secondary') {
    draft = { ...draft, priority: 'secondary' };
  }

  // 7. Persist
  const idea = await createIdea(userId, draft);
  if (!idea) {
    return { action: 'rejected', reason: 'DB write failed' };
  }

  // 8. Log creation
  const log: DecisionLogDraft = {
    user_id:    userId,
    event:      'idea_created',
    idea_id:    idea.id,
    snapshot_id: committedSnapshot.id,
    to_state:   'idea',
    actor:      'system',
    reason:     conflictResult.action === 'demote_secondary'
                  ? `Demoted to secondary: ${conflictResult.reason}`
                  : `New ${draft.trade_type} idea (${draft.origin})`,
    payload: {
      instrument,
      direction:   draft.direction,
      confidence:  draft.confidence,
      trade_type:  draft.trade_type,
      priority:    draft.priority,
      origin:      draft.origin,
    },
  };
  await appendLog(userId, log);

  return {
    idea,
    action:  conflictResult.action === 'demote_secondary' ? 'demoted' : 'created',
    reason:  log.reason,
    log,
  };
}
