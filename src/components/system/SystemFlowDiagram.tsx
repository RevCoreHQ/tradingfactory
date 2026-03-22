"use client";

import { useRef } from "react";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import {
  Database,
  Globe,
  BarChart3,
  Cog,
  Scale,
  Layers,
  GitBranch,
  Gem,
  AlignVerticalSpaceAround,
  Crosshair,
  Target,
  Ruler,
  ShieldCheck,
  Box,
  Cpu,
  Newspaper,
  Brain,
  MessageSquare,
  LayoutList,
  MonitorDot,
  RefreshCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ==================== Flow Node Component ====================

type NodeColor = "blue" | "green" | "amber" | "red";

interface FlowNodeProps {
  icon: React.ReactNode;
  label: string;
  detail: string;
  color: NodeColor;
  badge?: string;
  highlighted?: boolean;
}

const colorMap: Record<NodeColor, { border: string; iconBg: string; iconText: string; badgeBg: string }> = {
  blue: {
    border: "border-l-neutral-accent",
    iconBg: "bg-neutral-accent/10",
    iconText: "text-neutral-accent",
    badgeBg: "bg-neutral-accent/10 text-neutral-accent",
  },
  green: {
    border: "border-l-bullish",
    iconBg: "bg-bullish/10",
    iconText: "text-bullish",
    badgeBg: "bg-bullish/10 text-bullish",
  },
  amber: {
    border: "border-l-amber-500",
    iconBg: "bg-amber-500/10",
    iconText: "text-amber-600 dark:text-amber-500",
    badgeBg: "bg-amber-500/10 text-amber-600 dark:text-amber-500",
  },
  red: {
    border: "border-l-bearish",
    iconBg: "bg-bearish/10",
    iconText: "text-bearish",
    badgeBg: "bg-bearish/10 text-bearish",
  },
};

function FlowNode({ icon, label, detail, color, badge, highlighted }: FlowNodeProps) {
  const c = colorMap[color];
  return (
    <div
      className={cn(
        "relative rounded-lg border border-border/40 border-l-[3px] px-3 py-2 backdrop-blur-sm transition-colors",
        c.border,
        highlighted
          ? "bg-surface-1/90 shadow-md ring-1 ring-amber-500/30"
          : "bg-surface-1/70"
      )}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <div className={cn("h-5 w-5 rounded flex items-center justify-center shrink-0", c.iconBg)}>
          <span className={c.iconText}>{icon}</span>
        </div>
        <span className="text-[11px] font-semibold text-foreground leading-tight">{label}</span>
        {badge && (
          <span className={cn("text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded", c.badgeBg)}>
            {badge}
          </span>
        )}
      </div>
      <p className="text-[9px] text-muted-foreground/60 leading-snug pl-7">{detail}</p>
    </div>
  );
}

// ==================== Tier Label ====================

function TierLabel({ label, color }: { label: string; color: NodeColor }) {
  const borderColor: Record<NodeColor, string> = {
    blue: "border-neutral-accent/30",
    green: "border-bullish/30",
    amber: "border-amber-500/30",
    red: "border-bearish/30",
  };
  const textColor: Record<NodeColor, string> = {
    blue: "text-neutral-accent/50",
    green: "text-bullish/50",
    amber: "text-amber-600/50 dark:text-amber-500/50",
    red: "text-bearish/50",
  };

  return (
    <div className={cn("flex items-center gap-3 col-span-full", borderColor[color])}>
      <div className={cn("h-px flex-1 border-t border-dashed", borderColor[color])} />
      <span className={cn("text-[9px] font-bold uppercase tracking-widest whitespace-nowrap", textColor[color])}>
        {label}
      </span>
      <div className={cn("h-px flex-1 border-t border-dashed", borderColor[color])} />
    </div>
  );
}

// ==================== Beam Gradient Colors ====================

const BEAM_BLUE = { start: "#6b8aad", stop: "#4a6d8c" };
const BEAM_GREEN = { start: "#22c55e", stop: "#16a34a" };
const BEAM_AMBER = { start: "#f59e0b", stop: "#d97706" };
const BEAM_RED = { start: "#ef4444", stop: "#b91c1c" };

// ==================== Main Component ====================

export function SystemFlowDiagram() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Tier 1: Data Sources
  const priceRef = useRef<HTMLDivElement>(null);
  const fundRef = useRef<HTMLDivElement>(null);

  // Tier 2: Processing
  const techRef = useRef<HTMLDivElement>(null);
  const regimeRef = useRef<HTMLDivElement>(null);
  const biasRef = useRef<HTMLDivElement>(null);

  // Tier 3: Signals
  const signalsRef = useRef<HTMLDivElement>(null);
  const decorrelRef = useRef<HTMLDivElement>(null);

  // Tier 4: Enrichment
  const structureRef = useRef<HTMLDivElement>(null);
  const ictRef = useRef<HTMLDivElement>(null);
  const mtfRef = useRef<HTMLDivElement>(null);
  const entryOptRef = useRef<HTMLDivElement>(null);

  // Tier 5: Decision
  const convictionRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);

  // Tier 6: Merge
  const setupRef = useRef<HTMLDivElement>(null);

  // Tier 7: AI
  const batchLlmRef = useRef<HTMLDivElement>(null);
  const summaryLlmRef = useRef<HTMLDivElement>(null);
  const deskMgrRef = useRef<HTMLDivElement>(null);
  const deskChatRef = useRef<HTMLDivElement>(null);

  // Tier 8: Output
  const tradeUiRef = useRef<HTMLDivElement>(null);
  const deskUiRef = useRef<HTMLDivElement>(null);
  const learningRef = useRef<HTMLDivElement>(null);

  const cRef = containerRef as React.RefObject<HTMLElement>;
  const asRef = (r: React.RefObject<HTMLDivElement | null>) => r as React.RefObject<HTMLElement>;

  return (
    <div ref={containerRef} className="relative">
      {/* Node Grid */}
      <div className="grid grid-cols-4 gap-x-4 gap-y-3 relative z-10">

        {/* ===== TIER 1: DATA SOURCES ===== */}
        <TierLabel label="Data Ingestion" color="blue" />

        <div className="col-start-1 col-span-2" ref={priceRef}>
          <FlowNode
            icon={<Database className="h-3 w-3" />}
            label="Price APIs"
            detail="Twelve Data (primary) → Finnhub → Alpha Vantage | CoinGecko for crypto | 4 timeframes: 15m, 1h, 4h, 1D"
            color="blue"
            badge="data"
          />
        </div>
        <div className="col-start-3 col-span-2" ref={fundRef}>
          <FlowNode
            icon={<Globe className="h-3 w-3" />}
            label="Fundamental APIs"
            detail="Fear & Greed, DXY, Bond Yields (FRED), News (NewsAPI), Central Bank Rates, COT, Sentiment"
            color="blue"
            badge="data"
          />
        </div>

        {/* ===== TIER 2: FIRST PROCESSING ===== */}
        <TierLabel label="Technical Processing" color="blue" />

        <div ref={techRef}>
          <FlowNode
            icon={<BarChart3 className="h-3 w-3" />}
            label="Technical Indicators"
            detail="RSI(14), MACD(12,26,9), Bollinger(20,2), EMA stacks, ATR(14), ADX(14)"
            color="blue"
          />
        </div>
        <div className="col-span-2" ref={regimeRef}>
          <FlowNode
            icon={<Layers className="h-3 w-3" />}
            label="Regime Engine"
            detail="Volatility (ATR pctile) + Structure (ADX/EMA/BB) + Wyckoff Phase (accum/expand/distrib/markdown) + ADX trend"
            color="green"
            badge="mechanical"
          />
        </div>
        <div ref={biasRef}>
          <FlowNode
            icon={<Scale className="h-3 w-3" />}
            label="Bias Engine"
            detail="7 fundamental inputs → rule-based scores → direction + bias strength per instrument"
            color="blue"
          />
        </div>

        {/* ===== TIER 3: SIGNAL GENERATION ===== */}
        <TierLabel label="Signal Generation" color="green" />

        <div className="col-span-3" ref={signalsRef}>
          <FlowNode
            icon={<Cog className="h-3 w-3" />}
            label="8 Mechanical Signal Systems"
            detail="MA Cross, MACD, BB Breakout, RSI Extremes, BB Mean Reversion, Elder Impulse, Elder-Ray, Trend Stack — each returns direction + strength"
            color="green"
            badge="mechanical"
          />
        </div>
        <div ref={decorrelRef}>
          <FlowNode
            icon={<GitBranch className="h-3 w-3" />}
            label="De-correlation"
            detail="3 clusters: Trend (MA,MACD,BB,Stack), MR (RSI,BB-MR), Momentum (Impulse,Ray)"
            color="green"
          />
        </div>

        {/* ===== TIER 4: ENRICHMENT ===== */}
        <TierLabel label="Enrichment Layer" color="green" />

        <div ref={structureRef}>
          <FlowNode
            icon={<AlignVerticalSpaceAround className="h-3 w-3" />}
            label="Market Structure"
            detail="HH/HL/LH/LL swings, BOS, CHoCH detection, structure score (-100 to +100)"
            color="green"
          />
        </div>
        <div ref={ictRef}>
          <FlowNode
            icon={<Gem className="h-3 w-3" />}
            label="ICT Context"
            detail="Fair Value Gaps, Order Blocks, Displacement, Supply/Demand zones → ICT score 0-100"
            color="green"
          />
        </div>
        <div ref={mtfRef}>
          <FlowNode
            icon={<Layers className="h-3 w-3" />}
            label="MTF Alignment"
            detail="15m/1h/4h/1D EMA stacks → full/strong/partial/conflicting alignment + pullback detection"
            color="green"
          />
        </div>
        <div ref={entryOptRef}>
          <FlowNode
            icon={<Crosshair className="h-3 w-3" />}
            label="Entry Optimization"
            detail="Hammer, Engulfing, Pin Bar, FVG Reentry, OB Retest patterns → entry score 0-100"
            color="green"
          />
        </div>

        {/* ===== TIER 5: DECISION ===== */}
        <TierLabel label="Decision Layer" color="green" />

        <div className="col-start-1 col-span-2" ref={convictionRef}>
          <FlowNode
            icon={<Target className="h-3 w-3" />}
            label="Conviction Scoring"
            detail="De-corr agreement (40pts) + Regime (25pts) + Impulse (±15pts) + Structure (±10pts) + ICT (10pts) → A+/A/B/C/D tiers"
            color="green"
            badge="mechanical"
          />
        </div>
        <div ref={positionRef}>
          <FlowNode
            icon={<Ruler className="h-3 w-3" />}
            label="Position Sizing"
            detail="ATR-based SL/TP → conviction-scaled lots: A+ = 1.25×, A = 1.0×, B = 0.75×"
            color="green"
          />
        </div>
        <div ref={filtersRef}>
          <FlowNode
            icon={<ShieldCheck className="h-3 w-3" />}
            label="Hard Filters + Risk Gate"
            detail="Elder gates (no longs on RED), R:R ≥ 1.5, portfolio limits, correlation blocks, drawdown throttle"
            color="red"
            badge="filter"
          />
        </div>

        {/* ===== TIER 6: MERGE POINT ===== */}
        <TierLabel label="Setup Assembly" color="amber" />

        <div className="col-start-1 col-span-4" ref={setupRef}>
          <FlowNode
            icon={<Box className="h-3 w-3" />}
            label="TradeDeskSetup — Complete Setup Object"
            detail="18+ fields: symbol, direction, conviction, regime, signals, entry/SL/TP levels, R:R, position size, MTF alignment, structure score, ICT score, entry pattern, learning data, Wyckoff phase → stored in useTradeDeskData() hook state"
            color="amber"
            highlighted
            badge="merge"
          />
        </div>

        {/* ===== TIER 7: AI INTELLIGENCE ===== */}
        <TierLabel label="AI Intelligence Layer" color="amber" />

        <div ref={batchLlmRef}>
          <FlowNode
            icon={<Cpu className="h-3 w-3" />}
            label="Batch LLM"
            detail="Haiku — bias adjustments (-50 to +50) for all instruments → server cache 10min, localStorage 4h"
            color="amber"
            badge="ai"
          />
        </div>
        <div ref={summaryLlmRef}>
          <FlowNode
            icon={<Newspaper className="h-3 w-3" />}
            label="Market Summary"
            detail="Sonnet — macro overview, sector outlook, focus/avoid instruments → server cache 10min, localStorage 1h"
            color="amber"
            badge="ai"
          />
        </div>
        <div ref={deskMgrRef}>
          <FlowNode
            icon={<Brain className="h-3 w-3" />}
            label="Desk Manager"
            detail="Opus — top pick, reasoning (MTF+ICT+structure), avoid list, risk warning, desk note → server 10min, client 2min"
            color="amber"
            badge="ai · opus"
          />
        </div>
        <div ref={deskChatRef}>
          <FlowNode
            icon={<MessageSquare className="h-3 w-3" />}
            label="Desk Chat"
            detail="Opus — conversational follow-up with full setup context, max 20 messages → session state only"
            color="amber"
            badge="ai · opus"
          />
        </div>

        {/* ===== TIER 8: OUTPUT ===== */}
        <TierLabel label="Output & Feedback" color="red" />

        <div className="col-start-1 col-span-2" ref={tradeUiRef}>
          <FlowNode
            icon={<LayoutList className="h-3 w-3" />}
            label="Trade Setups UI"
            detail="AITradeDesk cards — ranked by conviction, real-time tracking, entry/SL/TP monitoring → /desk page"
            color="red"
          />
        </div>
        <div ref={deskUiRef}>
          <FlowNode
            icon={<MonitorDot className="h-3 w-3" />}
            label="Desk Manager UI"
            detail="Briefing panel + chat interface → /desk page"
            color="red"
          />
        </div>
        <div ref={learningRef}>
          <FlowNode
            icon={<RefreshCcw className="h-3 w-3" />}
            label="Confluence Learning"
            detail="Win/loss patterns per confluence key → time-decayed win rates → feeds back to conviction scoring → localStorage"
            color="red"
            badge="feedback"
          />
        </div>
      </div>

      {/* ===== ANIMATED BEAM CONNECTIONS ===== */}
      {/* Tier 1 → Tier 2 */}
      <AnimatedBeam containerRef={cRef} fromRef={asRef(priceRef)} toRef={asRef(techRef)} curvature={-15} gradientStartColor={BEAM_BLUE.start} gradientStopColor={BEAM_BLUE.stop} duration={4} delay={0} pathColor="gray" pathOpacity={0.06} pathWidth={1.5} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(priceRef)} toRef={asRef(regimeRef)} curvature={-10} gradientStartColor={BEAM_BLUE.start} gradientStopColor={BEAM_GREEN.stop} duration={4.5} delay={0.2} pathColor="gray" pathOpacity={0.06} pathWidth={1.5} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(fundRef)} toRef={asRef(biasRef)} curvature={-15} gradientStartColor={BEAM_BLUE.start} gradientStopColor={BEAM_BLUE.stop} duration={4} delay={0.4} pathColor="gray" pathOpacity={0.06} pathWidth={1.5} />

      {/* Tier 2 → Tier 3 */}
      <AnimatedBeam containerRef={cRef} fromRef={asRef(techRef)} toRef={asRef(signalsRef)} curvature={-10} gradientStartColor={BEAM_GREEN.start} gradientStopColor={BEAM_GREEN.stop} duration={3.5} delay={0.6} pathColor="gray" pathOpacity={0.06} pathWidth={1.5} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(regimeRef)} toRef={asRef(signalsRef)} curvature={-8} gradientStartColor={BEAM_GREEN.start} gradientStopColor={BEAM_GREEN.stop} duration={4} delay={0.8} pathColor="gray" pathOpacity={0.06} pathWidth={1.5} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(signalsRef)} toRef={asRef(decorrelRef)} curvature={-5} gradientStartColor={BEAM_GREEN.start} gradientStopColor={BEAM_GREEN.stop} duration={3} delay={1.0} pathColor="gray" pathOpacity={0.06} pathWidth={1.5} />

      {/* Tier 3 → Tier 4 (signals feed enrichment) */}
      <AnimatedBeam containerRef={cRef} fromRef={asRef(techRef)} toRef={asRef(structureRef)} curvature={-20} gradientStartColor={BEAM_GREEN.start} gradientStopColor={BEAM_GREEN.stop} duration={5} delay={1.2} pathColor="gray" pathOpacity={0.04} pathWidth={1} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(techRef)} toRef={asRef(ictRef)} curvature={-15} gradientStartColor={BEAM_GREEN.start} gradientStopColor={BEAM_GREEN.stop} duration={5.5} delay={1.4} pathColor="gray" pathOpacity={0.04} pathWidth={1} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(priceRef)} toRef={asRef(mtfRef)} curvature={-30} gradientStartColor={BEAM_BLUE.start} gradientStopColor={BEAM_GREEN.stop} duration={6} delay={1.6} pathColor="gray" pathOpacity={0.04} pathWidth={1} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(techRef)} toRef={asRef(entryOptRef)} curvature={-25} gradientStartColor={BEAM_GREEN.start} gradientStopColor={BEAM_GREEN.stop} duration={5} delay={1.8} pathColor="gray" pathOpacity={0.04} pathWidth={1} />

      {/* Tier 4 → Tier 5 (enrichment feeds conviction) */}
      <AnimatedBeam containerRef={cRef} fromRef={asRef(decorrelRef)} toRef={asRef(convictionRef)} curvature={-15} gradientStartColor={BEAM_GREEN.start} gradientStopColor={BEAM_GREEN.stop} duration={4} delay={2.0} pathColor="gray" pathOpacity={0.06} pathWidth={1.5} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(structureRef)} toRef={asRef(convictionRef)} curvature={-10} gradientStartColor={BEAM_GREEN.start} gradientStopColor={BEAM_GREEN.stop} duration={4.5} delay={2.2} pathColor="gray" pathOpacity={0.06} pathWidth={1.5} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(ictRef)} toRef={asRef(convictionRef)} curvature={-8} gradientStartColor={BEAM_GREEN.start} gradientStopColor={BEAM_GREEN.stop} duration={4} delay={2.4} pathColor="gray" pathOpacity={0.06} pathWidth={1.5} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(mtfRef)} toRef={asRef(convictionRef)} curvature={-12} gradientStartColor={BEAM_GREEN.start} gradientStopColor={BEAM_GREEN.stop} duration={4.5} delay={2.6} pathColor="gray" pathOpacity={0.06} pathWidth={1.5} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(entryOptRef)} toRef={asRef(convictionRef)} curvature={-18} gradientStartColor={BEAM_GREEN.start} gradientStopColor={BEAM_GREEN.stop} duration={5} delay={2.8} pathColor="gray" pathOpacity={0.06} pathWidth={1.5} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(regimeRef)} toRef={asRef(convictionRef)} curvature={-25} gradientStartColor={BEAM_GREEN.start} gradientStopColor={BEAM_GREEN.stop} duration={5.5} delay={3.0} pathColor="gray" pathOpacity={0.04} pathWidth={1} />

      {/* Tier 5 → Tier 6 (decision → setup) */}
      <AnimatedBeam containerRef={cRef} fromRef={asRef(convictionRef)} toRef={asRef(setupRef)} curvature={-8} gradientStartColor={BEAM_GREEN.start} gradientStopColor={BEAM_AMBER.stop} duration={3.5} delay={3.2} pathColor="gray" pathOpacity={0.06} pathWidth={1.5} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(positionRef)} toRef={asRef(setupRef)} curvature={-5} gradientStartColor={BEAM_GREEN.start} gradientStopColor={BEAM_AMBER.stop} duration={3.5} delay={3.4} pathColor="gray" pathOpacity={0.06} pathWidth={1.5} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(filtersRef)} toRef={asRef(setupRef)} curvature={-8} gradientStartColor={BEAM_RED.start} gradientStopColor={BEAM_AMBER.stop} duration={3.5} delay={3.6} pathColor="gray" pathOpacity={0.06} pathWidth={1.5} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(convictionRef)} toRef={asRef(positionRef)} curvature={-5} gradientStartColor={BEAM_GREEN.start} gradientStopColor={BEAM_GREEN.stop} duration={3} delay={3.1} pathColor="gray" pathOpacity={0.04} pathWidth={1} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(positionRef)} toRef={asRef(filtersRef)} curvature={-5} gradientStartColor={BEAM_GREEN.start} gradientStopColor={BEAM_RED.stop} duration={3} delay={3.3} pathColor="gray" pathOpacity={0.04} pathWidth={1} />

      {/* Tier 6 → Tier 7 (setup → AI) */}
      <AnimatedBeam containerRef={cRef} fromRef={asRef(setupRef)} toRef={asRef(batchLlmRef)} curvature={-10} gradientStartColor={BEAM_AMBER.start} gradientStopColor={BEAM_AMBER.stop} duration={4} delay={4.0} pathColor="gray" pathOpacity={0.06} pathWidth={1.5} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(setupRef)} toRef={asRef(summaryLlmRef)} curvature={-6} gradientStartColor={BEAM_AMBER.start} gradientStopColor={BEAM_AMBER.stop} duration={4.5} delay={4.2} pathColor="gray" pathOpacity={0.06} pathWidth={1.5} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(setupRef)} toRef={asRef(deskMgrRef)} curvature={-6} gradientStartColor={BEAM_AMBER.start} gradientStopColor={BEAM_AMBER.stop} duration={4} delay={4.4} pathColor="gray" pathOpacity={0.06} pathWidth={2} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(deskMgrRef)} toRef={asRef(deskChatRef)} curvature={-5} gradientStartColor={BEAM_AMBER.start} gradientStopColor={BEAM_AMBER.stop} duration={3} delay={4.6} pathColor="gray" pathOpacity={0.06} pathWidth={1.5} />
      {/* Fundamentals also feed Market Summary */}
      <AnimatedBeam containerRef={cRef} fromRef={asRef(fundRef)} toRef={asRef(summaryLlmRef)} curvature={-50} gradientStartColor={BEAM_BLUE.start} gradientStopColor={BEAM_AMBER.stop} duration={6} delay={4.3} pathColor="gray" pathOpacity={0.04} pathWidth={1} />
      {/* Fundamentals also feed Desk Manager */}
      <AnimatedBeam containerRef={cRef} fromRef={asRef(fundRef)} toRef={asRef(deskMgrRef)} curvature={-60} gradientStartColor={BEAM_BLUE.start} gradientStopColor={BEAM_AMBER.stop} duration={6.5} delay={4.5} pathColor="gray" pathOpacity={0.04} pathWidth={1} />

      {/* Tier 7 → Tier 8 (AI → output) */}
      <AnimatedBeam containerRef={cRef} fromRef={asRef(batchLlmRef)} toRef={asRef(tradeUiRef)} curvature={-8} gradientStartColor={BEAM_AMBER.start} gradientStopColor={BEAM_RED.stop} duration={3.5} delay={5.0} pathColor="gray" pathOpacity={0.06} pathWidth={1.5} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(setupRef)} toRef={asRef(tradeUiRef)} curvature={-15} gradientStartColor={BEAM_AMBER.start} gradientStopColor={BEAM_RED.stop} duration={4} delay={5.2} pathColor="gray" pathOpacity={0.06} pathWidth={1.5} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(deskMgrRef)} toRef={asRef(deskUiRef)} curvature={-8} gradientStartColor={BEAM_AMBER.start} gradientStopColor={BEAM_RED.stop} duration={3.5} delay={5.4} pathColor="gray" pathOpacity={0.06} pathWidth={1.5} />
      <AnimatedBeam containerRef={cRef} fromRef={asRef(summaryLlmRef)} toRef={asRef(deskUiRef)} curvature={-10} gradientStartColor={BEAM_AMBER.start} gradientStopColor={BEAM_RED.stop} duration={4} delay={5.6} pathColor="gray" pathOpacity={0.06} pathWidth={1.5} />

      {/* Feedback loop: Learning → Conviction (reverse direction) */}
      <AnimatedBeam containerRef={cRef} fromRef={asRef(learningRef)} toRef={asRef(convictionRef)} curvature={80} gradientStartColor={BEAM_RED.start} gradientStopColor={BEAM_GREEN.stop} duration={7} delay={6.0} pathColor="gray" pathOpacity={0.04} pathWidth={1} reverse />
    </div>
  );
}
