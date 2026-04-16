// ============================================================
// lifecycle-engine.ts — canonical state machine for TradeIdea
//
// ALL state changes MUST go through `transition()`. Direct
// mutation of idea.state is forbidden. Every transition is
// recorded in decision_log via the stores passed in.
// ============================================================

import type { TradeIdea, TradeState, TransitionContext, ScaleEvent } from '@/lib/types/trade-idea';
import { TransitionError, isTerminalState } from '@/lib/types/trade-idea';
import type { DecisionEvent } from '@/lib/types/decision-log';
import type { DecisionLogDraft } from '@/lib/types/decision-log';
import { updateIdea } from '@/lib/storage/trade-ideas-store';
import { appendLog } from '@/lib/storage/decision-log-store';

// ── Allowed-transition table ──────────────────────────────
// Keys are `from:to`; value is true when allowed.
// Anything not in this table is forbidden.

const ALLOWED_TRANSITIONS: Readonly<Record<string, true>> = {
  'idea:watching':    true,
  'idea:invalidated': true,
  'watching:ready':   true,
  'watching:idea':    true, // price moved away — revert without invalidation
  'watching:invalidated': true,
  'ready:executed':   true,
  'ready:watching':   true, // trigger reverted
  'ready:invalidated': true,
  'executed:managing': true,
  'managing:scaled':  true,
  'managing:exited':  true,
  'managing:invalidated': true, // HTF break while open — forced close recommendation
  'scaled:managing':  true, // after scale-in logged
  'scaled:exited':    true,
  'scaled:invalidated': true,
};

export function isTransitionAllowed(from: TradeState, to: TradeState): boolean {
  return !!ALLOWED_TRANSITIONS[`${from}:${to}`];
}

function assertTransitionAllowed(from: TradeState, to: TradeState): void {
  if (!isTransitionAllowed(from, to)) {
    throw new TransitionError(from, to);
  }
}

// ── Event mapping ─────────────────────────────────────────

function mapEvent(from: TradeState, to: TradeState): DecisionEvent {
  if (to === 'invalidated') return 'idea_invalidated';
  if (to === 'executed')    return 'idea_executed';
  if (to === 'scaled')      return 'idea_scaled';
  if (to === 'exited')      return 'idea_exited';
  return 'idea_transition';
}

// ── Transition effects ────────────────────────────────────
// Apply side-effect mutations when moving to a new state.

function applyTransitionEffects(
  idea: TradeIdea,
  to: TradeState,
  ctx: TransitionContext
): TradeIdea {
  const now = new Date().toISOString();
  const base: TradeIdea = { ...idea, state: to, state_since: now, updated_at: now };

  switch (to) {
    case 'executed': {
      const payload = ctx.payload ?? {};
      return {
        ...base,
        executed_at: now,
        avg_entry_price: typeof payload.price === 'number' ? payload.price : idea.avg_entry_price,
        current_size_r: typeof payload.size_r === 'number' ? payload.size_r : 1,
        state: 'managing', // executed immediately transitions to managing
        state_since: now,
      };
    }

    case 'scaled': {
      const payload = ctx.payload ?? {};
      const scaleEvent: ScaleEvent = {
        at: now,
        price: typeof payload.price === 'number' ? payload.price : 0,
        size_r: typeof payload.size_r === 'number' ? payload.size_r : 0,
        reason: ctx.reason,
      };
      return {
        ...base,
        scale_events: [...(idea.scale_events ?? []), scaleEvent],
        current_size_r: (idea.current_size_r ?? 0) + (scaleEvent.size_r),
      };
    }

    case 'exited': {
      const payload = ctx.payload ?? {};
      return {
        ...base,
        exited_at: now,
        realized_r: typeof payload.realized_r === 'number' ? payload.realized_r : idea.realized_r,
      };
    }

    case 'invalidated': {
      const prevReasons = idea.invalidation?.reasons_triggered ?? [];
      return {
        ...base,
        invalidation: {
          ...idea.invalidation,
          reasons_triggered: [...prevReasons, ctx.reason],
        },
      };
    }

    default:
      return base;
  }
}

// ── Primary transition function ───────────────────────────

/**
 * Transition a TradeIdea to a new state.
 * - Validates the transition against the allowed table.
 * - Applies side-effect mutations (executed_at, scale_events, etc.).
 * - Persists the updated idea to Supabase (service-role).
 * - Appends a decision_log entry.
 * - Returns the updated idea.
 *
 * Throws TransitionError if the transition is not allowed.
 */
export async function transition(
  idea: TradeIdea,
  to: TradeState,
  ctx: TransitionContext
): Promise<TradeIdea> {
  assertTransitionAllowed(idea.state, to);

  const next = applyTransitionEffects(idea, to, ctx);
  const updated = await updateIdea(idea.id, next);
  if (!updated) {
    throw new Error(`[lifecycle-engine] DB update failed for idea ${idea.id}`);
  }

  const logDraft: DecisionLogDraft = {
    user_id:    idea.user_id,
    event:      mapEvent(idea.state, to),
    idea_id:    idea.id,
    from_state: idea.state,
    to_state:   next.state,
    actor:      ctx.actor,
    reason:     ctx.reason,
    payload:    ctx.payload ?? {},
  };
  await appendLog(idea.user_id, logDraft);

  return updated;
}

