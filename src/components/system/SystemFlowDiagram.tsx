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

// ==================== Compact Flow Node ====================

type NodeColor = "blue" | "green" | "amber" | "red";

const colorMap: Record<
  NodeColor,
  { bg: string; border: string; icon: string; text: string; glow: string }
> = {
  blue: {
    bg: "bg-neutral-accent/5",
    border: "border-neutral-accent/30",
    icon: "text-neutral-accent",
    text: "text-neutral-accent",
    glow: "shadow-neutral-accent/10",
  },
  green: {
    bg: "bg-bullish/5",
    border: "border-bullish/30",
    icon: "text-bullish",
    text: "text-bullish",
    glow: "shadow-bullish/10",
  },
  amber: {
    bg: "bg-amber-500/5",
    border: "border-amber-500/30",
    icon: "text-amber-600 dark:text-amber-500",
    text: "text-amber-600 dark:text-amber-500",
    glow: "shadow-amber-500/10",
  },
  red: {
    bg: "bg-bearish/5",
    border: "border-bearish/30",
    icon: "text-bearish",
    text: "text-bearish",
    glow: "shadow-bearish/10",
  },
};

interface FlowNodeProps {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  color: NodeColor;
  badge?: string;
  large?: boolean;
}

function FlowNode({ icon, label, subtitle, color, badge, large }: FlowNodeProps) {
  const c = colorMap[color];
  return (
    <div
      className={cn(
        "rounded-lg border backdrop-blur-sm flex flex-col items-center justify-center text-center gap-0.5 shadow-sm",
        c.bg,
        c.border,
        c.glow,
        large ? "px-4 py-3 min-w-[160px]" : "px-3 py-2 min-w-[120px]"
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={c.icon}>{icon}</span>
        <span className={cn("text-[13px] font-semibold text-foreground leading-tight", large && "text-xs")}>
          {label}
        </span>
      </div>
      {subtitle && (
        <p className="text-[10px] text-muted-foreground/50 leading-tight max-w-[180px]">{subtitle}</p>
      )}
      {badge && (
        <span
          className={cn(
            "text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5",
            c.bg,
            c.text
          )}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

// ==================== Tier Divider ====================

function TierDivider({ label, color }: { label: string; color: NodeColor }) {
  const tc: Record<NodeColor, string> = {
    blue: "text-neutral-accent/30",
    green: "text-bullish/30",
    amber: "text-amber-500/30",
    red: "text-bearish/30",
  };
  const bc: Record<NodeColor, string> = {
    blue: "border-neutral-accent/10",
    green: "border-bullish/10",
    amber: "border-amber-500/10",
    red: "border-bearish/10",
  };
  return (
    <div className="flex items-center gap-4 w-full">
      <div className={cn("h-px flex-1 border-t border-dashed", bc[color])} />
      <span className={cn("text-[10px] font-bold uppercase tracking-[0.2em] whitespace-nowrap", tc[color])}>
        {label}
      </span>
      <div className={cn("h-px flex-1 border-t border-dashed", bc[color])} />
    </div>
  );
}

// ==================== Beam Colors ====================

const B = {
  blue: { start: "#6b8aad", stop: "#4a6d8c" },
  green: { start: "#22c55e", stop: "#16a34a" },
  amber: { start: "#f59e0b", stop: "#d97706" },
  red: { start: "#ef4444", stop: "#b91c1c" },
};

// Helper to make a beam
function Beam({
  container,
  from,
  to,
  color,
  curvature = 0,
  delay = 0,
  duration = 4,
  width = 1.5,
  opacity = 0.08,
  reverse = false,
}: {
  container: React.RefObject<HTMLElement>;
  from: React.RefObject<HTMLElement>;
  to: React.RefObject<HTMLElement>;
  color: keyof typeof B;
  curvature?: number;
  delay?: number;
  duration?: number;
  width?: number;
  opacity?: number;
  reverse?: boolean;
}) {
  return (
    <AnimatedBeam
      containerRef={container}
      fromRef={from}
      toRef={to}
      curvature={curvature}
      gradientStartColor={B[color].start}
      gradientStopColor={B[color].stop}
      duration={duration}
      delay={delay}
      pathColor="gray"
      pathOpacity={opacity}
      pathWidth={width}
      reverse={reverse}
    />
  );
}

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
  const entryRef = useRef<HTMLDivElement>(null);

  // Tier 5: Decision
  const convictionRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);

  // Tier 6: Merge
  const setupRef = useRef<HTMLDivElement>(null);

  // Tier 7: AI
  const batchRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // Tier 8: Output
  const tradeUiRef = useRef<HTMLDivElement>(null);
  const deskUiRef = useRef<HTMLDivElement>(null);
  const learningRef = useRef<HTMLDivElement>(null);

  const c = containerRef as React.RefObject<HTMLElement>;
  const r = (ref: React.RefObject<HTMLDivElement | null>) => ref as React.RefObject<HTMLElement>;

  return (
    <div ref={containerRef} className="relative">
      {/* Dot grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 0.5px, transparent 0.5px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Flow layout */}
      <div className="relative z-10 flex flex-col items-center gap-10 py-6">
        {/* ===== TIER 1: DATA SOURCES ===== */}
        <TierDivider label="Data Ingestion" color="blue" />
        <div className="flex items-start justify-center gap-16">
          <div ref={priceRef}>
            <FlowNode
              icon={<Database className="h-3 w-3" />}
              label="Price APIs"
              subtitle="Twelve Data / Finnhub / CoinGecko — 5m to Weekly (style-specific)"
              color="blue"
              badge="data"
            />
          </div>
          <div ref={fundRef}>
            <FlowNode
              icon={<Globe className="h-3 w-3" />}
              label="Fundamental APIs"
              subtitle="F&G, DXY, Bonds, News, Central Banks, COT, Rate Diffs, Events"
              color="blue"
              badge="data"
            />
          </div>
        </div>

        {/* ===== TIER 2: PROCESSING ===== */}
        <TierDivider label="Technical Processing" color="blue" />
        <div className="flex items-start justify-center gap-10">
          <div ref={techRef}>
            <FlowNode
              icon={<BarChart3 className="h-3 w-3" />}
              label="Technical Indicators"
              subtitle="RSI, MACD, BB, EMA, ATR, ADX"
              color="blue"
            />
          </div>
          <div ref={regimeRef}>
            <FlowNode
              icon={<Layers className="h-3 w-3" />}
              label="Regime Engine"
              subtitle="Volatility + Wyckoff Phase + ADX Trend"
              color="green"
              badge="mechanical"
            />
          </div>
          <div ref={biasRef}>
            <FlowNode
              icon={<Scale className="h-3 w-3" />}
              label="Bias Engine"
              subtitle="8 fundamentals → direction + strength"
              color="blue"
            />
          </div>
        </div>

        {/* ===== TIER 3: SIGNALS ===== */}
        <TierDivider label="Signal Generation" color="green" />
        <div className="flex items-start justify-center gap-16">
          <div ref={signalsRef}>
            <FlowNode
              icon={<Cog className="h-3 w-3" />}
              label="8 Signal Systems"
              subtitle="MA Cross, MACD, BB, RSI, Elder, Trend Stack"
              color="green"
              badge="mechanical"
            />
          </div>
          <div ref={decorrelRef}>
            <FlowNode
              icon={<GitBranch className="h-3 w-3" />}
              label="De-correlation"
              subtitle="3 clusters: Trend, Mean Reversion, Momentum"
              color="green"
            />
          </div>
        </div>

        {/* ===== TIER 4: ENRICHMENT ===== */}
        <TierDivider label="Enrichment Layer" color="green" />
        <div className="flex items-start justify-center gap-8">
          <div ref={structureRef}>
            <FlowNode
              icon={<AlignVerticalSpaceAround className="h-3 w-3" />}
              label="Market Structure"
              subtitle="BOS, CHoCH, swing detection"
              color="green"
            />
          </div>
          <div ref={ictRef}>
            <FlowNode
              icon={<Gem className="h-3 w-3" />}
              label="ICT Context"
              subtitle="FVG, Order Blocks, Displacement"
              color="green"
            />
          </div>
          <div ref={mtfRef}>
            <FlowNode
              icon={<Layers className="h-3 w-3" />}
              label="MTF Alignment"
              subtitle="Style-specific TF EMA stacks"
              color="green"
            />
          </div>
          <div ref={entryRef}>
            <FlowNode
              icon={<Crosshair className="h-3 w-3" />}
              label="Entry Optimization"
              subtitle="Hammer, Engulfing, Pin Bar, FVG Reentry"
              color="green"
            />
          </div>
        </div>

        {/* ===== TIER 5: DECISION ===== */}
        <TierDivider label="Decision Layer" color="green" />
        <div className="flex items-start justify-center gap-10">
          <div ref={convictionRef}>
            <FlowNode
              icon={<Target className="h-3 w-3" />}
              label="Conviction Scoring"
              subtitle="De-corr + Regime + Impulse + Structure + ICT → A+ to D"
              color="green"
              badge="mechanical"
            />
          </div>
          <div ref={positionRef}>
            <FlowNode
              icon={<Ruler className="h-3 w-3" />}
              label="Position Sizing"
              subtitle="ATR-based SL/TP, conviction-scaled lots"
              color="green"
            />
          </div>
          <div ref={filtersRef}>
            <FlowNode
              icon={<ShieldCheck className="h-3 w-3" />}
              label="Hard Filters"
              subtitle="Elder gates, R:R ≥ 1.5, portfolio limits"
              color="red"
              badge="filter"
            />
          </div>
        </div>

        {/* ===== TIER 6: MERGE ===== */}
        <TierDivider label="Setup Assembly" color="amber" />
        <div className="flex justify-center" ref={setupRef}>
          <FlowNode
            icon={<Box className="h-3.5 w-3.5" />}
            label="TradeDeskSetup"
            subtitle="18+ fields: conviction, regime, signals, ICT, structure, MTF, entry, sizing"
            color="amber"
            badge="merge point"
            large
          />
        </div>

        {/* ===== TIER 7: AI ===== */}
        <TierDivider label="Intelligence Layer" color="amber" />
        <div className="flex items-start justify-center gap-8">
          <div ref={batchRef}>
            <FlowNode
              icon={<Cpu className="h-3 w-3" />}
              label="Batch LLM"
              subtitle="Haiku — bias adjustments per instrument"
              color="amber"
              badge="ai"
            />
          </div>
          <div ref={summaryRef}>
            <FlowNode
              icon={<Newspaper className="h-3 w-3" />}
              label="Market Summary"
              subtitle="Opus — institutional macro strategist, COT/carry/events"
              color="amber"
              badge="ai"
            />
          </div>
          <div ref={deskRef}>
            <FlowNode
              icon={<Brain className="h-3 w-3" />}
              label="Desk Manager"
              subtitle="Opus — institutional risk manager, 7-factor priority"
              color="amber"
              badge="ai · opus"
            />
          </div>
          <div ref={chatRef}>
            <FlowNode
              icon={<MessageSquare className="h-3 w-3" />}
              label="Desk Chat"
              subtitle="Opus — conversational follow-up"
              color="amber"
              badge="ai · opus"
            />
          </div>
        </div>

        {/* ===== TIER 8: OUTPUT ===== */}
        <TierDivider label="Output & Feedback" color="red" />
        <div className="flex items-start justify-center gap-10">
          <div ref={tradeUiRef}>
            <FlowNode
              icon={<LayoutList className="h-3 w-3" />}
              label="Trade Setups UI"
              subtitle="Ranked cards with real-time tracking"
              color="red"
            />
          </div>
          <div ref={deskUiRef}>
            <FlowNode
              icon={<MonitorDot className="h-3 w-3" />}
              label="Desk Manager UI"
              subtitle="Briefing panel + chat interface"
              color="red"
            />
          </div>
          <div ref={learningRef}>
            <FlowNode
              icon={<RefreshCcw className="h-3 w-3" />}
              label="Confluence Learning"
              subtitle="Win rates → feeds back to conviction"
              color="red"
              badge="feedback loop"
            />
          </div>
        </div>
      </div>

      {/* ===== ANIMATED BEAM CONNECTIONS ===== */}

      {/* Tier 1 → Tier 2 */}
      <Beam container={c} from={r(priceRef)} to={r(techRef)} color="blue" curvature={-20} delay={0} duration={4} />
      <Beam container={c} from={r(priceRef)} to={r(regimeRef)} color="blue" curvature={-10} delay={0.3} duration={4.5} />
      <Beam container={c} from={r(fundRef)} to={r(biasRef)} color="blue" curvature={-20} delay={0.5} duration={4} />

      {/* Tier 2 → Tier 3 */}
      <Beam container={c} from={r(techRef)} to={r(signalsRef)} color="green" curvature={-15} delay={0.8} duration={3.5} />
      <Beam container={c} from={r(regimeRef)} to={r(signalsRef)} color="green" curvature={-10} delay={1.0} duration={4} />
      <Beam container={c} from={r(signalsRef)} to={r(decorrelRef)} color="green" curvature={-8} delay={1.2} duration={3} />

      {/* Tier 2/3 → Tier 4 (enrichment) */}
      <Beam container={c} from={r(techRef)} to={r(structureRef)} color="green" curvature={-30} delay={1.4} duration={5} opacity={0.05} width={1} />
      <Beam container={c} from={r(techRef)} to={r(ictRef)} color="green" curvature={-20} delay={1.6} duration={5.5} opacity={0.05} width={1} />
      <Beam container={c} from={r(priceRef)} to={r(mtfRef)} color="blue" curvature={-40} delay={1.8} duration={6} opacity={0.05} width={1} />
      <Beam container={c} from={r(techRef)} to={r(entryRef)} color="green" curvature={-35} delay={2.0} duration={5} opacity={0.05} width={1} />

      {/* Tier 3/4 → Tier 5 (conviction) */}
      <Beam container={c} from={r(decorrelRef)} to={r(convictionRef)} color="green" curvature={-15} delay={2.2} duration={4} />
      <Beam container={c} from={r(structureRef)} to={r(convictionRef)} color="green" curvature={-10} delay={2.4} duration={4.5} />
      <Beam container={c} from={r(ictRef)} to={r(convictionRef)} color="green" curvature={-8} delay={2.6} duration={4} />
      <Beam container={c} from={r(mtfRef)} to={r(convictionRef)} color="green" curvature={-12} delay={2.8} duration={4.5} />
      <Beam container={c} from={r(entryRef)} to={r(convictionRef)} color="green" curvature={-20} delay={3.0} duration={5} />
      <Beam container={c} from={r(regimeRef)} to={r(convictionRef)} color="green" curvature={-35} delay={3.2} duration={5.5} opacity={0.05} width={1} />

      {/* Tier 5 internal: conviction → sizing → filters */}
      <Beam container={c} from={r(convictionRef)} to={r(positionRef)} color="green" curvature={-8} delay={3.3} duration={3} opacity={0.06} width={1} />
      <Beam container={c} from={r(positionRef)} to={r(filtersRef)} color="red" curvature={-8} delay={3.5} duration={3} opacity={0.06} width={1} />

      {/* Tier 5 → Tier 6 (setup) */}
      <Beam container={c} from={r(convictionRef)} to={r(setupRef)} color="amber" curvature={-12} delay={3.6} duration={3.5} />
      <Beam container={c} from={r(positionRef)} to={r(setupRef)} color="amber" curvature={-8} delay={3.8} duration={3.5} />
      <Beam container={c} from={r(filtersRef)} to={r(setupRef)} color="red" curvature={-12} delay={4.0} duration={3.5} />

      {/* Tier 6 → Tier 7 (AI) */}
      <Beam container={c} from={r(setupRef)} to={r(batchRef)} color="amber" curvature={-12} delay={4.2} duration={4} />
      <Beam container={c} from={r(setupRef)} to={r(summaryRef)} color="amber" curvature={-8} delay={4.4} duration={4.5} />
      <Beam container={c} from={r(setupRef)} to={r(deskRef)} color="amber" curvature={-8} delay={4.6} duration={4} width={2} />
      <Beam container={c} from={r(deskRef)} to={r(chatRef)} color="amber" curvature={-8} delay={4.8} duration={3} />
      {/* Fundamentals also feed Summary + Desk */}
      <Beam container={c} from={r(fundRef)} to={r(summaryRef)} color="blue" curvature={-60} delay={4.5} duration={6} opacity={0.04} width={1} />
      <Beam container={c} from={r(fundRef)} to={r(deskRef)} color="blue" curvature={-70} delay={4.7} duration={6.5} opacity={0.04} width={1} />

      {/* Tier 7 → Tier 8 (output) */}
      <Beam container={c} from={r(batchRef)} to={r(tradeUiRef)} color="red" curvature={-10} delay={5.0} duration={3.5} />
      <Beam container={c} from={r(setupRef)} to={r(tradeUiRef)} color="amber" curvature={-20} delay={5.2} duration={4} opacity={0.06} width={1} />
      <Beam container={c} from={r(deskRef)} to={r(deskUiRef)} color="red" curvature={-10} delay={5.4} duration={3.5} />
      <Beam container={c} from={r(summaryRef)} to={r(deskUiRef)} color="red" curvature={-12} delay={5.6} duration={4} />

      {/* Feedback loop: Learning → Conviction */}
      <Beam container={c} from={r(learningRef)} to={r(convictionRef)} color="red" curvature={90} delay={6.0} duration={7} opacity={0.05} width={1} reverse />
    </div>
  );
}
