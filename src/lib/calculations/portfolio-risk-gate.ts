import type { TradeDeskSetup, TrackedSetup } from "@/lib/types/signals";

// ==================== TYPES ====================

export interface PortfolioRiskGate {
  canOpenNew: boolean;
  maxRiskAvailable: number; // max risk% this trade can use
  reasons: string[];
  currencyExposure: CurrencyExposureEntry[];
  correlationBlock: boolean;
  drawdownThrottle: number; // 0-1 multiplier (1.0 = no throttle)
}

export interface CurrencyExposureEntry {
  currency: string;
  current: number; // number of positions on this currency
  max: number;
  headroom: number;
}

export interface PortfolioGateConfig {
  maxOpenPositions: number;
  maxCurrencyPositions: number;
  maxCorrelatedPositions: number;
}

export const DEFAULT_GATE_CONFIG: PortfolioGateConfig = {
  maxOpenPositions: 5,
  maxCurrencyPositions: 3,
  maxCorrelatedPositions: 2,
};

// ==================== CURRENCY DECOMPOSITION ====================

const INSTRUMENT_CURRENCIES: Record<string, { base: string; quote: string }> = {
  EUR_USD: { base: "EUR", quote: "USD" },
  GBP_USD: { base: "GBP", quote: "USD" },
  AUD_USD: { base: "AUD", quote: "USD" },
  NZD_USD: { base: "NZD", quote: "USD" },
  USD_JPY: { base: "USD", quote: "JPY" },
  USD_CAD: { base: "USD", quote: "CAD" },
  USD_CHF: { base: "USD", quote: "CHF" },
  XAU_USD: { base: "XAU", quote: "USD" },
  BTC_USD: { base: "BTC", quote: "USD" },
  ETH_USD: { base: "ETH", quote: "USD" },
  US100:   { base: "US100", quote: "USD" },
  US30:    { base: "US30", quote: "USD" },
  SPX500:  { base: "SPX500", quote: "USD" },
  US2000:  { base: "US2000", quote: "USD" },
};

const CORRELATED_GROUPS = [
  ["EUR_USD", "GBP_USD"],
  ["AUD_USD", "NZD_USD"],
  ["US100", "US30", "SPX500", "US2000"],
  ["BTC_USD", "ETH_USD"],
];

// ==================== POSITION-BASED EXPOSURE ====================

/**
 * Count positions per currency from active tracked setups.
 */
export function calculatePositionExposure(
  activeSetups: TrackedSetup[]
): Record<string, number> {
  const exposure: Record<string, number> = {};

  for (const tracked of activeSetups) {
    const currencies = INSTRUMENT_CURRENCIES[tracked.setup.instrumentId];
    if (!currencies) continue;

    exposure[currencies.base] = (exposure[currencies.base] ?? 0) + 1;
    exposure[currencies.quote] = (exposure[currencies.quote] ?? 0) + 1;
  }

  return exposure;
}

// ==================== CONSECUTIVE LOSSES ====================

/**
 * Count consecutive losses from most recent trades backward.
 */
export function countConsecutiveLosses(historySetups: TrackedSetup[]): number {
  // Sort by closedAt descending
  const sorted = [...historySetups]
    .filter((t) => t.closedAt && t.outcome)
    .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));

  let count = 0;
  for (const t of sorted) {
    if (t.outcome === "loss") count++;
    else break;
  }
  return count;
}

// ==================== DRAWDOWN THROTTLE ====================

/**
 * Multiplier based on consecutive losses.
 * 0-1 losses → 1.0, 2 → 0.75, 3 → 0.50, 4+ → 0.25
 */
export function drawdownThrottle(consecutiveLosses: number): number {
  if (consecutiveLosses <= 1) return 1.0;
  if (consecutiveLosses === 2) return 0.75;
  if (consecutiveLosses === 3) return 0.50;
  return 0.25;
}

// ==================== CORRELATION CHECK ====================

function countCorrelatedPositions(
  instrumentId: string,
  activeSetups: TrackedSetup[]
): number {
  const activeIds = activeSetups.map((t) => t.setup.instrumentId);
  const group = CORRELATED_GROUPS.find((g) => g.includes(instrumentId));
  if (!group) return 0;

  return activeIds.filter((id) => id !== instrumentId && group.includes(id)).length;
}

// ==================== MASTER GATE ====================

/**
 * Evaluate whether a new setup can be opened given portfolio constraints.
 */
export function evaluatePortfolioGate(
  newSetup: TradeDeskSetup,
  activeSetups: TrackedSetup[],
  historySetups: TrackedSetup[],
  config: PortfolioGateConfig = DEFAULT_GATE_CONFIG
): PortfolioRiskGate {
  const reasons: string[] = [];
  let canOpenNew = true;

  // 1. Max open positions
  if (activeSetups.length >= config.maxOpenPositions) {
    canOpenNew = false;
    reasons.push(
      `Max open positions reached (${activeSetups.length}/${config.maxOpenPositions})`
    );
  }

  // 2. Currency exposure (count-based)
  const currExposure = calculatePositionExposure(activeSetups);
  const currencies = INSTRUMENT_CURRENCIES[newSetup.instrumentId];
  const exposureEntries: CurrencyExposureEntry[] = [];

  if (currencies) {
    for (const curr of [currencies.base, currencies.quote]) {
      const currentCount = currExposure[curr] ?? 0;
      const headroom = config.maxCurrencyPositions - currentCount;

      exposureEntries.push({
        currency: curr,
        current: currentCount,
        max: config.maxCurrencyPositions,
        headroom,
      });

      if (currentCount + 1 > config.maxCurrencyPositions) {
        canOpenNew = false;
        reasons.push(
          `${curr} exposure maxed (${currentCount}/${config.maxCurrencyPositions} positions)`
        );
      }
    }
  }

  // 3. Correlation blocking
  const correlatedCount = countCorrelatedPositions(
    newSetup.instrumentId,
    activeSetups
  );
  const correlationBlock = correlatedCount >= config.maxCorrelatedPositions;

  if (correlationBlock) {
    canOpenNew = false;
    reasons.push(
      `${correlatedCount} correlated positions already open (max ${config.maxCorrelatedPositions})`
    );
  }

  // 4. Drawdown throttle
  const consecutiveLosses = countConsecutiveLosses(historySetups);
  const throttle = drawdownThrottle(consecutiveLosses);

  if (throttle < 1.0) {
    reasons.push(
      `Drawdown throttle active: ${consecutiveLosses} consecutive losses → ${(throttle * 100).toFixed(0)}% position size`
    );
  }

  return {
    canOpenNew,
    maxRiskAvailable: 0,
    reasons,
    currencyExposure: exposureEntries,
    correlationBlock,
    drawdownThrottle: throttle,
  };
}
