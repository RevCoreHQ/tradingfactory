"use client";

import { useRef } from "react";
import { motion, useTransform, type MotionValue } from "motion/react";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import {
  Brain,
  Database,
  Cog,
  Target,
  Shield,
  Crosshair,
} from "lucide-react";

interface SystemHeroProps {
  scrollYProgress: MotionValue<number>;
}

const NODES = [
  {
    key: "data",
    icon: Database,
    label: "Data",
    position: "top-[18%] left-[18%]",
    color: "text-neutral-accent",
    bg: "bg-neutral-accent/10 border-neutral-accent/20",
    gradientStart: "#a0a0a0",
    gradientStop: "#606060",
    curvature: 60,
  },
  {
    key: "signals",
    icon: Cog,
    label: "Signals",
    position: "top-[18%] right-[18%]",
    color: "text-bullish",
    bg: "bg-bullish/10 border-bullish/20",
    gradientStart: "#22c55e",
    gradientStop: "#16a34a",
    curvature: 60,
  },
  {
    key: "conviction",
    icon: Target,
    label: "Conviction",
    position: "top-[46%] right-[10%]",
    color: "text-blue-500",
    bg: "bg-blue-500/10 border-blue-500/20",
    gradientStart: "#3b82f6",
    gradientStop: "#1d4ed8",
    curvature: -20,
  },
  {
    key: "risk",
    icon: Shield,
    label: "Risk",
    position: "bottom-[22%] right-[18%]",
    color: "text-bearish",
    bg: "bg-bearish/10 border-bearish/20",
    gradientStart: "#ef4444",
    gradientStop: "#b91c1c",
    curvature: -60,
  },
  {
    key: "execution",
    icon: Crosshair,
    label: "Execute",
    position: "bottom-[22%] left-[18%]",
    color: "text-amber-500",
    bg: "bg-amber-500/10 border-amber-500/20",
    gradientStart: "#f59e0b",
    gradientStop: "#d97706",
    curvature: -60,
  },
] as const;

export function SystemHero({ scrollYProgress }: SystemHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const brainRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<HTMLDivElement>(null);
  const signalsRef = useRef<HTMLDivElement>(null);
  const convictionRef = useRef<HTMLDivElement>(null);
  const riskRef = useRef<HTMLDivElement>(null);
  const executionRef = useRef<HTMLDivElement>(null);

  const refs = [dataRef, signalsRef, convictionRef, riskRef, executionRef];

  const opacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.25], [0, -60]);

  return (
    <div
      ref={containerRef}
      className="relative h-[50vh] min-h-[400px] max-h-[600px] overflow-hidden"
    >
      {/* Neural network layer */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center z-10"
        style={{ opacity, y }}
      >
        {/* Satellite nodes — desktop only */}
        <div className="hidden md:block">
          {NODES.map((node, i) => (
            <div
              key={node.key}
              ref={refs[i]}
              className={`absolute ${node.position} h-11 w-11 rounded-full border flex items-center justify-center ${node.bg} backdrop-blur-sm`}
            >
              <node.icon className={`h-4 w-4 ${node.color}`} />
              <span className={`absolute -bottom-5 text-[10px] font-semibold ${node.color} opacity-60 whitespace-nowrap`}>
                {node.label}
              </span>
            </div>
          ))}
        </div>

        {/* Center brain */}
        <div ref={brainRef} className="relative">
          <div className="absolute -inset-6 rounded-full border border-neutral-accent/5 animate-pulse" />
          <div className="absolute -inset-3 rounded-full border border-neutral-accent/10 animate-ping [animation-duration:3s]" />
          <div className="h-28 w-28 md:h-32 md:w-32 rounded-full bg-neutral-accent/10 border border-neutral-accent/20 flex items-center justify-center backdrop-blur-sm">
            <Brain className="h-14 w-14 md:h-16 md:w-16 text-neutral-accent" />
          </div>
        </div>

        {/* Title + badges below */}
        <div className="absolute bottom-[8%] left-0 right-0 flex flex-col items-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-4xl md:text-6xl font-bold tracking-tight text-foreground text-center"
          >
            The Brain
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="text-sm md:text-base text-muted-foreground mt-3 text-center"
          >
            15-stage neural pipeline — from raw data to execution
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="flex items-center gap-3 mt-6"
          >
            {[
              { label: "8 Systems", color: "bg-bullish/15 text-bullish border-bullish/25" },
              { label: "16 Instruments", color: "bg-neutral-accent/15 text-neutral-accent border-neutral-accent/25" },
              { label: "3 Clusters", color: "bg-amber-500/15 text-amber-700 dark:text-amber-500 border-amber-500/25" },
            ].map((stat) => (
              <span
                key={stat.label}
                className={`text-[12px] font-semibold px-3 py-1.5 rounded-full border ${stat.color}`}
              >
                {stat.label}
              </span>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Animated beams — desktop only */}
      <div className="hidden md:block">
        {NODES.map((node, i) => (
          <AnimatedBeam
            key={node.key}
            containerRef={containerRef as React.RefObject<HTMLElement>}
            fromRef={refs[i] as React.RefObject<HTMLElement>}
            toRef={brainRef as React.RefObject<HTMLElement>}
            curvature={node.curvature}
            gradientStartColor={node.gradientStart}
            gradientStopColor={node.gradientStop}
            duration={4 + i * 0.6}
            delay={i * 0.4}
            pathColor="gray"
            pathOpacity={0.08}
            pathWidth={2}
          />
        ))}
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent z-20" />
    </div>
  );
}
