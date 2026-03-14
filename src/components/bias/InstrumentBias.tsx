"use client";

import { INSTRUMENTS } from "@/lib/utils/constants";
import { useMarketStore } from "@/lib/store/market-store";
import { useRates } from "@/lib/hooks/useMarketData";
import { BiasGauge } from "./BiasGauge";
import { AnimatedNumber } from "@/components/common/AnimatedNumber";
import { formatPercent, getBiasDirection } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";

export function InstrumentBias() {
  const selectedInstrument = useMarketStore((s) => s.selectedInstrument);
  const setSelectedInstrument = useMarketStore((s) => s.setSelectedInstrument);
  const biasResults = useMarketStore((s) => s.biasResults);
  const { data: ratesData } = useRates();
  const quotes = ratesData?.quotes || {};

  return (
    <ScrollArea className="max-h-[600px]">
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
      {INSTRUMENTS.map((inst, idx) => {
        const isActive = selectedInstrument.id === inst.id;
        const bias = biasResults[inst.id];
        const quote = quotes[inst.id];
        const biasValue = bias?.overallBias || 0;
        const direction = bias?.direction || "neutral";
        const confidence = bias?.confidence || 0;

        return (
          <motion.button
            key={inst.id}
            onClick={() => setSelectedInstrument(inst)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={cn(
              "glass-card rounded-xl p-3 text-left transition-all duration-300 cursor-pointer",
              isActive && "ring-1 ring-white/20 glow-neutral"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-foreground">{inst.symbol}</span>
              {quote && quote.mid > 0 && (
                <AnimatedNumber
                  value={quote.mid}
                  format={(n) => n.toFixed(inst.decimalPlaces)}
                  className="text-xs"
                />
              )}
            </div>

            <div className="flex justify-center">
              <BiasGauge
                bias={biasValue}
                confidence={confidence}
                direction={direction}
                size="sm"
              />
            </div>

            {quote && quote.changePercent !== 0 && (
              <div className="text-center mt-1">
                <span className={cn("text-[10px] font-mono", quote.changePercent > 0 ? "text-bullish" : "text-bearish")}>
                  {formatPercent(quote.changePercent)}
                </span>
              </div>
            )}
          </motion.button>
        );
      })}
    </div>
    </ScrollArea>
  );
}
