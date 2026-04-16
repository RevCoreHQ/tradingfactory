// ============================================================
// trade-classifier.ts — classify a trade idea as scalp / intraday / swing
//
// Uses SL distance in ATR, TP horizon, and timeframe context.
// Called by TradeIdeaGenerator before persisting.
// ============================================================

import type { TradeType } from '@/lib/types/trade-idea';

export interface ClassificationInput {
  /** Stop loss distance in ATR multiples (e.g. 0.5 = half ATR stop) */
  slDistanceATR: number;
  /** Highest TP level R-multiple (e.g. 3 = 3R target) */
  maxTPMultiple: number;
  /** Bias result timeframe */
  biasTimeframe: 'intraday' | 'intraweek';
  /** Regime structure from FullRegime */
  regimeStructure?: 'trend' | 'range' | 'breakout';
  /** Is the setup originating from the mechanical desk on 1h/4h? */
  mechanicalTimeframe?: '15m' | '1h' | '4h' | '1d';
  /** Conviction tier from mechanical desk */
  convictionTier?: string;
}

export interface ClassificationResult {
  trade_type: TradeType;
  reasoning: string;
}

/**
 * Classify a setup into scalp / intraday / swing.
 *
 * Decision matrix:
 * ┌─────────────────────┬──────────────────────────────────────────────────┐
 * │ SCALP               │ SL ≤ 0.5 ATR OR mech TF = 15m                  │
 * │ SWING               │ biasTimeframe = intraweek OR mech TF = 4h/1d    │
 * │                     │ OR maxTP ≥ 3 AND slDistanceATR ≥ 1.5            │
 * │ INTRADAY            │ everything else                                  │
 * └─────────────────────┴──────────────────────────────────────────────────┘
 */
export function classifyTradeType(input: ClassificationInput): ClassificationResult {
  const {
    slDistanceATR,
    maxTPMultiple,
    biasTimeframe,
    mechanicalTimeframe,
    convictionTier,
  } = input;

  // Scalp: very tight stop or execution TF is 15m
  if (slDistanceATR <= 0.5 || mechanicalTimeframe === '15m') {
    return {
      trade_type: 'scalp',
      reasoning: `SL distance ${slDistanceATR.toFixed(2)} ATR${mechanicalTimeframe === '15m' ? ', 15m execution TF' : ''}`,
    };
  }

  // Swing: multi-day bias, 4H/Daily setup, or large TP target with wide SL
  if (
    biasTimeframe === 'intraweek' ||
    mechanicalTimeframe === '4h' ||
    mechanicalTimeframe === '1d' ||
    (maxTPMultiple >= 3 && slDistanceATR >= 1.5)
  ) {
    const reasons: string[] = [];
    if (biasTimeframe === 'intraweek') reasons.push('intraweek bias');
    if (mechanicalTimeframe === '4h' || mechanicalTimeframe === '1d') reasons.push(`${mechanicalTimeframe} TF`);
    if (maxTPMultiple >= 3 && slDistanceATR >= 1.5) reasons.push(`${maxTPMultiple}R target / ${slDistanceATR.toFixed(2)} ATR SL`);
    if (convictionTier === 'A+' || convictionTier === 'A') reasons.push(`${convictionTier} conviction`);
    return {
      trade_type: 'swing',
      reasoning: reasons.join(', '),
    };
  }

  // Default: intraday
  return {
    trade_type: 'intraday',
    reasoning: `SL ${slDistanceATR.toFixed(2)} ATR, TP ${maxTPMultiple.toFixed(1)}R, intraday bias`,
  };
}

/** Derive SL distance in ATR from price levels. */
export function slInATR(entryRef: number, stopLoss: number, atr: number): number {
  if (atr === 0) return 1;
  return Math.abs(entryRef - stopLoss) / atr;
}

/** Derive trade type expiry in milliseconds. */
export function getIdeaExpiry(trade_type: TradeType): number {
  switch (trade_type) {
    case 'scalp':    return 4  * 3_600_000;  // 4h
    case 'intraday': return 24 * 3_600_000;  // 24h
    case 'swing':    return 7  * 24 * 3_600_000; // 7 days
  }
}
