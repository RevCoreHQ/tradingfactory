import type {
  TrackedSetup,
  PortfolioRisk,
  RiskConfig,
  RiskStatus,
} from "@/lib/types/signals";
import { DEFAULT_RISK_CONFIG } from "@/lib/types/signals";

// ==================== Risk Status ====================

export function determineRiskStatus(
  config: RiskConfig,
  openPositions: number
): { status: RiskStatus; warnings: string[] } {
  const warnings: string[] = [];
  let severity = 0;

  if (openPositions >= config.maxOpenPositions) {
    severity = Math.max(severity, 1);
    warnings.push(`Max open positions reached (${openPositions}/${config.maxOpenPositions})`);
  }

  const status: RiskStatus = severity === 2 ? "STOP" : severity === 1 ? "CAUTION" : "CLEAR";
  return { status, warnings };
}

// ==================== Master Function ====================

export function computePortfolioRisk(
  riskPercent: number,
  activeSetups: TrackedSetup[],
  config: RiskConfig = DEFAULT_RISK_CONFIG
): PortfolioRisk {
  const openPositions = activeSetups.length;

  const { status, warnings } = determineRiskStatus(config, openPositions);

  const canTrade = status !== "STOP";
  const warning = warnings.length > 0 ? warnings[0] : null;

  return {
    riskPercent,
    canTrade,
    warning,
    riskStatus: status,
    openPositions,
    warnings,
  };
}
