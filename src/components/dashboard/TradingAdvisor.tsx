"use client";

import { useState, useEffect, useRef } from "react";
import { useTradeDeskData } from "@/lib/hooks/useTradeDeskData";
import { useTradingAdvisor } from "@/lib/hooks/useTradingAdvisor";
import { useDeskChat } from "@/lib/hooks/useDeskChat";
import { useFearGreed, useBondYields } from "@/lib/hooks/useMarketData";
import { loadTrackedSetups } from "@/lib/storage/setup-storage";
import { getStatusLabel } from "@/lib/calculations/setup-tracker";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Target,
  AlertTriangle,
  TrendingUp,
  Shield,
  BookOpen,
  RefreshCw,
  Ban,
  Send,
} from "lucide-react";
import type { TradingAdvisorResult, TradingAdvisorRequest } from "@/lib/types/llm";
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
        <h3 className="text-xs font-semibold text-foreground">Desk Manager</h3>
      </div>
      <div className="py-8">
        <AnalysisLoader messages={ADVISOR_LOADING_MESSAGES} speed={20} holdMs={800} />
      </div>
    </div>
  );
}

function AdvisorContent({ advisor, onRefresh }: { advisor: TradingAdvisorResult; onRefresh: () => void }) {
  const timeSince = Date.now() - advisor.timestamp;
  const minutesAgo = Math.floor(timeSince / 60000);
  const timeLabel = minutesAgo < 1 ? "Just now" : `${minutesAgo}m ago`;

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
        <h3 className="text-xs font-semibold text-foreground">Desk Manager</h3>
        <span className="text-[10px] text-muted-foreground/40 ml-1">AI Trading Advisor</span>
        <span className="text-[10px] text-muted-foreground/30 ml-auto">{timeLabel}</span>
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

      {/* Market Regime Assessment */}
      {advisor.marketRegime && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Shield className="h-3 w-3 text-neutral-accent" />
            <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
              Market Regime
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {advisor.marketRegime}
          </p>
        </div>
      )}

      {/* Top Pick */}
      {advisor.topPick && (
        <div className={cn(
          "rounded-lg p-3 mb-4 border",
          advisor.topPick.action === "LONG"
            ? "bg-bullish/5 border-bullish/20"
            : "bg-bearish/5 border-bearish/20"
        )}>
          <div className="flex items-center gap-2 mb-1.5">
            <Target className="h-3.5 w-3.5 text-foreground" />
            <span className="text-xs font-bold text-foreground">Top Pick</span>
            <span className={cn(
              "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
              advisor.topPick.action === "LONG"
                ? "bg-bullish/15 text-bullish"
                : "bg-bearish/15 text-bearish"
            )}>
              {advisor.topPick.action} {advisor.topPick.instrument}
            </span>
            <span className="text-[9px] font-bold text-muted-foreground/50 uppercase">
              {advisor.topPick.conviction}
            </span>
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed mb-1.5">
            {advisor.topPick.reasoning}
          </p>
          <p className="text-[10px] text-muted-foreground/60 font-mono">
            {advisor.topPick.levels}
          </p>
        </div>
      )}

      {/* Other Setups */}
      {advisor.otherSetups.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingUp className="h-3 w-3 text-bullish" />
            <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
              Other Setups
            </span>
          </div>
          <div className="space-y-1">
            {advisor.otherSetups.map((setup, i) => (
              <p key={i} className="text-[11px] text-muted-foreground leading-relaxed pl-4 border-l-2 border-border/30">
                {setup}
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
            <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
              Avoid
            </span>
          </div>
          <div className="space-y-1">
            {advisor.avoidList.map((item, i) => (
              <p key={i} className="text-[11px] text-muted-foreground/70 leading-relaxed pl-4 border-l-2 border-bearish/20">
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
            <span className="text-[10px] font-semibold text-[var(--amber)] uppercase tracking-wider">
              Risk Warning
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {advisor.riskWarning}
          </p>
        </div>
      )}

      {/* Desk Note */}
      {advisor.deskNote && (
        <div className="rounded-md bg-surface-2/50 border border-border/30 px-3 py-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <BookOpen className="h-3 w-3 text-neutral-accent" />
            <span className="text-[10px] font-semibold text-neutral-accent/70 uppercase tracking-wider">
              Desk Note
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground/80 leading-relaxed italic">
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
        <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
          Ask the Desk Manager
        </span>
        {messages.length > 0 && (
          <button
            onClick={clear}
            className="ml-auto text-[10px] text-muted-foreground/30 hover:text-muted-foreground transition-colors"
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
                  "text-[9px] font-semibold uppercase block mb-0.5",
                  msg.role === "user" ? "text-neutral-accent/50" : "text-muted-foreground/40"
                )}>
                  {msg.role === "user" ? "You" : "Desk Manager"}
                </span>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}
            {isSending && (
              <div className="text-[10px] text-muted-foreground/40 italic">
                Desk manager is thinking...
              </div>
            )}
            {error && (
              <p className="text-[10px] text-bearish/70">{error}</p>
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
          <h3 className="text-xs font-semibold text-foreground">Desk Manager</h3>
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
