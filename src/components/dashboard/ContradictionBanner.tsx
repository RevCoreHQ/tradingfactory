'use client';

// ============================================================
// ContradictionBanner — shown at the top of the desk when the
// decision-consistency layer has blocked a flip or conflict.
// Driven by the decision_log entries in the snapshot.
// ============================================================

import { AlertTriangle, ShieldOff, X } from 'lucide-react';
import { useState } from 'react';
import type { DecisionLogEntry } from '@/lib/types/decision-log';
import { cn } from '@/lib/utils';

export interface ContradictionBannerProps {
  recentLog: DecisionLogEntry[];
  className?: string;
}

export function ContradictionBanner({ recentLog, className }: ContradictionBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const events = recentLog.filter(
    (e) =>
      (e.event === 'conflict_blocked' || e.event === 'bias_flip_blocked') &&
      !dismissed.has(e.id)
  );

  if (events.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {events.map((e) => {
        const isFlipBlock = e.event === 'bias_flip_blocked';
        return (
          <div
            key={e.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm',
              isFlipBlock
                ? 'border-yellow-500/30 bg-yellow-500/5 text-yellow-300'
                : 'border-red-500/30 bg-red-500/5 text-red-300'
            )}
          >
            {isFlipBlock ? (
              <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            )}
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-xs uppercase tracking-wide mr-2 opacity-70">
                {isFlipBlock ? 'Bias Flip Blocked' : 'Conflict Blocked'}
              </span>
              <span className="text-xs opacity-90">{e.reason}</span>
              {e.payload?.instrument != null && (
                <span className="ml-2 font-mono text-xs opacity-60">
                  {String(e.payload.instrument)}
                </span>
              )}
            </div>
            <button
              onClick={() => setDismissed((prev) => new Set([...prev, e.id]))}
              className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
