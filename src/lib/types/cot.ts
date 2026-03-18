export interface COTPosition {
  currency: string;
  reportDate: string;
  longSpeculative: number;
  shortSpeculative: number;
  netSpeculative: number;
  longCommercial: number;
  shortCommercial: number;
  netCommercial: number;
  openInterest: number;
  netSpecChange: number; // week-over-week change
  percentLong: number; // speculative long as % of total spec positions
}

export interface COTData {
  positions: COTPosition[];
  lastUpdated: string;
}

// CFTC commodity codes for currency futures (CME)
export const CFTC_CURRENCY_CODES: Record<string, string> = {
  EUR: "099741",
  GBP: "096742",
  JPY: "097741",
  AUD: "232741",
  NZD: "112741",
  CAD: "090741",
  CHF: "092741",
  USD: "098662", // Dollar Index
  XAU: "088691", // Gold
};

// Map instrument currencies to what COT data tells us
// e.g., EUR_USD → look at EUR positioning (long EUR = bullish EUR/USD)
export const INSTRUMENT_COT_MAP: Record<string, { currency: string; invert: boolean }> = {
  EUR_USD: { currency: "EUR", invert: false },
  GBP_USD: { currency: "GBP", invert: false },
  AUD_USD: { currency: "AUD", invert: false },
  NZD_USD: { currency: "NZD", invert: false },
  USD_JPY: { currency: "JPY", invert: true }, // Long JPY = bearish USD/JPY
  USD_CAD: { currency: "CAD", invert: true },
  USD_CHF: { currency: "CHF", invert: true },
  XAU_USD: { currency: "XAU", invert: false },
};
