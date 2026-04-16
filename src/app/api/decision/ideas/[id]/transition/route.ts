// POST /api/decision/ideas/[id]/transition
// Transition a TradeIdea to a new state.
// Validates against the allowed-transition table.
// Returns 409 TRANSITION_NOT_ALLOWED if disallowed.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkUserRateLimit } from '@/lib/api/rate-limit';
import { getIdeaById } from '@/lib/storage/trade-ideas-store';
import { transition, isTransitionAllowed } from '@/lib/calculations/lifecycle-engine';
import { TransitionError } from '@/lib/types/trade-idea';
import type { TradeState } from '@/lib/types/trade-idea';

const VALID_STATES: TradeState[] = [
  'idea', 'watching', 'ready', 'executed', 'managing', 'scaled', 'exited', 'invalidated',
];

const TransitionBodySchema = z.object({
  to:      z.enum(['idea', 'watching', 'ready', 'executed', 'managing', 'scaled', 'exited', 'invalidated']),
  reason:  z.string().min(1).max(500),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const rl = checkUserRateLimit(`decision-transition:${auth.user.id}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  try {
    const { id } = await params;

    // Validate id format
    if (!/^[0-9a-f-]{36}$/.test(id)) {
      return NextResponse.json({ error: 'Invalid idea id' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = TransitionBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { to, reason, payload } = parsed.data;

    // Load the idea (uses browser client — RLS ensures user can only read own ideas)
    const idea = await getIdeaById(id);
    if (!idea) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }

    // Verify ownership (belt + suspenders beyond RLS)
    if (idea.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Pre-check so we can return a structured error before hitting the state machine
    if (!isTransitionAllowed(idea.state, to as TradeState)) {
      return NextResponse.json(
        {
          error:      'Transition not allowed',
          code:       'TRANSITION_NOT_ALLOWED',
          from_state: idea.state,
          to_state:   to,
          reason:     `${idea.state} → ${to} is not a valid transition`,
        },
        { status: 409 }
      );
    }

    const updated = await transition(idea, to as TradeState, {
      actor:   'user',
      reason,
      payload: payload as Record<string, unknown>,
    });

    return NextResponse.json({ idea: updated });
  } catch (err) {
    if (err instanceof TransitionError) {
      return NextResponse.json(
        { error: 'Transition not allowed', code: 'TRANSITION_NOT_ALLOWED', from_state: err.from, to_state: err.to },
        { status: 409 }
      );
    }
    console.error('[decision/transition]', err);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
