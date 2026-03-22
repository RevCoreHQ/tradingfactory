"use client";

import { motion, useTransform, type MotionValue } from "motion/react";

interface SystemHeroProps {
  scrollYProgress: MotionValue<number>;
}

export function SystemHero({ scrollYProgress }: SystemHeroProps) {
  const pathLength1 = useTransform(scrollYProgress, [0, 0.15], [0.1, 1.1]);
  const pathLength2 = useTransform(scrollYProgress, [0, 0.15], [0.05, 1.1]);
  const pathLength3 = useTransform(scrollYProgress, [0, 0.15], [0, 1.1]);

  const opacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.25], [0, -60]);

  return (
    <div className="relative h-[50vh] min-h-[400px] max-h-[600px] overflow-hidden">
      {/* SVG flowing paths */}
      <svg
        width="1440"
        height="600"
        viewBox="0 0 1440 600"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Background blurred paths */}
        <path
          d="M0 350 C180 280, 360 420, 540 350 C720 280, 900 420, 1080 350 C1200 310, 1350 380, 1440 350"
          stroke="var(--bullish)"
          strokeWidth="2"
          fill="none"
          pathLength={1}
          filter="url(#hero-blur)"
          opacity="0.15"
        />
        <path
          d="M0 300 C200 240, 400 360, 600 300 C800 240, 1000 360, 1200 300 C1320 270, 1400 320, 1440 300"
          stroke="var(--neutral-accent)"
          strokeWidth="2"
          fill="none"
          pathLength={1}
          filter="url(#hero-blur)"
          opacity="0.15"
        />
        <path
          d="M0 250 C240 200, 440 310, 660 250 C880 190, 1060 320, 1260 250 C1360 220, 1420 270, 1440 250"
          stroke="var(--amber)"
          strokeWidth="2"
          fill="none"
          pathLength={1}
          filter="url(#hero-blur)"
          opacity="0.15"
        />

        {/* Animated foreground paths */}
        <motion.path
          d="M0 350 C180 280, 360 420, 540 350 C720 280, 900 420, 1080 350 C1200 310, 1350 380, 1440 350"
          stroke="var(--bullish)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          style={{ pathLength: pathLength1 }}
          transition={{ duration: 0, ease: "linear" }}
          opacity="0.5"
        />
        <motion.path
          d="M0 300 C200 240, 400 360, 600 300 C800 240, 1000 360, 1200 300 C1320 270, 1400 320, 1440 300"
          stroke="var(--neutral-accent)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          style={{ pathLength: pathLength2 }}
          transition={{ duration: 0, ease: "linear" }}
          opacity="0.5"
        />
        <motion.path
          d="M0 250 C240 200, 440 310, 660 250 C880 190, 1060 320, 1260 250 C1360 220, 1420 270, 1440 250"
          stroke="var(--amber)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          style={{ pathLength: pathLength3 }}
          transition={{ duration: 0, ease: "linear" }}
          opacity="0.5"
        />

        <defs>
          <filter id="hero-blur">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
          </filter>
        </defs>
      </svg>

      {/* Center text overlay */}
      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center z-10"
        style={{ opacity, y }}
      >
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-3xl md:text-5xl font-bold tracking-tight text-foreground text-center"
        >
          Trading System
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-sm md:text-base text-muted-foreground mt-3 text-center"
        >
          15-stage mechanical pipeline — from raw data to execution
        </motion.p>

        {/* Stat badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="flex items-center gap-3 mt-6"
        >
          {[
            { label: "8 Systems", color: "bg-bullish/15 text-bullish border-bullish/25" },
            { label: "16 Instruments", color: "bg-neutral-accent/15 text-neutral-accent border-neutral-accent/25" },
            { label: "3 Clusters", color: "bg-amber-500/15 text-amber-500 border-amber-500/25" },
          ].map((stat) => (
            <span
              key={stat.label}
              className={`text-[10px] font-semibold px-3 py-1.5 rounded-full border ${stat.color}`}
            >
              {stat.label}
            </span>
          ))}
        </motion.div>
      </motion.div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
