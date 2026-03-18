import type { SmartAlert, AlertConfig, AlertSeverity } from "@/lib/types/alerts";
import type { BiasResult } from "@/lib/types/bias";
import type { LLMAnalysisResult } from "@/lib/types/llm";
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

export function evaluateAlerts(
  prices: Record<string, number>,
  biasResults: Record<string, BiasResult>,
  llmResults: Record<string, LLMAnalysisResult> | null,
  existingAlerts: SmartAlert[],
  config: AlertConfig
): SmartAlert[] {
  if (!config.enabled) return [];

  const newAlerts: SmartAlert[] = [];
  const cooldownMs = config.cooldownMinutes * 60 * 1000;
  const now = Date.now();
  const active = existingAlerts.filter((a) => !a.dismissed && a.expiresAt > now);

  for (const inst of INSTRUMENTS) {
    const price = prices[inst.id];
    const bias = biasResults[inst.id];
    const llm = llmResults?.[inst.id];
    if (!price || price === 0 || !bias) continue;

    // Check key levels from LLM
    if (llm?.keyLevels) {
      const { support, resistance } = llm.keyLevels;
      const proximityThreshold = price * (config.proximityPercent / 100);

      // Approaching support
      if (support > 0 && Math.abs(price - support) < proximityThreshold) {
        const isBullish = bias.overallBias > 10;
        if (!isOnCooldown(active, inst.id, "confluence_approach", cooldownMs)) {
          const severity: AlertSeverity = isBullish ? "warning" : "info";
          newAlerts.push({
            id: makeId(),
            type: "confluence_approach",
            instrumentId: inst.id,
            title: `${inst.symbol} near support`,
            message: `Price ${price.toFixed(inst.decimalPlaces)} approaching support at ${support.toFixed(inst.decimalPlaces)}${isBullish ? " — aligned with bullish bias" : ""}`,
            severity,
            level: support,
            createdAt: now,
            dismissed: false,
            expiresAt: now + ALERT_TTL_MS,
          });
        }
      }

      // Approaching resistance
      if (resistance > 0 && Math.abs(price - resistance) < proximityThreshold) {
        const isBearish = bias.overallBias < -10;
        if (!isOnCooldown(active, inst.id, "confluence_approach", cooldownMs)) {
          const severity: AlertSeverity = isBearish ? "warning" : "info";
          newAlerts.push({
            id: makeId(),
            type: "confluence_approach",
            instrumentId: inst.id,
            title: `${inst.symbol} near resistance`,
            message: `Price ${price.toFixed(inst.decimalPlaces)} approaching resistance at ${resistance.toFixed(inst.decimalPlaces)}${isBearish ? " — aligned with bearish bias" : ""}`,
            severity,
            level: resistance,
            createdAt: now,
            dismissed: false,
            expiresAt: now + ALERT_TTL_MS,
          });
        }
      }
    }

    // Bias shift: strong bias (>50 or <-50)
    if (Math.abs(bias.overallBias) > 50 && bias.confidence > 70) {
      if (!isOnCooldown(active, inst.id, "bias_shift", cooldownMs)) {
        const dir = bias.overallBias > 0 ? "bullish" : "bearish";
        newAlerts.push({
          id: makeId(),
          type: "bias_shift",
          instrumentId: inst.id,
          title: `Strong ${dir} bias on ${inst.symbol}`,
          message: `Bias score ${bias.overallBias > 0 ? "+" : ""}${Math.round(bias.overallBias)} with ${Math.round(bias.confidence)}% confidence`,
          severity: "danger",
          createdAt: now,
          dismissed: false,
          expiresAt: now + ALERT_TTL_MS,
        });
      }
    }
  }

  // Limit total new alerts
  return newAlerts.slice(0, config.maxActiveAlerts - active.length);
}

export function pruneExpiredAlerts(alerts: SmartAlert[]): SmartAlert[] {
  const now = Date.now();
  return alerts.filter((a) => !a.dismissed && a.expiresAt > now);
}
