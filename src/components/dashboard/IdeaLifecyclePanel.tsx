'use client';

// ============================================================
// IdeaLifecyclePanel — renders the canonical TradeIdea list
// from useDecisionEngine.
//
// Shows: current lifecycle state, entry zone, SL/TP, thesis,
// invalidation conditions, and a transition action bar.
// ============================================================

import { useState } from 'react';
import {
  TrendingUp, TrendingDown, Target, AlertTriangle,
  ChevronDown, ChevronUp, Zap, Clock, CheckCircle2, XCircle, Activity,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useDecisionEngine } from '@/lib/hooks/useDecisionEngine';
import { ContradictionBanner } from './ContradictionBanner';
import { getStateLabel, isTransitionAllowed } from '@/lib/calculations/lifecycle-engine';
import type { TradeIdea, TradeState } from '@/lib/types/trade-idea';
import { isOpenPosition, isTerminalState } from '@/lib/types/trade-idea';
import type { TradeType } from '@/lib/types/trade-idea';

// ── State badge ───────────────────────────────────────────

const STATE_COLORS: Record<TradeState, string> = {
  idea:        'bg-muted/50 text-muted-foreground',
  watching:    'bg-blue-500/15 text-blue-300 border border-blue-500/30',
  ready:       'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30',
  executed:    'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
  managing:    'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40',
  scaled:      'bg-emerald-600/25 text-emerald-100 border border-emerald-600/50',
  exited:      'bg-muted/30 text-muted-foreground/60',
  invalidated: 'bg-red-500/10 text-red-400/70',
};

const TYPE_LABELS: Record<TradeType, string> = {
  scalp:    'S',
  intraday: 'ID',
  swing:    'SW',
};

function StateBadge({ state }: { state: TradeState }) {
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', STATE_COLORS[state])}>
      {getStateLabel(state)}
    </span>
  );
}

// ── Individual idea card ──────────────────────────────────

