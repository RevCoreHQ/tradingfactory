"use client";

import { useEconomicCalendar } from "@/lib/hooks/useMarketData";
import { GlassCard } from "@/components/common/GlassCard";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

const COUNTRY_FLAGS: Record<string, string> = {
  US: "\u{1F1FA}\u{1F1F8}", EU: "\u{1F1EA}\u{1F1FA}", GB: "\u{1F1EC}\u{1F1E7}", JP: "\u{1F1EF}\u{1F1F5}", AU: "\u{1F1E6}\u{1F1FA}",
  CA: "\u{1F1E8}\u{1F1E6}", NZ: "\u{1F1F3}\u{1F1FF}", CH: "\u{1F1E8}\u{1F1ED}", CN: "\u{1F1E8}\u{1F1F3}", DE: "\u{1F1E9}\u{1F1EA}",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RedNewsWeek() {
  const { data, isLoading } = useEconomicCalendar();

  if (isLoading) {
    return (
      <GlassCard delay={0.05}>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <h3 className="text-sm font-semibold text-red-400">High-Impact News This Week</h3>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 shimmer rounded" />
          ))}
        </div>
      </GlassCard>
    );
  }

  const events = data?.events || [];
  const redEvents = events.filter((e) => e.impact === "high");

  // Group by date
  const grouped: Record<string, typeof redEvents> = {};
  for (const event of redEvents) {
    const dateKey = event.date;
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(event);
  }

  const sortedDates = Object.keys(grouped).sort();
  const today = new Date().toISOString().split("T")[0];

  return (
    <GlassCard delay={0.05}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
          </div>
          <h3 className="text-sm font-semibold text-red-400">High-Impact News This Week</h3>
        </div>
        <span className="text-xs text-muted-foreground">{redEvents.length} events</span>
      </div>

      {redEvents.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          No high-impact events scheduled this week
        </p>
      ) : (
        <div className="space-y-3">
          {sortedDates.map((date) => {
            const dayEvents = grouped[date];
            const d = new Date(date + "T00:00:00");
            const dayName = DAY_NAMES[d.getUTCDay()];
            const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
            const isToday = date === today;

            return (
              <div key={date} className={cn("rounded-lg p-2.5", isToday && "bg-red-500/5 ring-1 ring-red-500/20")}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("text-xs font-bold uppercase tracking-wider", isToday ? "text-red-400" : "text-muted-foreground")}>
                    {dayName}
                  </span>
                  <span className="text-xs text-muted-foreground">{monthDay}</span>
                  {isToday && <span className="text-[10px] text-red-400 font-medium ml-auto">TODAY</span>}
                </div>
                <div className="space-y-1.5">
                  {dayEvents.map((event) => (
                    <div key={event.id} className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground shrink-0 w-12 font-mono">{event.time || "\u2014"}</span>
                      <span className="shrink-0">{COUNTRY_FLAGS[event.country] || "\u{1F30D}"}</span>
                      <span className="text-foreground font-medium truncate flex-1">{event.event}</span>
                      {event.forecast != null && (
                        <span className="text-muted-foreground font-mono shrink-0">
                          Fcst: {event.forecast}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
