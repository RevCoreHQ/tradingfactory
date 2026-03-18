"use client";

import { useEconomicCalendar } from "@/lib/hooks/useMarketData";
import { GlassCard } from "@/components/common/GlassCard";
import { cn } from "@/lib/utils";

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function RedNewsWeek() {
  const { data, isLoading } = useEconomicCalendar();

  if (isLoading) {
    return (
      <GlassCard delay={0.05}>
        <h3 className="text-xs font-medium uppercase tracking-widest text-red-400 mb-3">Red News</h3>
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
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium uppercase tracking-widest text-red-400">Red News</h3>
        <span className="text-[10px] text-muted-foreground font-mono">{redEvents.length} events</span>
      </div>

      {redEvents.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">
          No high-impact events this week
        </p>
      ) : (
        <div className="space-y-2.5">
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
                  "rounded-md p-2",
                  isToday && "accent-bearish bg-bearish/5"
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    isToday ? "text-bearish" : "text-muted-foreground"
                  )}>
                    {dayName} {dayNum}
                  </span>
                  {isToday && <span className="text-[9px] text-bearish font-medium ml-auto">TODAY</span>}
                </div>
                <div className="space-y-1">
                  {dayEvents.map((event) => (
                    <div key={event.id} className="flex items-center gap-2 text-[11px]">
                      <span className="text-muted-foreground shrink-0 w-11 font-mono text-[10px]">
                        {event.time || "\u2014"}
                      </span>
                      <span className="text-[10px] font-mono bg-[var(--surface-2)] px-1 rounded-sm shrink-0">
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
                        <span className="text-muted-foreground/60 font-mono text-[10px] shrink-0">
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
    </GlassCard>
  );
}
