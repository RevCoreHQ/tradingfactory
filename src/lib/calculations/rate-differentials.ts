import { INSTRUMENTS } from "@/lib/utils/constants";

/** Map instrument ID to base/quote currencies for carry calculation */
const PAIR_CURRENCY_MAP: Record<string, { base: string; quote: string }> = {
  EUR_USD: { base: "EUR", quote: "USD" },
  GBP_USD: { base: "GBP", quote: "USD" },
  AUD_USD: { base: "AUD", quote: "USD" },
  NZD_USD: { base: "NZD", quote: "USD" },
  USD_JPY: { base: "USD", quote: "JPY" },
  USD_CAD: { base: "USD", quote: "CAD" },
  USD_CHF: { base: "USD", quote: "CHF" },
};

/** Map central bank name to its currency */
const BANK_TO_CURRENCY: Record<string, string> = {
  "Federal Reserve": "USD",
  "European Central Bank": "EUR",
  "Bank of Japan": "JPY",
  "Bank of England": "GBP",
  "Reserve Bank of Australia": "AUD",
  "Reserve Bank of New Zealand": "NZD",
  "Bank of Canada": "CAD",
  "Swiss National Bank": "CHF",
};

export interface RateDifferential {
  pair: string;
  baseCurrency: string;
  quoteCurrency: string;
  baseRate: number;
  quoteRate: number;
  differential: number;
  carryDirection: "long" | "short" | "neutral";
}

/**
 * Compute rate differentials for each forex pair from central bank rate data.
 * Positive differential = base currency pays more → carry favors long.
 */
export function computeRateDifferentials(
  centralBanks: { bank: string; currency?: string; rate: number }[]
): RateDifferential[] {
  const rateMap: Record<string, number> = {};
  for (const cb of centralBanks) {
    const ccy = cb.currency || BANK_TO_CURRENCY[cb.bank];
    if (ccy) rateMap[ccy] = cb.rate;
  }

  const diffs: RateDifferential[] = [];
  for (const [pairId, { base, quote }] of Object.entries(PAIR_CURRENCY_MAP)) {
    const baseRate = rateMap[base];
    const quoteRate = rateMap[quote];
    if (baseRate == null || quoteRate == null) continue;

    const diff = Math.round((baseRate - quoteRate) * 100) / 100;
    const inst = INSTRUMENTS.find((i) => i.id === pairId);
    diffs.push({
      pair: inst?.symbol ?? pairId.replace("_", "/"),
      baseCurrency: base,
      quoteCurrency: quote,
      baseRate,
      quoteRate,
      differential: diff,
      carryDirection: Math.abs(diff) < 0.25 ? "neutral" : diff > 0 ? "long" : "short",
    });
  }
  return diffs;
}
