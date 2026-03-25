"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-provider";
import { BarChart3, BookOpen, Brain, LineChart } from "lucide-react";

const FEATURES = [
  {
    icon: BarChart3,
    title: "Overview",
    description:
      "Real-time market dashboard with bias scores, movers, economic calendar, and fundamental data across all your instruments.",
  },
  {
    icon: LineChart,
    title: "Trading Desk",
    description:
      "AI-powered trade advisor that generates mechanical setups with conviction scores, position sizing, and risk management.",
  },
  {
    icon: BookOpen,
    title: "Journal",
    description:
      "Log and review trades with automated performance analytics, win rates, and P&L tracking across all strategies.",
  },
  {
    icon: Brain,
    title: "Analysis",
    description:
      "Deep instrument analysis with multi-timeframe technical signals, ICT concepts, and institutional flow detection.",
  },
];

export function WelcomePage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();

  async function completeOnboarding() {
    setLoading(true);
    await fetch("/api/auth/complete-onboarding", { method: "POST" });
    await refreshProfile();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {step === 0 && (
          <div className="text-center space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Welcome{profile?.display_name ? `, ${profile.display_name}` : ""}
              </h1>
              <p className="text-muted-foreground mt-2">
                Let&apos;s get you set up with Trading Factory
              </p>
            </div>

            <div className="py-4">
              <div className="h-px bg-border/30" />
            </div>

            <p className="text-sm text-muted-foreground/80">
              Trading Factory is a professional-grade trading dashboard that combines
              fundamental analysis, technical signals, and AI-powered trade generation
              into a single platform.
            </p>

            <button
              onClick={() => setStep(1)}
              className="px-8 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all"
            >
              See what&apos;s inside
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold">Key Features</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Here&apos;s what you can do
              </p>
            </div>

            <div className="grid gap-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="flex gap-4 p-4 rounded-xl bg-[var(--surface-1)] border border-border/20"
                >
                  <div className="shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{f.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {f.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setStep(2)}
                className="px-8 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all"
              >
                Get Started
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="text-center space-y-6">
            <div>
              <h2 className="text-xl font-bold">You&apos;re all set!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Your dashboard is ready. Dive in and start analyzing markets.
              </p>
            </div>

            <button
              onClick={completeOnboarding}
              disabled={loading}
              className="px-8 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {loading ? "Loading..." : "Go to Dashboard"}
            </button>
          </div>
        )}

        {/* Step indicators */}
        <div className="flex justify-center gap-2 mt-8">
          {[0, 1, 2].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s === step ? "w-6 bg-primary" : "w-1.5 bg-border/50"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
