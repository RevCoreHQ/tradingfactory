import type {
  TrackedSetup,
  PortfolioRisk,
  RiskConfig,
  RiskStatus,
} from "@/lib/types/signals";
import { DEFAULT_RISK_CONFIG } from "@/lib/types/signals";

// ==================== Portfolio Heat ====================

export function calculatePortfolioHeat(
  activeSetups: TrackedSetup[],
  equity: number
): number {
  if (equity <= 0 || activeSetups.length === 0) return 0;
  const totalRisk = activeSetups.reduce(
    (sum, t) => sum + t.setup.riskAmount,
    0
  );
  return Number(((totalRisk / equity) * 100).toFixed(2));
}

// ==================== Daily P&L ====================

function getStartOfDay(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function getStartOfWeek(): number {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = start of week
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function calculateDailyPnl(
  historySetups: TrackedSetup[],
  equity: number
): { pnl: number; pnlPercent: number } {
  const startOfDay = getStartOfDay();
  const todaySetups = historySetups.filter(
    (t) => t.closedAt && t.closedAt >= startOfDay
  );

  const pnl = todaySetups.reduce((sum, t) => {
    if (t.pnlPercent === null) return sum;
    return sum + (t.pnlPercent / 100) * equity;
  }, 0);

  const pnlPercent = equity > 0 ? (pnl / equity) * 100 : 0;
  return { pnl: Number(pnl.toFixed(2)), pnlPercent: Number(pnlPercent.toFixed(2)) };
}

export function calculateWeeklyPnl(
  historySetups: TrackedSetup[],
  equity: number
): { pnl: number; pnlPercent: number } {
  const startOfWeek = getStartOfWeek();
  const weekSetups = historySetups.filter(
    (t) => t.closedAt && t.closedAt >= startOfWeek
  );

  const pnl = weekSetups.reduce((sum, t) => {
    if (t.pnlPercent === null) return sum;
    return sum + (t.pnlPercent / 100) * equity;
  }, 0);

  const pnlPercent = equity > 0 ? (pnl / equity) * 100 : 0;
  return { pnl: Number(pnl.toFixed(2)), pnlPercent: Number(pnlPercent.toFixed(2)) };
}

// ==================== Risk Status ====================

export function determineRiskStatus(
  config: RiskConfig,
  heat: number,
  dailyPnlPercent: number,
  weeklyPnlPercent: number,
  openPositions: number
): { status: RiskStatus; warnings: string[] } {
  const warnings: string[] = [];
  // 0=CLEAR, 1=CAUTION, 2=STOP — only escalate, never downgrade
  let severity = 0;

  // Daily loss check
  if (dailyPnlPercent <= -config.maxDailyLossPercent) {
    severity = 2;
    warnings.push(`Daily loss limit hit (${dailyPnlPercent.toFixed(1)}% / -${config.maxDailyLossPercent}%)`);
  } else if (dailyPnlPercent <= -config.maxDailyLossPercent * 0.6) {
    severity = Math.max(severity, 1);
    warnings.push(`Approaching daily loss limit (${dailyPnlPercent.toFixed(1)}% / -${config.maxDailyLossPercent}%)`);
  }

  // Weekly loss check
  if (weeklyPnlPercent <= -config.maxWeeklyLossPercent) {
    severity = 2;
    warnings.push(`Weekly loss limit hit (${weeklyPnlPercent.toFixed(1)}% / -${config.maxWeeklyLossPercent}%)`);
  } else if (weeklyPnlPercent <= -config.maxWeeklyLossPercent * 0.6) {
    severity = Math.max(severity, 1);
    warnings.push(`Approaching weekly loss limit (${weeklyPnlPercent.toFixed(1)}% / -${config.maxWeeklyLossPercent}%)`);
  }

  // Portfolio heat check
  if (heat >= config.maxPortfolioHeat) {
    severity = 2;
    warnings.push(`Portfolio heat maxed (${heat.toFixed(1)}% / ${config.maxPortfolioHeat}%)`);
  } else if (heat >= config.maxPortfolioHeat * 0.6) {
    severity = Math.max(severity, 1);
    warnings.push(`Portfolio heat elevated (${heat.toFixed(1)}% / ${config.maxPortfolioHeat}%)`);
  }

  // Open positions check
  if (openPositions >= config.maxOpenPositions) {
    severity = Math.max(severity, 1);
    warnings.push(`Max open positions reached (${openPositions}/${config.maxOpenPositions})`);
  }

  const status: RiskStatus = severity === 2 ? "STOP" : severity === 1 ? "CAUTION" : "CLEAR";
  return { status, warnings };
}

// ==================== Master Function ====================

export function computePortfolioRisk(
  equity: number,
  riskPercent: number,
  activeSetups: TrackedSetup[],
  historySetups: TrackedSetup[],
  config: RiskConfig = DEFAULT_RISK_CONFIG
): PortfolioRisk {
  const heat = calculatePortfolioHeat(activeSetups, equity);
  const daily = calculateDailyPnl(historySetups, equity);
  const weekly = calculateWeeklyPnl(historySetups, equity);
  const openPositions = activeSetups.length;

  const { status, warnings } = determineRiskStatus(
    config,
    heat,
    daily.pnlPercent,
    weekly.pnlPercent,
    openPositions
  );

  const canTrade = status !== "STOP";
  const warning = warnings.length > 0 ? warnings[0] : null;

  return {
    accountEquity: equity,
    riskPerTrade: equity * (riskPercent / 100),
    riskPercent,
    portfolioHeat: heat,
    canTrade,
    warning,
    riskStatus: status,
    dailyPnl: daily.pnl,
    dailyPnlPercent: daily.pnlPercent,
    weeklyPnl: weekly.pnl,
    weeklyPnlPercent: weekly.pnlPercent,
    openPositions,
    warnings,
  };
}