// ── Bulk price-tick evaluation ────────────────────────────
// Used by the snapshot endpoint to auto-advance idea states
// based on current market prices. Does NOT require explicit
// user action — system actor.

export interface PriceTickContext {
  instrument: string;
  currentPrice: number;
  atr: number;
}

/**
 * Evaluate a single idea against current price and auto-advance
 * its state if conditions are met. Returns the updated idea or
 * the original if no change was needed.
 */
export async function evaluatePriceTick(
  idea: TradeIdea,
  ctx: PriceTickContext
): Promise<TradeIdea> {
  if (isTerminalState(idea.state)) return idea;
  if (idea.instrument !== ctx.instrument) return idea;

  const { currentPrice, atr } = ctx;
  const entryMin = idea.entry_zone.min;
  const entryMax = idea.entry_zone.max;
  const entryRef = idea.entry_zone.ref;

  // Check invalidation price breach (hard level)
  if (idea.invalidation.price !== undefined) {
    const invalidated =
      idea.direction === 'long'
        ? currentPrice <= idea.invalidation.price
        : currentPrice >= idea.invalidation.price;
    if (invalidated) {
      return transition(idea, 'invalidated', {
        actor: 'system',
        reason: `Price hit invalidation level ${idea.invalidation.price}`,
        payload: { currentPrice },
      });
    }
  }

  // Check time expiry
  if (idea.invalidation.time_expiry) {
    if (new Date() > new Date(idea.invalidation.time_expiry)) {
      return transition(idea, 'invalidated', {
        actor: 'system',
        reason: 'Setup expired without execution',
        payload: { expiry: idea.invalidation.time_expiry },
      });
    }
  }

  switch (idea.state) {
    case 'idea': {
      // Advance to watching when price is within 1 ATR of entry zone
      const withinATR =
        idea.direction === 'long'
          ? currentPrice >= entryRef - atr && currentPrice <= entryMax + atr
          : currentPrice <= entryRef + atr && currentPrice >= entryMin - atr;
      if (withinATR) {
        return transition(idea, 'watching', {
          actor: 'system',
          reason: `Price (${currentPrice}) within 1 ATR of entry zone`,
          payload: { currentPrice, atr },
        });
      }
      return idea;
    }

    case 'watching': {
      const inZone =
        currentPrice >= entryMin && currentPrice <= entryMax;
      if (inZone) {
        return transition(idea, 'ready', {
          actor: 'system',
          reason: `Price (${currentPrice}) inside entry zone [${entryMin}–${entryMax}]`,
          payload: { currentPrice },
        });
      }
      // If price moved far away, revert to idea without invalidation
      const farAway =
        idea.direction === 'long'
          ? currentPrice < entryRef - 2 * atr
          : currentPrice > entryRef + 2 * atr;
      if (farAway) {
        return transition(idea, 'idea', {
          actor: 'system',
          reason: `Price (${currentPrice}) moved away from entry zone — reverting to monitoring`,
          payload: { currentPrice },
        });
      }
      return idea;
    }

    case 'ready':
      // ready → executed is user-initiated only; system just keeps watching
      return idea;

    case 'managing':
    case 'scaled': {
      // Check SL hit
      const slHit =
        idea.direction === 'long'
          ? currentPrice <= idea.stop_loss
          : currentPrice >= idea.stop_loss;
      if (slHit) {
        const rLost = -1; // 1R loss by default; actual R is set by user/broker
        return transition(idea, 'exited', {
          actor: 'system',
          reason: `Stop loss hit at ${idea.stop_loss} (price: ${currentPrice})`,
          payload: { currentPrice, realized_r: rLost, exit_reason: 'sl_hit' },
        });
      }
      // Check TP1 hit (full exit at TP1 if no partial close logic)
      const tp1 = idea.take_profits[0];
      if (tp1) {
        const tp1Hit =
          idea.direction === 'long'
            ? currentPrice >= tp1.level
            : currentPrice <= tp1.level;
        if (tp1Hit && idea.take_profits.length === 1) {
          return transition(idea, 'exited', {
            actor: 'system',
            reason: `TP1 hit at ${tp1.level}`,
            payload: { currentPrice, realized_r: tp1.r_multiple, exit_reason: 'tp_hit' },
          });
        }
      }
      return idea;
    }

    default:
      return idea;
  }
}

// ── Status label helper (for UI) ─────────────────────────

const STATE_LABELS: Record<TradeState, string> = {
  idea:        'Idea',
  watching:    'Watching',
  ready:       'Ready',
  executed:    'Executed',
  managing:    'Managing',
  scaled:      'Scaled',
  exited:      'Exited',
  invalidated: 'Invalidated',
};

export function getStateLabel(state: TradeState): string {
  return STATE_LABELS[state] ?? state;
}
