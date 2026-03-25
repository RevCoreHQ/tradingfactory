"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function SignupForm() {
  const [inviteCode, setInviteCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [theme, setTheme] = useState<"light" | "dark" | "system">("dark");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFirstUser, setIsFirstUser] = useState(false);
  const [checkingFirstUser, setCheckingFirstUser] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/check-first-user")
      .then((r) => r.json())
      .then((d) => setIsFirstUser(d.isFirstUser))
      .catch(() => {})
      .finally(() => setCheckingFirstUser(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validate invite code (skip for first user)
    if (!isFirstUser) {
      try {
        const res = await fetch("/api/auth/validate-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: inviteCode }),
        });
        const data = await res.json();
        if (!data.valid) {
          setError(data.error || "Invalid or expired invite code");
          setLoading(false);
          return;
        }
        // If invite is email-locked, enforce it
        if (data.email && data.email !== email) {
          setError(`This invite is reserved for ${data.email}`);
          setLoading(false);
          return;
        }
      } catch {
        setError("Failed to validate invite code");
        setLoading(false);
        return;
      }
    }

    // Create account
    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Claim the invite code
    if (!isFirstUser && authData.user) {
      await fetch("/api/auth/claim-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inviteCode, userId: authData.user.id }),
      });
    }

    // Save theme preference
    localStorage.setItem("theme", theme);
    if (theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    router.push("/welcome");
    router.refresh();
  }

  if (checkingFirstUser) {
    return (
      <div className="w-full max-w-sm mx-auto flex items-center justify-center py-20">
        <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-gradient-teal">Trading</span>{" "}
          <span className="text-muted-foreground/80 font-light">Factory</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {isFirstUser ? "Create the admin account" : "Create your account"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isFirstUser && (
          <div className="space-y-2">
            <label htmlFor="invite" className="text-xs font-medium text-foreground/80">
              Invite Code
            </label>
            <input
              id="invite"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface-1)] border border-border/30 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              placeholder="Enter your invite code"
            />
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="displayName" className="text-xs font-medium text-foreground/80">
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface-1)] border border-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            placeholder="Your name"
          />
        </div>

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
            className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface-1)] border border-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
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
            minLength={6}
            autoComplete="new-password"
            className="w-full px-3 py-2.5 rounded-lg bg-[var(--surface-1)] border border-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            placeholder="Min 6 characters"
          />
        </div>

        {/* Theme selection */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground/80">
            Theme Preference
          </label>
          <div className="flex gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all ${
                  theme === t
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-[var(--surface-1)] text-muted-foreground border-border/30 hover:border-border/50"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
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
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
