// ============================================================
// TradeIdea — canonical stateful trade object
// The single source of truth for all trade management.
// BiasResult.tradeSetup and TradeDeskSetup are INPUTS;
// TradeIdea is the persisted, lifecycle-tracked output.
// ============================================================

export type TradeState =
  | 'idea'         // identified but not near entry
  | 'watching'     // price approaching entry zone (within 1 ATR)
  | 'ready'        // trigger conditions met, awaiting execution
  | 'executed'     // filled, position open
  | 'managing'     // active, no adds
  | 'scaled'       // added to winner
  | 'exited'       // TP or SL hit, or manual close
  | 'invalidated'; // setup no longer valid

export type TradeType = 'scalp' | 'intraday' | 'swing';
export type IdeaPriority = 'primary' | 'secondary';
export type IdeaOrigin = 'analyst' | 'mechanical' | 'hybrid' | 'manual';

export const TERMINAL_STATES: TradeState[] = ['exited', 'invalidated'];
export const ACTIVE_STATES: TradeState[] = ['idea', 'watching', 'ready', 'executed', 'managing', 'scaled'];

export function isLifecycleActive(state: TradeState): boolean {
  return ACTIVE_STATES.includes(state);
}

export function isTerminalState(state: TradeState): boolean {
  return TERMINAL_STATES.includes(state);
}

export function isOpenPosition(state: TradeState): boolean {
  return state === 'executed' || state === 'managing' || state === 'scaled';
}

export interface TakeProfit {
  level: number;
  r_multiple: number;
  weight: number; // proportion of position to close at this level (0–1, sum should = 1)
}

export interface ScaleEvent {
  at: string;           // ISO timestamp
  price: number;
  size_r: number;       // additional R added
  reason: string;
}

export interface IdeaInvalidation {
  price?: number;           // hard price level that voids the setup
  structure?: string;       // e.g. "break below 147.50 on 4H close"
  time_expiry?: string;     // ISO — max age for the idea
  reasons_triggered?: string[]; // filled in when invalidated
}

export interface TradeIdea {
  id: string;
  user_id: string;
  instrument: string;
  direction: 'long' | 'short';
  trade_type: TradeType;
  priority: IdeaPriority;
  origin: IdeaOrigin;

  state: TradeState;
  state_since: string; // ISO

  entry_zone: { min: number; max: number; ref: number };
  stop_loss: number;
  take_profits: TakeProfit[];

  thesis: string;               // why this trade exists
  entry_conditions: string[];   // human-readable conditions required for state=ready
  invalidation: IdeaInvalidation;

  confidence: number;           // 0–100 at creation time
  source_bias_snapshot_id: string;
  source_candidate_refs: string[]; // which analyst/mechanical candidates fed this idea

  // Execution state (populated from state=executed onward)
  executed_at?: string;
  avg_entry_price?: number;
  current_size_r?: number;    // total position size in R units
  scale_events?: ScaleEvent[];
  realized_r?: number;        // R captured from closed portion(s)
  exited_at?: string;

  tags: string[];
  created_at: string;
  updated_at: string;
}

// ── Draft (before persisting) ──────────────────────────────

export type TradeIdeaDraft = Omit<
  TradeIdea,
  'id' | 'user_id' | 'state' | 'state_since' | 'created_at' | 'updated_at'
  | 'executed_at' | 'avg_entry_price' | 'current_size_r' | 'scale_events'
  | 'realized_r' | 'exited_at'
>;

// ── State-machine transition context ──────────────────────

export interface TransitionContext {
  actor: 'system' | 'user';
  reason: string;
  payload?: Record<string, unknown>;
}

// ── Transition error (thrown when a transition is disallowed) ──

export class TransitionError extends Error {
  readonly code = 'TRANSITION_NOT_ALLOWED';
  constructor(
    readonly from: TradeState,
    readonly to: TradeState,
    message?: string
  ) {
    super(message ?? `Transition ${from} → ${to} is not allowed`);
    this.name = 'TransitionError';
  }
}
