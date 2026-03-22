import type { TradeDeskSetup, TrackedSetup } from "@/lib/types/signals";

// ==================== TYPES ====================

export interface PortfolioRiskGate {
  canOpenNew: boolean;
  maxRiskAvailable: number; // max risk% this trade can use
  totalRiskPercent: number; // current total portfolio risk%
  reasons: string[];
  currencyExposure: CurrencyExposureEntry[];
  directionalExposure: DirectionalExposureEntry[];
  correlationBlock: boolean;
  drawdownThrottle: number; // 0-1 multiplier (1.0 = no throttle)
}

export interface CurrencyExposureEntry {
  currency: string;
  current: number; // number of positions on this currency
  max: number;
  headroom: number;
}

export interface DirectionalExposureEntry {
  currency: string;
  netLong: number;
  netShort: number;
  netDirection: number; // netLong - netShort (positive = net long)
  limit: number;
}

export interface PortfolioGateConfig {
  maxOpenPositions: number;
  maxCurrencyPositions: number;
  maxCorrelatedPositions: number;
  /** Maximum total portfolio risk as a percentage of account equity.
   *  Default 10% — sum of all open position risk% must not exceed this. */
  maxTotalRiskPercent: number;
  /** Base risk per trade (default 2%). Used to estimate risk of active positions
   *  when actual riskAmount is unavailable (lots=0 mode). */
  baseRiskPercent: number;
  /** Maximum net directional exposure per currency.
   *  E.g., max 3 positions net in the same direction for any single currency. */
  maxDirectionalExposure: number;
}

export const DEFAULT_GATE_CONFIG: PortfolioGateConfig = {
  maxOpenPositions: 5,
  maxCurrencyPositions: 3,
  maxCorrelatedPositions: 2,
  maxTotalRiskPercent: 10,
  baseRiskPercent: 2,
  maxDirectionalExposure: 3,
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

// ==================== DIRECTIONAL EXPOSURE ====================

/**
 * Decompose each position into base/quote currency direction.
 * EURUSD long = EUR long + USD short.
 * Returns net long/short counts per currency.
 */
export function calculateDirectionalExposure(
  activeSetups: TrackedSetup[]
): Record<string, { long: number; short: number }> {
  const exposure: Record<string, { long: number; short: number }> = {};

  const ensure = (currency: string) => {
    if (!exposure[currency]) exposure[currency] = { long: 0, short: 0 };
  };

  for (const tracked of activeSetups) {
    const currencies = INSTRUMENT_CURRENCIES[tracked.setup.instrumentId];
    if (!currencies) continue;

    const dir = tracked.setup.direction;
    if (dir === "neutral") continue;

    ensure(currencies.base);
    ensure(currencies.quote);

    if (dir === "bullish") {
      // Long the pair = long base, short quote
      exposure[currencies.base].long += 1;
      exposure[currencies.quote].short += 1;
    } else {
      // Short the pair = short base, long quote
      exposure[currencies.base].short += 1;
      exposure[currencies.quote].long += 1;
    }
  }

  return exposure;
}

// ==================== TOTAL RISK COMPUTATION ====================

/**
 * Compute the total portfolio risk% from all active positions.
 *
 * Each setup has a conviction tier → tier risk multiplier → effective risk%.
 * Since the system operates without account equity (lots=0 mode), we track
 * the PERCENTAGE risk, which is position-size-independent.
 *
 * The tier risk multipliers are:
 *   A+ = 1.25 × base, A = 1.0, B = 0.75, C = 0.5, D = 0.25
 */
const TIER_RISK_MULTIPLIER: Record<string, number> = {
  "A+": 1.25,
  "A": 1.0,
  "B": 0.75,
  "C": 0.5,
  "D": 0.25,
};

export function calculateTotalRiskPercent(
  activeSetups: TrackedSetup[],
  baseRiskPercent: number = 2
): number {
  let total = 0;
  for (const tracked of activeSetups) {
    const mult = TIER_RISK_MULTIPLIER[tracked.setup.conviction] ?? 1.0;
    // If learning adjusted the risk, use the learning multiplier
    const learningMult = tracked.setup.learningApplied?.riskMultiplier ?? 1.0;
    total += baseRiskPercent * mult * learningMult;
  }
  return Number(total.toFixed(2));
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
 * Now includes max total risk % enforcement.
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

  // 3b. Directional exposure check
  // EURUSD long + GBPUSD long + USDJPY short = all USD weakness.
  // Limit net directional exposure per currency.
  const dirExposure = calculateDirectionalExposure(activeSetups);
  const dirEntries: DirectionalExposureEntry[] = [];

  if (currencies && newSetup.direction !== "neutral") {
    const newDir = newSetup.direction;

    for (const curr of [currencies.base, currencies.quote]) {
      const exp = dirExposure[curr] ?? { long: 0, short: 0 };
      const isBase = curr === currencies.base;
      // Determine which direction this currency goes for the new trade
      const addLong = (isBase && newDir === "bullish") || (!isBase && newDir === "bearish") ? 1 : 0;
      const addShort = (isBase && newDir === "bearish") || (!isBase && newDir === "bullish") ? 1 : 0;
      const newLong = exp.long + addLong;
      const newShort = exp.short + addShort;
      const netDirection = newLong - newShort;

      dirEntries.push({
        currency: curr,
        netLong: newLong,
        netShort: newShort,
        netDirection,
        limit: config.maxDirectionalExposure,
      });

      if (Math.abs(netDirection) > config.maxDirectionalExposure) {
        canOpenNew = false;
        const dirLabel = netDirection > 0 ? "long" : "short";
        reasons.push(
          `${curr} net ${dirLabel} exposure would reach ${Math.abs(netDirection)} (max ${config.maxDirectionalExposure})`
        );
      }
    }
  }

  // 4. Drawdown throttle
  const consecutiveLosses = countConsecutiveLosses(historySetups);
  const throttle = drawdownThrottle(consecutiveLosses);

  if (throttle < 1.0) {
    reasons.push(
      `Drawdown throttle active: ${consecutiveLosses} consecutive losses → ${(throttle * 100).toFixed(0)}% position size`
    );
  }

  // 5. Max total risk % enforcement
  // Sum risk% across all active positions + the proposed new trade.
  // Block if total would exceed the portfolio risk budget.
  const currentTotalRisk = calculateTotalRiskPercent(activeSetups, config.baseRiskPercent);
  const newTradeRisk = (() => {
    const mult = TIER_RISK_MULTIPLIER[newSetup.conviction] ?? 1.0;
    const learningMult = newSetup.learningApplied?.riskMultiplier ?? 1.0;
    return config.baseRiskPercent * mult * learningMult;
  })();

  const projectedTotalRisk = currentTotalRisk + newTradeRisk;
  const maxRiskAvailable = Math.max(0, Number((config.maxTotalRiskPercent - currentTotalRisk).toFixed(2)));

  if (projectedTotalRisk > config.maxTotalRiskPercent) {
    canOpenNew = false;
    reasons.push(
      `Total portfolio risk would exceed budget: ${projectedTotalRisk.toFixed(1)}% > ${config.maxTotalRiskPercent}% max (current: ${currentTotalRisk.toFixed(1)}%, new trade: ${newTradeRisk.toFixed(1)}%)`
    );
  }

  return {
    canOpenNew,
    maxRiskAvailable,
    totalRiskPercent: currentTotalRisk,
    reasons,
    currencyExposure: exposureEntries,
    directionalExposure: dirEntries,
    correlationBlock,
    drawdownThrottle: throttle,
  };
}
