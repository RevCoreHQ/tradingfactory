"use client";

import { useEconomicCalendar } from "@/lib/hooks/useMarketData";
import { GlassCard } from "@/components/common/GlassCard";
import { TableSkeleton } from "@/components/common/Skeletons";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getImpactColor } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils";

const COUNTRY_FLAGS: Record<string, string> = {
  US: "🇺🇸", EU: "🇪🇺", GB: "🇬🇧", JP: "🇯🇵", AU: "🇦🇺",
  CA: "🇨🇦", NZ: "🇳🇿", CH: "🇨🇭", CN: "🇨🇳", DE: "🇩🇪",
};

export function EconomicCalendar() {
  const { data, isLoading } = useEconomicCalendar();

  if (isLoading) return <TableSkeleton rows={6} />;

  const events = data?.events || [];
  const highImpact = events.filter((e) => e.impact === "high");
  const otherEvents = events.filter((e) => e.impact !== "high");
  const sortedEvents = [...highImpact, ...otherEvents];

  return (
    <GlassCard delay={0.2}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Economic Calendar</h3>
        <span className="text-[12px] text-muted-foreground">
          {highImpact.length} high impact
        </span>
      </div>

      <ScrollArea className="h-[300px]">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b border-border">
              <th className="text-left py-2 font-medium">Time</th>
              <th className="text-left py-2 font-medium">Event</th>
              <th className="text-center py-2 font-medium">Impact</th>
              <th className="text-right py-2 font-medium">Fcst</th>
              <th className="text-right py-2 font-medium">Prev</th>
              <th className="text-right py-2 font-medium">Act</th>
            </tr>
          </thead>
          <tbody>
            {sortedEvents.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-4 text-muted-foreground">
                  Add API keys to see economic events
                </td>
              </tr>
            )}
            {sortedEvents.map((event) => (
              <tr
                key={event.id}
                className={cn(
                  "border-b border-border transition-colors hover:bg-[var(--surface-2)]",
                  event.impact === "high" && "bg-bearish/5"
                )}
              >
                <td className="py-2 text-muted-foreground whitespace-nowrap">
                  <span className="mr-1">{COUNTRY_FLAGS[event.country] || "🌍"}</span>
                  {event.time}
                </td>
                <td className="py-2 text-foreground max-w-[200px] truncate">
                  {event.event}
                </td>
                <td className="py-2 text-center">
                  <span className={cn("inline-block w-2 h-2 rounded-full", {
                    "bg-red-500": event.impact === "high",
                    "bg-yellow-500": event.impact === "medium",
                    "bg-gray-500": event.impact === "low",
                  })} />
                </td>
                <td className="py-2 text-right font-mono text-muted-foreground">
                  {event.forecast ?? "—"}
                </td>
                <td className="py-2 text-right font-mono text-muted-foreground">
                  {event.previous ?? "—"}
                </td>
                <td className="py-2 text-right font-mono">
                  {event.actual != null ? (
                    <span className={cn(
                      event.forecast != null
                        ? event.actual > event.forecast ? "text-bullish" : event.actual < event.forecast ? "text-bearish" : "text-foreground"
                        : "text-foreground"
                    )}>
                      {event.actual}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </GlassCard>
  );
}
