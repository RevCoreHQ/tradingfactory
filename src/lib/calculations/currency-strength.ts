import type { CurrencyStrengthData } from "@/lib/types/market";
import { MAJOR_CURRENCIES } from "@/lib/utils/constants";

export function calculateCurrencyStrength(
  rates: Record<string, number>
): CurrencyStrengthData[] {
  const strengths: CurrencyStrengthData[] = [];

  for (const currency of MAJOR_CURRENCIES) {
    const totalChange = 0;
    let pairCount = 0;
    const pairs: { pair: string; rate: number; change: number }[] = [];

    for (const other of MAJOR_CURRENCIES) {
      if (currency === other) continue;

      const key = `${currency}/${other}`;
      const rate = rates[other] && rates[currency]
        ? rates[other] / rates[currency]
        : 0;

      if (rate > 0) {
        pairs.push({ pair: key, rate, change: 0 });
        pairCount++;
      }
    }

    // Normalize to 0-100 based on position relative to average
    const strength = 50 + totalChange / Math.max(pairCount, 1);

    strengths.push({
      currency,
      strength: Math.max(0, Math.min(100, strength)),
      change24h: 0,
      pairs,
    });
  }

  // Normalize strengths relative to each other
  if (strengths.length > 0) {
    const min = Math.min(...strengths.map((s) => s.strength));
    const max = Math.max(...strengths.map((s) => s.strength));
    const range = max - min || 1;

    for (const s of strengths) {
      s.strength = ((s.strength - min) / range) * 100;
    }
  }

  return strengths.sort((a, b) => b.strength - a.strength);
}

export function calculateCorrelation(seriesA: number[], seriesB: number[]): number {
  const n = Math.min(seriesA.length, seriesB.length);
  if (n < 10) return 0;

  const a = seriesA.slice(-n);
  const b = seriesB.slice(-n);

  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;

  let sumAB = 0;
  let sumA2 = 0;
  let sumB2 = 0;

  for (let i = 0; i < n; i++) {
    const dA = a[i] - meanA;
    const dB = b[i] - meanB;
    sumAB += dA * dB;
    sumA2 += dA * dA;
    sumB2 += dB * dB;
  }

  const denom = Math.sqrt(sumA2 * sumB2);
  return denom === 0 ? 0 : sumAB / denom;
}

export function buildCorrelationMatrix(
  priceHistory: Record<string, number[]>
): { instruments: string[]; matrix: number[][] } {
  const instruments = Object.keys(priceHistory);
  const matrix: number[][] = [];

  for (let i = 0; i < instruments.length; i++) {
    matrix[i] = [];
    for (let j = 0; j < instruments.length; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else if (j < i) {
        matrix[i][j] = matrix[j][i]; // Symmetric
      } else {
        matrix[i][j] = calculateCorrelation(
          priceHistory[instruments[i]],
          priceHistory[instruments[j]]
        );
      }
    }
  }

  return { instruments, matrix };
}
