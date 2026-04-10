"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push(redirect);
    router.refresh();
  }

  return (
    <div className="glass-card mx-auto w-full max-w-sm rounded-2xl p-8 shadow-2xl dark:shadow-[0_24px_64px_oklch(0_0_0/0.45)]">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-gradient-teal">Trading</span>{" "}
          <span className="text-muted-foreground/80 font-light">Factory</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Sign in to your account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-xs font-medium text-foreground/80">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full rounded-lg border border-[var(--glass-border)] bg-white/50 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 backdrop-blur-md transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-white/[0.05]"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-xs font-medium text-foreground/80">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-[var(--glass-border)] bg-white/50 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 backdrop-blur-md transition-all focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 dark:bg-white/[0.05]"
            placeholder="Enter your password"
          />
        </div>

        {error && (
          <div className="text-xs text-bearish bg-bearish/10 border border-bearish/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
