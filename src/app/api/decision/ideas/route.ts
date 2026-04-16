// GET  /api/decision/ideas         — list active + recent terminal ideas
// POST /api/decision/ideas         — create a manual TradeIdea

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkUserRateLimit } from '@/lib/api/rate-limit';
import { getActiveIdeas, getTerminalIdeas, createIdea } from '@/lib/storage/trade-ideas-store';
import { appendLog } from '@/lib/storage/decision-log-store';
import { evaluateNewIdea, checkCorrelation } from '@/lib/calculations/decision-consistency';

export const dynamic = 'force-dynamic';

// ── POST body schema ──────────────────────────────────────

const TakeProfitSchema = z.object({
  level:      z.number(),
  r_multiple: z.number(),
  weight:     z.number().min(0).max(1),
});

const InvalidationSchema = z.object({
  price:     z.number().optional(),
  structure: z.string().max(300).optional(),
  time_expiry: z.string().datetime().optional(),
});

const CreateIdeaSchema = z.object({
  instrument:              z.string().min(1).max(20),
  direction:               z.enum(['long', 'short']),
  trade_type:              z.enum(['scalp', 'intraday', 'swing']),
  entry_zone:              z.object({ min: z.number(), max: z.number(), ref: z.number() }),
  stop_loss:               z.number(),
  take_profits:            z.array(TakeProfitSchema).min(1).max(5),
  thesis:                  z.string().max(1000),
  entry_conditions:        z.array(z.string().max(200)).max(10),
  invalidation:            InvalidationSchema,
  confidence:              z.number().min(0).max(100),
  source_bias_snapshot_id: z.string().uuid().optional().default(''),
  tags:                    z.array(z.string().max(50)).max(20).optional().default([]),
});

// ── GET ────────────────────────────────────────────────────

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const rl = checkUserRateLimit(`decision-ideas-get:${auth.user.id}`, 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const includeTerminal = searchParams.get('include_terminal') === 'true';
    const limit           = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);

    const [active, terminal] = await Promise.all([
      getActiveIdeas(auth.user.id),
      includeTerminal ? getTerminalIdeas(auth.user.id, limit) : Promise.resolve([]),
    ]);

    return NextResponse.json({
      active,
      terminal: includeTerminal ? terminal : undefined,
      total_active: active.length,
    });
  } catch (error) {
    console.error('[decision/ideas GET]', error);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}

// ── POST ───────────────────────────────────────────────────

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const rl = checkUserRateLimit(`decision-ideas-post:${auth.user.id}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = await request.json();
    const parsed = CreateIdeaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const userId = auth.user.id;
    const data   = parsed.data;

    // Consistency check against active ideas
    const activeIdeas = await getActiveIdeas(userId);
    const conflictResult = evaluateNewIdea(
      { ...data, priority: 'primary', origin: 'manual', source_candidate_refs: [], source_bias_snapshot_id: data.source_bias_snapshot_id ?? '' },
      { activeIdeas }
    );

    if (conflictResult.action === 'reject') {
      return NextResponse.json(
        { error: 'Conflict', code: 'CONSISTENCY_BLOCK', reason: conflictResult.reason, conflicting_ids: conflictResult.conflicting_ids },
        { status: 409 }
      );
    }

    const corrResult = checkCorrelation(
      { ...data, priority: 'primary', origin: 'manual', source_candidate_refs: [], source_bias_snapshot_id: data.source_bias_snapshot_id ?? '' },
      activeIdeas
    );
    if (corrResult.blocked) {
      return NextResponse.json(
        { error: 'Correlation cap exceeded', code: 'CONSISTENCY_BLOCK', reason: corrResult.reason },
        { status: 409 }
      );
    }

    const priority = conflictResult.action === 'demote_secondary' ? 'secondary' : 'primary';

    const idea = await createIdea(userId, {
      ...data,
      priority,
      origin: 'manual',
      source_candidate_refs: [],
      source_bias_snapshot_id: data.source_bias_snapshot_id ?? '',
    });

    if (!idea) {
      return NextResponse.json({ error: 'Failed to create idea' }, { status: 500 });
    }

    await appendLog(userId, {
      user_id:   userId,
      event:     'idea_created',
      idea_id:   idea.id,
      to_state:  'idea',
      actor:     'user',
      reason:    `Manual idea: ${data.direction} ${data.instrument}`,
      payload:   { instrument: data.instrument, direction: data.direction, origin: 'manual' },
    });

    return NextResponse.json({ idea }, { status: 201 });
  } catch (error) {
    console.error('[decision/ideas POST]', error);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
