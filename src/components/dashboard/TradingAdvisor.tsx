"use client";

import { useState, useEffect, useRef } from "react";
import { useTradeDeskData } from "@/lib/hooks/useTradeDeskData";
import { useTradingAdvisor } from "@/lib/hooks/useTradingAdvisor";
import { useDeskChat } from "@/lib/hooks/useDeskChat";
import { useFearGreed, useBondYields, useCOTData, useEconomicCalendar, useCentralBanks } from "@/lib/hooks/useMarketData";
import { useRiskCorrelation } from "@/lib/hooks/useRiskCorrelation";
import { loadTrackedSetups } from "@/lib/storage/setup-storage";
import { getStatusLabel } from "@/lib/calculations/setup-tracker";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Target,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Shield,
  BookOpen,
  RefreshCw,
  Ban,
  Send,
  Star,
} from "lucide-react";
import type { TradingAdvisorResult, TradingAdvisorRequest } from "@/lib/types/llm";
import { useMarketStore } from "@/lib/store/market-store";
import { INSTRUMENTS } from "@/lib/utils/constants";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { AnalysisLoader } from "@/components/ui/analysis-loader";
import { ScrollArea } from "@/components/ui/scroll-area";

const DEFAULT_FEAR_GREED = { value: 50, label: "Neutral" };
const DEFAULT_DXY = { value: 0, change: 0 };

const ADVISOR_LOADING_MESSAGES = [
  "Analyzing market structure...",
  "Evaluating ICT confluences...",
  "Checking MTF alignment...",
  "Assessing risk conditions...",
  "Consulting the books...",
  "Preparing desk briefing...",
];

function AdvisorSkeleton() {
  return (
    <div className="section-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-6 w-6 rounded-md flex items-center justify-center bg-neutral-accent/15">
          <MessageSquare className="h-3.5 w-3.5 text-neutral-accent" />
        </div>
        <h3 className="text-xs font-semibold text-foreground">Risk Auditor</h3>
      </div>
      <div className="py-8">
        <AnalysisLoader messages={ADVISOR_LOADING_MESSAGES} speed={20} holdMs={800} />
      </div>
    </div>
  );
}

const STRONG_CONVICTION_THRESHOLD = 45;

