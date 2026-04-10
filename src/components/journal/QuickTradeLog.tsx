"use client";

import { useState } from "react";
import { useTradeJournal } from "@/lib/hooks/useTradeJournal";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen, TrendingUp, TrendingDown } from "lucide-react";
import type { BiasResult } from "@/lib/types/bias";
import type { TradeSetupType } from "@/lib/types/journal";

const SETUP_OPTIONS: { value: TradeSetupType; label: string }[] = [
  { value: "with_trend", label: "With trend" },
  { value: "pullback", label: "Pullback" },
  { value: "counter_trend", label: "Counter-trend" },
  { value: "breakout", label: "Breakout" },
  { value: "news_play", label: "News / catalyst" },
  { value: "other", label: "Other" },
];

function defaultSetupType(bias: BiasResult | null): TradeSetupType {
  if (!bias?.tradeGuidance) return "other";
  switch (bias.tradeGuidance) {
    case "with_trend":
      return "with_trend";
    case "pullback":
      return "pullback";
    case "counter_trend_scalp":
      return "counter_trend";
    case "caution_events":
      return "news_play";
    default:
      return "other";
  }
}

export function QuickTradeLog({
  instrumentId,
  biasResult,
  currentPrice,
}: {
  instrumentId: string;
  biasResult: BiasResult | null;
  currentPrice: number;
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"long" | "short">(
    biasResult && biasResult.overallBias > 0 ? "long" : "short"
  );
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [setupType, setSetupType] = useState<TradeSetupType>("other");
  const { addTrade } = useTradeJournal();

  const instrument = INSTRUMENTS.find((i) => i.id === instrumentId);

  const handleSubmit = () => {
    const entryPrice = parseFloat(price) || currentPrice;
    if (entryPrice === 0 || !biasResult) return;

    addTrade({
      instrumentId,
      direction,
      entryPrice,
      entryTime: Date.now(),
      biasAtEntry: {
        overallBias: biasResult.overallBias,
        direction: biasResult.direction,
        confidence: biasResult.confidence,
        tradeScore: biasResult.tradeSetup?.tradeScore,
        timeframeAlignment: biasResult.timeframeAlignment,
        confluenceTier: biasResult.tradeSetup?.confluenceTier,
        tradeGuidance: biasResult.tradeGuidance,
        eventWindowCaution: biasResult.eventGate?.hasMajorEventSoon,
        mtfAlignmentPercent: biasResult.mtfAlignmentPercent,
        biasTimestamp: biasResult.timestamp,
        marketRegime: biasResult.marketRegime,
      },
      setupType,
      notes: notes || undefined,
    });

    setOpen(false);
    setPrice("");
    setNotes("");
  };

  return (
    <>
      <button
        onClick={() => {
          setPrice(currentPrice > 0 ? currentPrice.toString() : "");
          setDirection(biasResult && biasResult.overallBias > 0 ? "long" : "short");
          setSetupType(defaultSetupType(biasResult));
          setOpen(true);
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-neutral-accent/15 text-neutral-accent hover:bg-neutral-accent/25 transition-colors"
      >
        <BookOpen className="h-3 w-3" />
        Log Trade
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm bg-[var(--surface-1)] border-border">
          <DialogTitle className="text-sm font-bold">
            Log Trade — {instrument?.symbol || instrumentId}
          </DialogTitle>

          {/* Direction toggle */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setDirection("long")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors border",
                direction === "long"
                  ? "bg-bullish/15 text-bullish border-bullish/30"
                  : "text-muted-foreground border-border hover:border-border-bright"
              )}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Long
            </button>
            <button
              onClick={() => setDirection("short")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors border",
                direction === "short"
                  ? "bg-bearish/15 text-bearish border-bearish/30"
                  : "text-muted-foreground border-border hover:border-border-bright"
              )}
            >
              <TrendingDown className="h-3.5 w-3.5" />
              Short
            </button>
          </div>

          {/* Entry price */}
          <div className="mt-3">
            <label className="text-[12px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
              Entry Price
            </label>
            <input
              type="number"
              step="any"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={currentPrice > 0 ? currentPrice.toString() : "0.00"}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-border text-sm font-mono focus:outline-none focus:border-neutral-accent"
            />
          </div>

          {/* Setup type */}
          <div className="mt-3">
            <label className="text-[12px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
              Setup type
            </label>
            <select
              value={setupType}
              onChange={(e) => setSetupType(e.target.value as TradeSetupType)}
              className="mt-1 w-full rounded-lg border border-border bg-[var(--surface-2)] px-3 py-2 text-xs focus:outline-none focus:border-neutral-accent"
            >
              {SETUP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="mt-2">
            <label className="text-[12px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., breakout entry, pullback to demand..."
              className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-border text-xs focus:outline-none focus:border-neutral-accent"
            />
          </div>

          {/* Bias context */}
          {biasResult && (
            <div className="mt-2 space-y-0.5 rounded bg-[var(--surface-2)] px-2 py-1.5 text-[12px] text-muted-foreground/60">
              <div>
                Bias: {biasResult.overallBias > 0 ? "+" : ""}{Math.round(biasResult.overallBias)} ({biasResult.direction}) — Conf:{" "}
                {Math.round(biasResult.confidence)}%
              </div>
              {biasResult.tradeSetup?.confluenceTier && (
                <div>
                  Confluence: {biasResult.tradeSetup.confluenceTier}-tier
                  {biasResult.timeframeAlignment ? ` · TF ${biasResult.timeframeAlignment}` : ""}
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!biasResult}
            className="w-full mt-3 py-2 rounded-lg bg-neutral-accent text-white text-xs font-semibold hover:bg-neutral-accent/90 transition-colors disabled:opacity-40"
          >
            Log Trade
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
