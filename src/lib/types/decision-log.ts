// ============================================================
// DecisionLogEntry — immutable audit trail for every decision
// the engine makes. Every bias commit, idea creation,
// lifecycle transition, and conflict block is logged here.
// ============================================================

import type { TradeState } from './trade-idea';

export type DecisionEvent =
  | 'bias_uncommitted'     // new snapshot computed but not committed (no structural change)
  | 'bias_committed'       // HTF bias committed (structural change or initial)
  | 'bias_flip_blocked'    // bias tried to flip without structural break — blocked
  | 'idea_created'         // new TradeIdea persisted with state=idea
  | 'idea_transition'      // state changed (e.g. idea→watching, watching→ready)
  | 'idea_invalidated'     // idea moved to invalidated state
  | 'idea_executed'        // idea moved to executed state
  | 'idea_scaled'          // idea scaled into (managing→scaled)
  | 'idea_exited'          // idea moved to exited state
  | 'conflict_blocked';    // new idea candidate rejected due to conflicting open position

export interface DecisionLogEntry {
  id:          string;
  user_id:     string;
  event:       DecisionEvent;
  idea_id?:    string;
  snapshot_id?: string;
  from_state?: TradeState | null;
  to_state?:   TradeState | null;
  actor:       'system' | 'user';
  reason:      string;
  payload:     Record<string, unknown>;
  created_at:  string; // ISO
}

// ── Draft (before persisting) ──────────────────────────────

export type DecisionLogDraft = Omit<DecisionLogEntry, 'id' | 'created_at'>;

// ── Output envelope ────────────────────────────────────────
// The strict shape returned by GET /api/decision/snapshot.
// No contradictions possible because everything reads from
// persisted state, not live recompute.

export interface DecisionSnapshot {
  generated_at:           string;
  market_bias:            Record<string, MarketBiasEntry>;
  active_ideas:           import('./trade-idea').TradeIdea[];
  new_ideas_this_refresh: import('./trade-idea').TradeIdea[];
  actions_taken:          DecisionLogEntry[];
  no_action_reasons?:     string[];
}

export interface MarketBiasEntry {
  direction:    import('./bias-snapshot').SnapshotDirection;
  confidence:   number;
  regime:       import('./bias-snapshot').SnapshotRegime;
  committed_at: string;
  snapshot_id:  string;
}