function AdvisorContent({ advisor, onRefresh }: { advisor: TradingAdvisorResult; onRefresh: () => void }) {
  const timeSince = Date.now() - advisor.timestamp;
  const minutesAgo = Math.floor(timeSince / 60000);
  const timeLabel = minutesAgo < 1 ? "Just now" : `${minutesAgo}m ago`;

  // Enforce focus with mechanical bias data
  const currentResults = useMarketStore((s) => s.allBiasResults.intraday);
  const hasBiasData = Object.keys(currentResults).length > 0;

  // Build enforced focus/sitout lists
  let focusToday = advisor.focusToday ?? [];
  let sitOutToday = advisor.sitOutToday ?? [];

  if (hasBiasData) {
    const strongInstruments: { symbol: string; id: string; direction: "LONG" | "SHORT" }[] = [];
    for (const [id, result] of Object.entries(currentResults)) {
      if (Math.abs(result.overallBias) >= STRONG_CONVICTION_THRESHOLD) {
        const inst = INSTRUMENTS.find((i) => i.id === id);
        if (inst) {
          strongInstruments.push({
            symbol: inst.symbol,
            id,
            direction: result.overallBias > 0 ? "LONG" : "SHORT",
          });
        }
      }
    }

    // Inject missing strong conviction instruments into Focus Today
    const symbolInList = (sym: string, list: { symbol: string }[]) =>
      list.some((item) => item.symbol === sym || item.symbol.includes(sym) || sym.includes(item.symbol) || item.symbol.replace("/", "") === sym.replace("/", ""));

    const enriched = [...focusToday];
    for (const sc of strongInstruments) {
      if (!symbolInList(sc.symbol, enriched)) {
        enriched.push({ symbol: sc.symbol, action: sc.direction });
      }
    }
    focusToday = enriched;

    // Remove strong conviction instruments from Sit Out
    sitOutToday = sitOutToday.filter(
      (item) => !strongInstruments.some((sc) => item.includes(sc.symbol) || item.replace("/", "").includes(sc.symbol.replace("/", "")))
    );
  }

  return (
    <div className="relative section-card p-5">
      <GlowingEffect
        spread={40}
        glow={true}
        disabled={false}
        proximity={64}
        inactiveZone={0.01}
        borderWidth={2}
      />
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="h-6 w-6 rounded-md flex items-center justify-center bg-neutral-accent/15">
          <MessageSquare className="h-3.5 w-3.5 text-neutral-accent" />
        </div>
        <h3 className="text-xs font-semibold text-foreground">Risk Auditor</h3>
        <span className="text-[12px] text-muted-foreground/40 ml-1">Risk Auditor</span>
        <span className="text-[12px] text-muted-foreground/30 ml-auto">{timeLabel}</span>
        <button
          onClick={onRefresh}
          className="p-1 rounded hover:bg-surface-2/80 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          title="Refresh advisor"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {/* Greeting */}
      {advisor.greeting && (
        <p className="text-sm text-foreground font-medium mb-3 leading-relaxed">
          {advisor.greeting}
        </p>
      )}

      {/* Focus Today / Sit Out */}
      {(focusToday.length > 0 || sitOutToday.length > 0) && (
        <div className="mb-4 pb-4 border-b border-border/30">
          {focusToday.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-[12px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Target className="h-3 w-3 text-neutral-accent" />
                Focus Today
              </div>
              {focusToday.map((item, i) => {
                const inst = INSTRUMENTS.find(
                  (instr) => instr.symbol === item.symbol || item.symbol.includes(instr.symbol) || instr.symbol.replace("/", "") === item.symbol.replace("/", "")
                );
                const bias = inst ? currentResults[inst.id] : null;
                const isStrong = bias ? Math.abs(bias.overallBias) >= STRONG_CONVICTION_THRESHOLD : false;
                const isShort = item.action === "SHORT";

                return (
                  <span
                    key={i}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground px-2.5 py-1 rounded-md border",
                      isShort
                        ? "bg-bearish/10 border-bearish/20"
                        : "bg-bullish/10 border-bullish/20"
                    )}
                  >
                    {isStrong && <Star className="h-3 w-3 fill-[#FFD700] text-[#FFD700]" />}
                    {isShort ? (
                      <TrendingDown className="h-3 w-3 text-bearish" />
                    ) : (
                      <TrendingUp className="h-3 w-3 text-bullish" />
                    )}
                    <span className={cn(
                      "text-[11px] font-bold uppercase tracking-wider",
                      isShort ? "text-bearish" : "text-bullish"
                    )}>
                      {item.action}
                    </span>
                    {item.symbol}
                  </span>
                );
              })}
            </div>
          )}

          {sitOutToday.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <div className="text-[12px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Ban className="h-3 w-3" />
                Sit Out
              </div>
              {sitOutToday.map((note, i) => (
                <span key={i} className="text-[13px] text-muted-foreground bg-[var(--surface-2)] px-2.5 py-1 rounded-md border border-border/30">
                  {note}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Market Regime Assessment */}
      {advisor.marketRegime && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Shield className="h-3 w-3 text-neutral-accent" />
            <span className="text-[12px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
              Market Regime
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {advisor.marketRegime}
          </p>
        </div>
      )}

      {/* Risk Flags */}
      {advisor.riskFlags && advisor.riskFlags.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="h-3 w-3 text-[var(--amber)]" />
            <span className="text-[12px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
              Risk Flags
            </span>
          </div>
          <div className="space-y-1">
            {advisor.riskFlags.map((flag, i) => (
              <p key={i} className="text-[13px] text-muted-foreground leading-relaxed pl-4 border-l-2 border-[var(--amber)]/30">
                {flag}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Avoid List */}
      {advisor.avoidList.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Ban className="h-3 w-3 text-bearish" />
            <span className="text-[12px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
              Avoid
            </span>
          </div>
          <div className="space-y-1">
            {advisor.avoidList.map((item, i) => (
              <p key={i} className="text-[13px] text-muted-foreground/70 leading-relaxed pl-4 border-l-2 border-bearish/20">
                {item}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Risk Warning */}
      {advisor.riskWarning && (
        <div className="mb-4 rounded-md bg-amber/5 border border-amber/15 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <AlertTriangle className="h-3 w-3 text-[var(--amber)]" />
            <span className="text-[12px] font-semibold text-[var(--amber)] uppercase tracking-wider">
              Risk Warning
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            {advisor.riskWarning}
          </p>
        </div>
      )}

      {/* Desk Note */}
      {advisor.deskNote && (
        <div className="rounded-md bg-surface-2/50 border border-border/30 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <BookOpen className="h-3 w-3 text-neutral-accent" />
            <span className="text-[12px] font-semibold text-neutral-accent/70 uppercase tracking-wider">
              Desk Note
            </span>
          </div>
          <p className="text-[13px] text-muted-foreground/80 leading-relaxed italic">
            &ldquo;{advisor.deskNote}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}

// ==================== Desk Chat ====================

function DeskChat({
  advisor,
  advisorContext,
}: {
  advisor: TradingAdvisorResult;
  advisorContext: TradingAdvisorRequest;
}) {
  const { messages, isSending, error, send, clear } = useDeskChat({
    advisorContext,
    initialBriefing: advisor,
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    send(input);
    setInput("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="section-card mt-3 overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30">
        <MessageSquare className="h-3 w-3 text-neutral-accent" />
        <span className="text-[12px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
          Ask the risk auditor
        </span>
        {messages.length > 0 && (
          <button
            onClick={clear}
            className="ml-auto text-[12px] text-muted-foreground/30 hover:text-muted-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Message history */}
      {messages.length > 0 && (
        <ScrollArea className="max-h-[300px]">
          <div ref={scrollRef} className="px-4 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "text-xs leading-relaxed",
                  msg.role === "user"
                    ? "pl-4 border-l-2 border-neutral-accent/30"
                    : "text-muted-foreground/80"
                )}
              >
                <span className={cn(
                  "text-[11px] font-semibold uppercase block mb-0.5",
                  msg.role === "user" ? "text-neutral-accent/50" : "text-muted-foreground/40"
                )}>
                  {msg.role === "user" ? "You" : "Risk Auditor"}
                </span>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}
            {isSending && (
              <div className="text-[12px] text-muted-foreground/40 italic">
                Risk auditor is thinking...
              </div>
            )}
            {error && (
              <p className="text-[12px] text-bearish/70">{error}</p>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Input area */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border/30">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about any setup, risk, or market condition..."
          className="flex-1 h-7 text-xs bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/40"
          disabled={isSending}
        />
        <button
          onClick={handleSend}
          disabled={isSending || !input.trim()}
          className="p-1.5 rounded hover:bg-surface-2/80 text-muted-foreground/40 hover:text-neutral-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Send className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ==================== Main Component ====================

export function TradingAdvisor() {
  const { setups, portfolioRisk } = useTradeDeskData();
  const { data: fearGreedData } = useFearGreed();
  const { data: bondData } = useBondYields();
  const { data: cotData } = useCOTData();
  const { data: calendarData } = useEconomicCalendar();
  const { data: bankData } = useCentralBanks();
  const { assessment: riskAssessment } = useRiskCorrelation();

  // Read tracked setup statuses from localStorage (decoupled from AITradeDesk)
  const [trackedStatuses, setTrackedStatuses] = useState<Record<string, string>>({});
  useEffect(() => {
    const update = () => {
      const tracked = loadTrackedSetups();
      const statuses: Record<string, string> = {};
      for (const t of tracked) {
        if (!statuses[t.setup.instrumentId]) {
          statuses[t.setup.instrumentId] = getStatusLabel(t.status);
        }
      }
      setTrackedStatuses(statuses);
    };
    update();
    const interval = setInterval(update, 15_000);
    return () => clearInterval(interval);
  }, []);

  const fearGreed = fearGreedData?.current
    ? { value: fearGreedData.current.value, label: fearGreedData.current.label }
    : DEFAULT_FEAR_GREED;
  const dxy = bondData?.dxy
    ? { value: bondData.dxy.value, change: bondData.dxy.change }
    : DEFAULT_DXY;
  const bondYields = bondData?.yields || [];

  const advisorParams = setups.length > 0
    ? {
        setups,
        fearGreed,
        dxy,
        bondYields: bondYields.map((y: { maturity: string; yield: number; change: number }) => ({
          maturity: y.maturity,
          yield: y.yield,
          change: y.change,
        })),
        riskPercent: portfolioRisk.riskPercent,
        trackedStatuses,
        // Institutional context
        cotPositions: cotData?.positions,
        highImpactEvents: calendarData?.events,
        portfolioRisk: riskAssessment ?? undefined,
        centralBanks: bankData?.banks?.map((b) => ({
          bank: b.bank,
          currency: b.currency,
          rate: b.currentRate,
          direction: b.rateDirection,
          stance: b.policyStance,
        })),
      }
    : null;

  const { advisor, advisorRequest, isLoading, refresh } = useTradingAdvisor(advisorParams);

  if (isLoading || (!advisor && setups.length > 0)) {
    return <AdvisorSkeleton />;
  }

  if (!advisor) {
    return (
      <div className="section-card p-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-6 w-6 rounded-md flex items-center justify-center bg-neutral-accent/15">
            <MessageSquare className="h-3.5 w-3.5 text-neutral-accent" />
          </div>
          <h3 className="text-xs font-semibold text-foreground">Risk Auditor</h3>
        </div>
        <p className="text-xs text-muted-foreground/50 text-center py-4">
          Waiting for mechanical signal data to generate advisor briefing...
        </p>
      </div>
    );
  }

  return (
    <>
      <AdvisorContent advisor={advisor} onRefresh={refresh} />
      {advisorRequest && (
        <DeskChat advisor={advisor} advisorContext={advisorRequest} />
      )}
    </>
  );
}
