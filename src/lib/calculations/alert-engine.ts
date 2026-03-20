import type { SmartAlert, AlertConfig } from "@/lib/types/alerts";
import type { TradeDeskSetup, TrackedSetup, SetupStatus } from "@/lib/types/signals";
import { INSTRUMENTS } from "@/lib/utils/constants";

const ALERT_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function isOnCooldown(
  existing: SmartAlert[],
  instrumentId: string,
  type: SmartAlert["type"],
  cooldownMs: number
): boolean {
  const now = Date.now();
  return existing.some(
    (a) =>
      a.instrumentId === instrumentId &&
      a.type === type &&
      now - a.createdAt < cooldownMs
  );
}

/**
 * Generate alerts from mechanical signal setups (A+/A only).
 * This is the SINGLE source of truth for all alerts — no separate
 * bias/LLM/proximity systems. One brain, one pipeline.
 */
export function evaluateSetupAlerts(
  setups: TradeDeskSetup[],
  seenKeys: Set<string>,
  existingAlerts: SmartAlert[],
  config: AlertConfig
): { alerts: SmartAlert[]; newSeenKeys: string[] } {
  if (!config.enabled) return { alerts: [], newSeenKeys: [] };

  const newAlerts: SmartAlert[] = [];
  const newSeenKeys: string[] = [];
  const cooldownMs = config.cooldownMinutes * 60 * 1000;
  const now = Date.now();
  const active = existingAlerts.filter((a) => !a.dismissed && a.expiresAt > now);

  for (const setup of setups) {
    if (setup.conviction !== "A+" && setup.conviction !== "A") continue;
    if (setup.direction === "neutral") continue;

    const key = `${setup.instrumentId}:${setup.direction}`;
    if (seenKeys.has(key)) continue;

    newSeenKeys.push(key);

    if (isOnCooldown(active, setup.instrumentId, "setup_detected", cooldownMs)) continue;

    const inst = INSTRUMENTS.find((i) => i.id === setup.instrumentId);
    const symbol = inst?.symbol ?? setup.symbol;
    const dir = setup.direction === "bullish" ? "LONG" : "SHORT";

    newAlerts.push({
      id: makeId(),
      type: "setup_detected",
      instrumentId: setup.instrumentId,
      title: `${setup.conviction} ${dir} ${symbol}`,
      message: `${setup.conviction} conviction (${setup.convictionScore}pts) — ${setup.consensus.bullish}B/${setup.consensus.bearish}S signals. R:R ${setup.riskReward[0].toFixed(1)}`,
      severity: setup.conviction === "A+" ? "danger" : "warning",
      createdAt: now,
      dismissed: false,
      expiresAt: now + ALERT_TTL_MS,
    });
  }

  return {
    alerts: newAlerts.slice(0, config.maxActiveAlerts - active.length),
    newSeenKeys,
  };
}

/**
 * Generate an alert when a tracked setup hits a TP milestone or gets stopped out.
 */
export function createMilestoneAlert(
  tracked: TrackedSetup,
  prevStatus: SetupStatus
): SmartAlert | null {
  const now = Date.now();
  const inst = INSTRUMENTS.find((i) => i.id === tracked.setup.instrumentId);
  const symbol = inst?.symbol ?? tracked.setup.symbol;
  const status = tracked.status;

  // Only alert on meaningful transitions
  const milestones: Record<string, { title: string; severity: SmartAlert["severity"] }> = {
    breakeven: { title: `${symbol} → Breakeven`, severity: "info" },
    tp1_hit: { title: `${symbol} → TP1 Hit`, severity: "warning" },
    tp2_hit: { title: `${symbol} → TP2 Hit`, severity: "warning" },
    tp3_hit: { title: `${symbol} → TP3 Hit (Full Target)`, severity: "danger" },
    sl_hit: { title: `${symbol} → Stopped Out`, severity: "danger" },
  };

  const milestone = milestones[status];
  if (!milestone) return null;
  if (prevStatus === status) return null; // No actual transition

  const dir = tracked.setup.direction === "bullish" ? "Long" : "Short";
  const pnl = tracked.pnlPercent != null ? ` (${tracked.pnlPercent > 0 ? "+" : ""}${tracked.pnlPercent.toFixed(1)}%)` : "";

  return {
    id: makeId(),
    type: "tp_milestone",
    instrumentId: tracked.setup.instrumentId,
    title: milestone.title,
    message: `${dir} trade${pnl}`,
    severity: milestone.severity,
    createdAt: now,
    dismissed: false,
    expiresAt: now + ALERT_TTL_MS,
  };
}

export function pruneExpiredAlerts(alerts: SmartAlert[]): SmartAlert[] {
  const now = Date.now();
  return alerts.filter((a) => !a.dismissed && a.expiresAt > now);
}
