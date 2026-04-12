import type { BiasResult } from "@/lib/types/bias";
import { formatPrice } from "@/lib/utils/formatters";

/**
 * Plain-language lines for the instrument card: actionable ATR-based zones from `tradeSetup`.
 * Structural S/R and confluence live in Deep analysis — this is the desk’s mechanical frame only.
 */
export function buildDeskWatchNote(
  bias: BiasResult,
  decimalPlaces: number
): { lines: string[]; footnote: string } | null {
  const ts = bias.tradeSetup;
  if (!ts) return null;

  const fmt = (p: number) => formatPrice(p, decimalPlaces);
  const [e0, e1] = ts.entryZone;
  const bearish = bias.direction.includes("bearish");
  const bullish = bias.direction.includes("bullish");

  const lines: string[] = [];

  if (bearish) {
    lines.push(
      `On a retest higher, the desk frames sells between ${fmt(e0)} and ${fmt(e1)} (bounce / premium zone).`
    );
  } else if (bullish) {
    lines.push(
      `On a dip, the desk frames longs between ${fmt(e0)} and ${fmt(e1)} (discount / pullback zone).`
    );
  } else {
    lines.push(
      `No strong directional lean — mechanical scale-in band ${fmt(e0)}–${fmt(e1)} around current activity.`
    );
  }

  lines.push(
    `If price accepts beyond ${fmt(ts.stopLoss)}, treat it as invalidating this mechanical lean (ATR stop reference).`
  );

  lines.push(
    `ATR stretch targets: ${fmt(ts.takeProfit[0])} → ${fmt(ts.takeProfit[1])} → ${fmt(ts.takeProfit[2])} (R:R ${ts.riskReward[0]} / ${ts.riskReward[1]} / ${ts.riskReward[2]}).`
  );

  if (ts.riskReason) {
    lines.push(`Sizing: ${ts.riskReason}`);
  }

  return {
    lines,
    footnote:
      "These prices come from the desk’s ATR model, not live chart S/R. Use Deep dive for swing levels, pivots, and confluence.",
  };
}
