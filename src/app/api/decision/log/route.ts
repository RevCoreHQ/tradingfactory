// GET /api/decision/log
// Fetch decision audit log entries for the authenticated user.
// Supports optional filtering by idea_id and since cursor.

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkUserRateLimit } from '@/lib/api/rate-limit';
import { getRecentLog } from '@/lib/storage/decision-log-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const rl = checkUserRateLimit(`decision-log:${auth.user.id}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const ideaId = searchParams.get('idea_id') ?? undefined;
    const since  = searchParams.get('since') ?? undefined;
    const limit  = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 500);

    // Validate idea_id if provided
    if (ideaId && !/^[0-9a-f-]{36}$/.test(ideaId)) {
      return NextResponse.json({ error: 'Invalid idea_id' }, { status: 400 });
    }

    const entries = await getRecentLog(auth.user.id, { ideaId, since, limit });

    return NextResponse.json({
      entries,
      count: entries.length,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[decision/log]', error);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
