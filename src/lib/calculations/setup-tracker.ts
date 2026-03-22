import type {
  TradeDeskSetup,
  TrackedSetup,
  SetupStatus,
  SetupOutcome,
} from "@/lib/types/signals";
import { STYLE_PARAMS } from "./mechanical-signals";

// ==================== CONFLUENCE KEY ====================

export function buildConfluenceKey(setup: TradeDeskSetup): string {
  const agreeing = setup.signals
    .filter((s) => s.direction === setup.direction)
    .map((s) => s.system)
    .sort()
    .join("|");
  return `${agreeing}::${setup.regime}::${setup.impulse}::${setup.tradingStyle ?? "swing"}`;
}

/** Instrument-specific confluence key (same signal combo, scoped to instrument) */
export function buildInstrumentConfluenceKey(setup: TradeDeskSetup): string {
  return `${setup.instrumentId}::${buildConfluenceKey(setup)}`;
}

/** Regime-specific confluence key (same signal combo, scoped to regime structure) */
export function buildRegimeConfluenceKey(setup: TradeDeskSetup): string {
  const structure = setup.fullRegime?.structure ?? "unknown";
  const phase = setup.fullRegime?.phase ?? "unknown";
  const agreeing = setup.signals
    .filter((s) => s.direction === setup.direction)
    .map((s) => s.system)
    .sort()
    .join("|");
  return `${agreeing}::${structure}::${phase}::${setup.tradingStyle ?? "swing"}`;
}

// ==================== CREATE TRACKED SETUP ====================

export function createTrackedSetup(setup: TradeDeskSetup): TrackedSetup {
  const now = Date.now();
  return {
    id: `${setup.instrumentId}:${now}`,
    setup,
    status: "pending",
    createdAt: now,
    activatedAt: null,
    closedAt: null,
    outcome: null,
    pnlPercent: null,
    highestTpHit: 0,
    confluenceKey: buildConfluenceKey(setup),
    scaleIns: [],
    peakPrice: null,
    timeline: [{ status: "pending", timestamp: now, price: setup.currentPrice }],
    missedEntry: false,
  };
}

// ==================== STATE MACHINE ====================

function isTerminal(status: SetupStatus): boolean {
  return ["tp3_hit", "sl_hit", "expired", "invalidated"].includes(status);
}

function priceInEntryZone(price: number, entry: [number, number]): boolean {
  const [lo, hi] = entry[0] < entry[1] ? entry : [entry[1], entry[0]];
  return price >= lo && price <= hi;
}

function priceCrossed(
  price: number,
  level: number,
  direction: "bullish" | "bearish" | "neutral"
): boolean {
  if (direction === "bullish") return price >= level;
  if (direction === "bearish") return price <= level;
  return false;
}

export function updateSetupStatus(
  tracked: TrackedSetup,
  currentPrice: number
): TrackedSetup {
  if (isTerminal(tracked.status)) return tracked;

  const { setup, status } = tracked;
  const now = Date.now();
  const entryMid = (setup.entry[0] + setup.entry[1]) / 2;
  const isBullish = setup.direction === "bullish";

  // Track peak price for running setups (used by scale-in detector)
  let updatedPeak = tracked.peakPrice;
  if (status !== "pending") {
    if (isBullish) {
      updatedPeak = Math.max(updatedPeak ?? currentPrice, currentPrice);
    } else {
      updatedPeak = Math.min(updatedPeak ?? currentPrice, currentPrice);
    }
  }

  // Check expiry (pending only) — style-specific window
  const expiryMs = STYLE_PARAMS[setup.tradingStyle ?? "swing"].expiryMs;
  if (status === "pending" && now - tracked.createdAt > expiryMs) {
    return withTimeline(finalize(tracked, "expired", currentPrice), currentPrice);
  }

  // Check SL hit (any non-terminal active state)
  if (status !== "pending") {
    const effectiveSL =
      status === "breakeven" || status === "tp1_hit" || status === "tp2_hit"
        ? entryMid // SL moved to breakeven
        : setup.stopLoss;

    if (priceCrossed(currentPrice, effectiveSL, isBullish ? "bearish" : "bullish")) {
      return withTimeline(finalize({ ...tracked, peakPrice: updatedPeak }, "sl_hit", currentPrice), currentPrice);
    }
  }

  // State transitions
  let result: TrackedSetup;
  switch (status) {
    case "pending": {
      if (priceInEntryZone(currentPrice, setup.entry)) {
        result = { ...tracked, status: "active", activatedAt: now, peakPrice: currentPrice };
        return withTimeline(result, currentPrice);
      }
      if (priceCrossed(currentPrice, entryMid, setup.direction)) {
        result = { ...tracked, status: "active", activatedAt: now, peakPrice: currentPrice };
        return withTimeline(result, currentPrice);
      }
      return tracked;
    }

    case "active": {
      const beLevel = isBullish
        ? entryMid + setup.atr
        : entryMid - setup.atr;
      if (priceCrossed(currentPrice, beLevel, setup.direction)) {
        if (priceCrossed(currentPrice, setup.takeProfit[0], setup.direction)) {
          result = { ...tracked, status: "tp1_hit", highestTpHit: 1, peakPrice: updatedPeak };
          return withTimeline(result, currentPrice);
        }
        result = { ...tracked, status: "breakeven", peakPrice: updatedPeak };
        return withTimeline(result, currentPrice);
      }
      if (priceCrossed(currentPrice, setup.stopLoss, isBullish ? "bearish" : "bullish")) {
        return withTimeline(finalize({ ...tracked, peakPrice: updatedPeak }, "sl_hit", currentPrice), currentPrice);
      }
      return { ...tracked, peakPrice: updatedPeak };
    }

    case "breakeven": {
      if (priceCrossed(currentPrice, setup.takeProfit[0], setup.direction)) {
        result = { ...tracked, status: "tp1_hit", highestTpHit: 1, peakPrice: updatedPeak };
        return withTimeline(result, currentPrice);
      }
      return { ...tracked, peakPrice: updatedPeak };
    }

    case "tp1_hit": {
      if (priceCrossed(currentPrice, setup.takeProfit[1], setup.direction)) {
        result = { ...tracked, status: "tp2_hit", highestTpHit: 2, peakPrice: updatedPeak };
        return withTimeline(result, currentPrice);
      }
      return { ...tracked, peakPrice: updatedPeak };
    }

    case "tp2_hit": {
      if (priceCrossed(currentPrice, setup.takeProfit[2], setup.direction)) {
        return withTimeline(
          finalize({ ...tracked, highestTpHit: 3, peakPrice: updatedPeak }, "tp3_hit", currentPrice),
          currentPrice
        );
      }
      return { ...tracked, peakPrice: updatedPeak };
    }

    default:
      return { ...tracked, peakPrice: updatedPeak };
  }
}