function IdeaCard({
  idea,
  onTransition,
}: {
  idea: TradeIdea;
  onTransition: (ideaId: string, to: TradeState, reason: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLong   = idea.direction === 'long';
  const isOpen   = isOpenPosition(idea.state);
  const age      = formatDistanceToNow(new Date(idea.created_at), { addSuffix: true });
  const tp1      = idea.take_profits[0];
  const tp2      = idea.take_profits[1];

  async function handleTransition(to: TradeState, reason: string) {
    setTransitioning(true);
    setError(null);
    try {
      await onTransition(idea.id, to, reason);
    } catch (e: unknown) {
      const msg = (e as Record<string, string>)?.reason ?? (e as Error)?.message ?? 'Transition failed';
      setError(msg);
    } finally {
      setTransitioning(false);
    }
  }

  // User-available transitions from the current state
  const availableTransitions: { to: TradeState; label: string; variant: 'primary' | 'danger' | 'neutral' }[] = [];
  if (isTransitionAllowed(idea.state, 'executed')) availableTransitions.push({ to: 'executed', label: 'Mark Executed', variant: 'primary' });
  if (isTransitionAllowed(idea.state, 'exited'))   availableTransitions.push({ to: 'exited',   label: 'Mark Exited',   variant: 'neutral' });
  if (isTransitionAllowed(idea.state, 'invalidated')) availableTransitions.push({ to: 'invalidated', label: 'Invalidate', variant: 'danger' });

  return (
    <div className={cn(
      'rounded-lg border bg-card transition-colors',
      isOpen ? 'border-emerald-500/25' : 'border-border/50',
      isTerminalState(idea.state) && 'opacity-50'
    )}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {isLong ? (
          <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-400 shrink-0" />
        )}

        <span className="font-mono text-sm font-semibold">{idea.instrument}</span>

        <span className={cn(
          'text-xs font-medium px-1.5 py-0.5 rounded',
          isLong ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        )}>
          {idea.direction.toUpperCase()}
        </span>

        <StateBadge state={idea.state} />

        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="rounded bg-muted/50 px-1 py-0.5 text-[10px] font-mono">
            {TYPE_LABELS[idea.trade_type]}
          </span>
          <span>{idea.confidence}%</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>

      {/* Levels strip */}
      <div className="px-3 pb-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
        <span>
          <span className="opacity-50">Entry</span>{' '}
          <span className="text-foreground/80">
            {idea.entry_zone.min.toFixed(5)}–{idea.entry_zone.max.toFixed(5)}
          </span>
        </span>
        <span>
          <span className="opacity-50">SL</span>{' '}
          <span className="text-red-400">{idea.stop_loss.toFixed(5)}</span>
        </span>
        {tp1 && (
          <span>
            <span className="opacity-50">TP1</span>{' '}
            <span className="text-emerald-400">{tp1.level.toFixed(5)}</span>
            <span className="opacity-40 ml-0.5">({tp1.r_multiple.toFixed(1)}R)</span>
          </span>
        )}
        {tp2 && (
          <span>
            <span className="opacity-50">TP2</span>{' '}
            <span className="text-emerald-400">{tp2.level.toFixed(5)}</span>
            <span className="opacity-40 ml-0.5">({tp2.r_multiple.toFixed(1)}R)</span>
          </span>
        )}
        <span className="ml-auto opacity-40">{age}</span>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-border/40 px-3 py-3 space-y-3 text-sm">
          {/* Thesis */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1">Thesis</p>
            <p className="text-foreground/80 leading-relaxed text-[13px]">{idea.thesis}</p>
          </div>

          {/* Entry conditions */}
          {idea.entry_conditions.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1">Entry conditions</p>
              <ul className="space-y-1">
                {idea.entry_conditions.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[12px] text-foreground/70">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-muted-foreground/40 shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Invalidation */}
          {(idea.invalidation.structure || idea.invalidation.price) && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1">Invalidation</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-red-400/80">
                {idea.invalidation.price && (
                  <span>Hard level: {idea.invalidation.price.toFixed(5)}</span>
                )}
                {idea.invalidation.structure && (
                  <span className="font-sans normal-case text-[12px]">{idea.invalidation.structure}</span>
                )}
              </div>
            </div>
          )}

          {/* Scale events */}
          {idea.scale_events && idea.scale_events.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 mb-1">Scale events</p>
              {idea.scale_events.map((ev, i) => (
                <p key={i} className="text-[11px] font-mono text-muted-foreground">
                  +{ev.size_r}R @ {ev.price.toFixed(5)} — {ev.reason}
                </p>
              ))}
            </div>
          )}

          {/* Action bar */}
          {availableTransitions.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {availableTransitions.map(({ to, label, variant }) => (
                <button
                  key={to}
                  disabled={transitioning}
                  onClick={() => handleTransition(to, `User action: ${label}`)}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50',
                    variant === 'primary' && 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30',
                    variant === 'danger'  && 'bg-red-500/20 text-red-300 hover:bg-red-500/30',
                    variant === 'neutral' && 'bg-muted/60 text-muted-foreground hover:bg-muted'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────

export function IdeaLifecyclePanel({
  instrument,
  className,
}: {
  /** Optional — if provided, only shows ideas for that instrument */
  instrument?: string;
  className?: string;
}) {
  const { snapshot, isLoading, error, transitionIdea } = useDecisionEngine({ refreshInterval: 30_000 });

  const ideas = instrument
    ? (snapshot?.active_ideas ?? []).filter((i) => i.instrument === instrument)
    : (snapshot?.active_ideas ?? []);

  const recentLog = snapshot?.actions_taken ?? [];

  async function handleTransition(ideaId: string, to: TradeState, reason: string) {
    await transitionIdea(ideaId, to, { reason });
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Contradiction banner */}
      <ContradictionBanner recentLog={recentLog} />

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Activity className="h-4 w-4 animate-pulse" />
          Loading decision engine…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-400">
          <AlertTriangle className="inline h-4 w-4 mr-1" />
          Decision engine unavailable — {(error as Error).message}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && ideas.length === 0 && (
        <div className="rounded-lg border border-dashed border-border/50 px-4 py-6 text-center text-sm text-muted-foreground">
          <Target className="mx-auto h-8 w-8 mb-2 opacity-30" />
          <p className="font-medium">No active ideas{instrument ? ` for ${instrument}` : ''}</p>
          {snapshot?.no_action_reasons?.[0] && (
            <p className="text-xs mt-1 opacity-70">{snapshot.no_action_reasons[0]}</p>
          )}
        </div>
      )}

      {/* Idea cards */}
      {ideas.map((idea) => (
        <IdeaCard key={idea.id} idea={idea} onTransition={handleTransition} />
      ))}

      {/* New ideas this refresh */}
      {(snapshot?.new_ideas_this_refresh?.length ?? 0) > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Zap className="h-3 w-3 text-yellow-400" />
          {snapshot!.new_ideas_this_refresh.length} new idea(s) generated this cycle
        </p>
      )}

      {/* Snapshot age */}
      {snapshot?.generated_at && (
        <p className="text-[10px] text-muted-foreground/40 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Snapshot {formatDistanceToNow(new Date(snapshot.generated_at), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}
