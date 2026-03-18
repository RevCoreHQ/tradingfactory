"use client";

import { useEconomicCalendar } from "@/lib/hooks/useMarketData";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function RedNewsWeek() {
  const { data, isLoading } = useEconomicCalendar();

  if (isLoading) {
    return (
      <div className="section-card p-5 h-full">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-6 w-6 rounded-md flex items-center justify-center bg-bearish/15">
            <Calendar className="h-3.5 w-3.5 text-bearish" />
          </div>
          <h3 className="text-xs font-semibold text-foreground">Red News This Week</h3>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 shimmer rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const events = data?.events || [];
  const redEvents = events.filter((e) => e.impact === "high");

  const grouped: Record<string, typeof redEvents> = {};
  for (const event of redEvents) {
    const dateKey = event.date;
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(event);
  }

  const sortedDates = Object.keys(grouped).sort();
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="section-card p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md flex items-center justify-center bg-bearish/15">
            <Calendar className="h-3.5 w-3.5 text-bearish" />
          </div>
          <h3 className="text-xs font-semibold text-foreground">Red News This Week</h3>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono px-2 py-0.5 bg-bearish/10 rounded-md text-bearish">
          {redEvents.length} events
        </span>
      </div>

      {redEvents.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          No high-impact events this week
        </p>
      ) : (
        <div className="space-y-3">
          {sortedDates.map((date) => {
            const dayEvents = grouped[date];
            const d = new Date(date + "T00:00:00");
            const dayName = DAY_NAMES[d.getUTCDay()];
            const dayNum = d.getUTCDate();
            const isToday = date === today;

            return (
              <div
                key={date}
                className={cn(
                  "rounded-lg p-3 transition-colors",
                  isToday ? "bg-bearish/8 border border-bearish/20" : "bg-[var(--surface-2)]"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    isToday ? "text-bearish" : "text-muted-foreground"
                  )}>
                    {dayName} {dayNum}
                  </span>
                  {isToday && (
                    <span className="text-[9px] font-bold text-bearish bg-bearish/15 px-1.5 py-0.5 rounded ml-auto">TODAY</span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {dayEvents.map((event) => (
                    <div key={event.id} className="flex items-center gap-2 text-[11px]">
                      <span className="text-muted-foreground/60 shrink-0 w-11 font-mono text-[10px]">
                        {event.time || "\u2014"}
                      </span>
                      <span className="text-[10px] font-mono bg-[var(--surface-3)] px-1.5 py-0.5 rounded shrink-0">
                        {event.country}
                      </span>
                      <span className="text-foreground font-medium truncate flex-1">
                        {event.event}
                      </span>
                      {event.forecast != null && (
                        <span className="text-muted-foreground font-mono text-[10px] shrink-0">
                          {event.forecast}
                        </span>
                      )}
                      {event.previous != null && (
                        <span className="text-muted-foreground/50 font-mono text-[10px] shrink-0">
                          prev: {event.previous}
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
    </div>
  );
}