/** Append timeline entry on status change */
function withTimeline(tracked: TrackedSetup, price: number): TrackedSetup {
  const timeline = tracked.timeline ?? [];
  const last = timeline[timeline.length - 1];
  // Only append if status actually changed
  if (last && last.status === tracked.status) return tracked;
  return {
    ...tracked,
    timeline: [...timeline, { status: tracked.status, timestamp: Date.now(), price }],
  };
}

// ==================== FINALIZE ====================

function finalize(
  tracked: TrackedSetup,
  terminalStatus: SetupStatus,
  exitPrice: number
): TrackedSetup {
  const outcome = calculateOutcome(terminalStatus);
  const pnlPercent = calculatePnlPercent(tracked.setup, exitPrice, terminalStatus);

  return {
    ...tracked,
    status: terminalStatus,
    closedAt: Date.now(),
    outcome,
    pnlPercent,
    highestTpHit: terminalStatus === "tp3_hit" ? 3
      : terminalStatus === "tp2_hit" ? 2
      : terminalStatus === "tp1_hit" ? 1
      : tracked.highestTpHit,
  };
}

function calculateOutcome(status: SetupStatus): SetupOutcome {
  if (status === "tp1_hit" || status === "tp2_hit" || status === "tp3_hit") return "win";
  if (status === "sl_hit") return "loss";
  return "breakeven"; // expired, invalidated
}

function calculatePnlPercent(
  setup: TradeDeskSetup,
  exitPrice: number,
  status: SetupStatus
): number {
  const entryMid = (setup.entry[0] + setup.entry[1]) / 2;
  if (entryMid === 0) return 0;

  // For expired/invalidated, P&L is 0
  if (status === "expired" || status === "invalidated") return 0;

  const dir = setup.direction === "bullish" ? 1 : -1;
  const pnl = dir * (exitPrice - entryMid);
  return Number(((pnl / entryMid) * 100).toFixed(2));
}

// ==================== HELPERS ====================

export function isSetupActive(status: SetupStatus): boolean {
  return !isTerminal(status);
}

export function getStatusLabel(status: SetupStatus): string {
  const labels: Record<SetupStatus, string> = {
    pending: "Awaiting Entry",
    active: "Entry Zone",
    breakeven: "Running (BE)",
    tp1_hit: "Running (TP1)",
    tp2_hit: "Running (TP2)",
    tp3_hit: "TP3 Hit",
    sl_hit: "SL Hit",
    expired: "Expired",
    invalidated: "Invalidated",
  };
  return labels[status];
}

/** Returns true if the setup is still actionable (can be entered) */
export function isActionable(status: SetupStatus): boolean {
  return status === "pending" || status === "active";
}

/** Returns true if the setup is running in profit (past breakeven) */
export function isRunning(status: SetupStatus): boolean {
  return status === "breakeven" || status === "tp1_hit" || status === "tp2_hit";
}
