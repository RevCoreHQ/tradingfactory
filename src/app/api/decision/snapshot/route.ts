// GET /api/decision/snapshot
// Returns the strict output envelope: current market bias + active ideas + recent log
// This is the single source of truth for the trading desk UI.

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkUserRateLimit } from '@/lib/api/rate-limit';
import { getAllCommittedSnapshots } from '@/lib/storage/bias-snapshot-store';
import { getActiveIdeas } from '@/lib/storage/trade-ideas-store';
import { getRecentLog } from '@/lib/storage/decision-log-store';
import { evaluatePriceTick } from '@/lib/calculations/lifecycle-engine';
import type { DecisionSnapshot, MarketBiasEntry } from '@/lib/types/decision-log';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const rl = checkUserRateLimit(`decision-snapshot:${auth.user.id}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    // Optional cursor: ISO timestamp — only return log entries newer than this
    const since      = searchParams.get('since') ?? undefined;
    // Refresh window: how many seconds back counts as "new" idea
    const newWindowS = parseInt(searchParams.get('new_window_s') ?? '60', 10);
    const newCutoff  = new Date(Date.now() - newWindowS * 1000).toISOString();

    const userId = auth.user.id;

    // Parallel fetch
    const [snapshots, rawIdeas, log] = await Promise.all([
      getAllCommittedSnapshots(userId),
      getActiveIdeas(userId),
      getRecentLog(userId, { limit: 50, since }),
    ]);

    // Build market_bias map
    const market_bias: Record<string, MarketBiasEntry> = {};
    for (const snap of snapshots) {
      market_bias[snap.instrument] = {
        direction:    snap.direction,
        confidence:   snap.confidence,
        regime:       snap.regime,
        committed_at: snap.created_at,
        snapshot_id:  snap.id,
      };
    }

    // Split ideas: new vs established
    const active_ideas           = rawIdeas.filter((i) => i.created_at <= newCutoff);
    const new_ideas_this_refresh = rawIdeas.filter((i) => i.created_at > newCutoff);

    // Derive no-action reasons if nothing happened recently
    const no_action_reasons: string[] = [];
    if (log.length === 0 && rawIdeas.length === 0) {
      no_action_reasons.push('No active ideas and no recent log entries — system is monitoring');
    }
    if (rawIdeas.some((i) => i.state === 'idea' || i.state === 'watching')) {
      const count = rawIdeas.filter((i) => i.state === 'idea' || i.state === 'watching').length;
      no_action_reasons.push(`${count} idea(s) in monitoring state — awaiting entry zone approach`);
    }

    const envelope: DecisionSnapshot = {
      generated_at:           new Date().toISOString(),
      market_bias,
      active_ideas,
      new_ideas_this_refresh,
      actions_taken:           log,
      no_action_reasons:       no_action_reasons.length > 0 ? no_action_reasons : undefined,
    };

    return NextResponse.json(envelope, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[decision/snapshot] Error:', error);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
