import type { BiasResult } from "@/lib/types/bias";
import type { CurrencyExposure, CorrelationWarning, PortfolioRiskAssessment } from "@/lib/types/risk";
import { INSTRUMENTS } from "@/lib/utils/constants";

/** Map instrument to its currency pair decomposition */
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
};

/** Well-known correlation pairs */
const CORRELATED_GROUPS = [
  { pairs: ["EUR_USD", "GBP_USD"], label: "EUR & GBP vs USD" },
  { pairs: ["AUD_USD", "NZD_USD"], label: "AUD & NZD vs USD" },
  { pairs: ["US100", "US30"], label: "US indices" },
  { pairs: ["BTC_USD", "ETH_USD"], label: "Crypto" },
];

/**
 * Calculate net currency exposure from all bias results.
 * Bullish EUR/USD → long EUR, short USD.
 * Bearish USD/JPY → short USD, long JPY.
 */
export function calculateCurrencyExposures(
  biasResults: Record<string, BiasResult>
): CurrencyExposure[] {
  const exposureMap: Record<string, { net: number; pairs: CurrencyExposure["contributingPairs"] }> = {};

  for (const inst of INSTRUMENTS) {
    const bias = biasResults[inst.id];
    if (!bias || bias.direction === "neutral") continue;

    const currencies = INSTRUMENT_CURRENCIES[inst.id];
    if (!currencies) continue;

    const isBullish = bias.overallBias > 0;
    const strength = Math.abs(bias.overallBias) / 100; // 0-1

    // Base currency: bullish on pair = long base
    if (!exposureMap[currencies.base]) {
      exposureMap[currencies.base] = { net: 0, pairs: [] };
    }
    exposureMap[currencies.base].net += isBullish ? strength : -strength;
    exposureMap[currencies.base].pairs.push({
      instrumentId: inst.id,
      direction: isBullish ? "long" : "short",
      biasStrength: Math.abs(bias.overallBias),
    });

    // Quote currency: bullish on pair = short quote
    if (!exposureMap[currencies.quote]) {
      exposureMap[currencies.quote] = { net: 0, pairs: [] };
    }
    exposureMap[currencies.quote].net += isBullish ? -strength : strength;
    exposureMap[currencies.quote].pairs.push({
      instrumentId: inst.id,
      direction: isBullish ? "short" : "long",
      biasStrength: Math.abs(bias.overallBias),
    });
  }

  return Object.entries(exposureMap)
    .map(([currency, data]) => ({
      currency,
      netExposure: Math.round(data.net * 100) / 100,
      contributingPairs: data.pairs,
    }))
    .filter((e) => Math.abs(e.netExposure) > 0.05)
    .sort((a, b) => Math.abs(b.netExposure) - Math.abs(a.netExposure));
}

/**
 * Detect correlation warnings from current bias state.
 */
export function detectCorrelationWarnings(
  biasResults: Record<string, BiasResult>
): CorrelationWarning[] {
  const warnings: CorrelationWarning[] = [];

  for (const group of CORRELATED_GROUPS) {
    const activeInGroup = group.pairs.filter((id) => {
      const b = biasResults[id];
      return b && b.direction !== "neutral";
    });

    if (activeInGroup.length < 2) continue;

    const directions = activeInGroup.map((id) => biasResults[id].overallBias > 0 ? "long" : "short");
    const allSame = directions.every((d) => d === directions[0]);

    if (allSame) {
      const dir = directions[0];
      warnings.push({
        type: dir === "long" ? "correlated_longs" : "correlated_shorts",
        severity: activeInGroup.length >= 3 ? "danger" : "warning",
        message: `${activeInGroup.length} correlated ${dir}s: ${group.label}`,
        instruments: activeInGroup,
      });
    } else {
      warnings.push({
        type: "hedged",
        severity: "info",
        message: `Mixed signals in ${group.label} — partial hedge`,
        instruments: activeInGroup,
      });
    }
  }

  // Check total USD exposure
  const exposures = calculateCurrencyExposures(biasResults);
  const usdExposure = exposures.find((e) => e.currency === "USD");
  if (usdExposure && Math.abs(usdExposure.netExposure) > 1.5) {
    warnings.push({
      type: "double_exposure",
      severity: "danger",
      message: `Heavy USD ${usdExposure.netExposure > 0 ? "long" : "short"} (${Math.abs(usdExposure.netExposure).toFixed(1)}x)`,
      instruments: usdExposure.contributingPairs.map((p) => p.instrumentId),
    });
  }

  return warnings;
}

/**
 * Calculate a diversification score (0-100).
 * 100 = perfectly balanced, 0 = all concentration in one direction.
 */
export function calculateDiversificationScore(
  exposures: CurrencyExposure[]
): number {
  if (exposures.length === 0) return 100;

  const totalAbsExposure = exposures.reduce((sum, e) => sum + Math.abs(e.netExposure), 0);
  if (totalAbsExposure === 0) return 100;

  // Max possible exposure if all instruments maxed in one direction
  const maxPossible = INSTRUMENTS.length / 5; // normalized
  const concentration = totalAbsExposure / Math.max(maxPossible, totalAbsExposure);

  // Count distinct currencies with significant exposure
  const significantCurrencies = exposures.filter((e) => Math.abs(e.netExposure) > 0.2).length;
  const diversityBonus = Math.min(significantCurrencies * 10, 30);

  return Math.round(Math.max(0, Math.min(100, (1 - concentration) * 70 + diversityBonus)));
}

/**
 * Full portfolio risk assessment.
 */
export function assessPortfolioRisk(
  biasResults: Record<string, BiasResult>
): PortfolioRiskAssessment {
  const exposures = calculateCurrencyExposures(biasResults);
  const warnings = detectCorrelationWarnings(biasResults);
  const diversificationScore = calculateDiversificationScore(exposures);

  const dangerCount = warnings.filter((w) => w.severity === "danger").length;
  const concentrationRisk: PortfolioRiskAssessment["concentrationRisk"] =
    dangerCount >= 2 || diversificationScore < 30
      ? "high"
      : dangerCount >= 1 || diversificationScore < 50
      ? "medium"
      : "low";

  return {
    exposures,
    warnings,
    diversificationScore,
    concentrationRisk,
  };
}
