"use client";

import { useState } from "react";
import { Header } from "@/components/dashboard/Header";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { EtheralShadow } from "@/components/ui/etheral-shadow";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonthData(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  // JS getDay(): 0=Sun. Convert to Mon=0 start.
  const startOffset = (firstDay.getDay() + 6) % 7;
  return { daysInMonth, startOffset };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function JournalPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const { daysInMonth, startOffset } = getMonthData(year, month);
  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  function prevMonth() {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
  }

  return (
    <div className="relative min-h-screen bg-background">
      <div className="fixed inset-0 z-0 hidden dark:block">
        <EtheralShadow
          color="rgba(30, 27, 55, 1)"
          animation={{ scale: 60, speed: 40 }}
          noise={{ opacity: 0.6, scale: 1.2 }}
          sizing="fill"
        />
      </div>

      <div className="relative z-10">
        <Header mode="journal" />

        <main className="max-w-[1400px] mx-auto px-8 py-6 space-y-8">
          {/* P&L Calendar */}
          <section>
            <SectionHeader
              title="Trade Journal"
              subtitle="Track and review your trading performance"
              icon={<BookOpen className="h-3.5 w-3.5" />}
              accentColor="amber"
            />

            <div className="section-card p-5">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {MONTH_NAMES[month]} {year}
                </h3>
                <div className="flex items-center gap-1">
                  <button
                    onClick={prevMonth}
                    className="p-1.5 rounded-md hover:bg-[var(--surface-2)] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={nextMonth}
                    className="p-1.5 rounded-md hover:bg-[var(--surface-2)] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAY_LABELS.map((d) => (
                  <div key={d} className="text-[10px] font-medium text-muted-foreground text-center">
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar cells */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty offset cells */}
                {Array.from({ length: startOffset }).map((_, i) => (
                  <div key={`e-${i}`} className="aspect-square" />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dayOfWeek = (startOffset + i) % 7;
                  const isWeekend = dayOfWeek >= 5;
                  const isToday = isCurrentMonth && day === today;

                  return (
                    <div
                      key={day}
                      className={cn(
                        "aspect-square rounded-lg border flex flex-col items-center justify-center transition-colors",
                        isWeekend
                          ? "bg-[var(--surface-1)] border-border/20"
                          : "bg-[var(--surface-2)] border-border/30 hover:border-border-bright",
                        isToday && "ring-1 ring-neutral-accent border-neutral-accent/40"
                      )}
                    >
                      <span className={cn(
                        "text-[11px] font-medium",
                        isToday ? "text-neutral-accent" : isWeekend ? "text-muted-foreground/40" : "text-muted-foreground"
                      )}>
                        {day}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Legend placeholder */}
              <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/30">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm bg-bullish/30" />
                  <span className="text-[10px] text-muted-foreground">Profitable</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm bg-bearish/30" />
                  <span className="text-[10px] text-muted-foreground">Loss</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm bg-neutral-accent/30" />
                  <span className="text-[10px] text-muted-foreground">Breakeven</span>
                </div>
              </div>
            </div>
          </section>

          {/* Empty state */}
          <section>
            <div className="section-card p-8 flex flex-col items-center text-center">
              <BookOpen className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">No trades logged yet</h3>
              <p className="text-[11px] text-muted-foreground max-w-md">
                This journal will track trades you actually take. Manual logging coming soon —
                for now, visit the <span className="text-neutral-accent font-medium">Desk</span> to review setups.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
