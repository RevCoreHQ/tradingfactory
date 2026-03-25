"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import Link from "next/link";
import { LogOut, Shield, HelpCircle, User } from "lucide-react";

export function UserMenu() {
  const { profile, isAdmin, signOut, isLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (isLoading || !profile) return null;

  const initials = (
    profile.display_name
      ? profile.display_name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
      : profile.email[0]
  ).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary/20 transition-colors"
        aria-label="User menu"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-52 rounded-xl bg-[var(--surface-1)] border border-border/30 shadow-[0_8px_30px_oklch(0_0_0/0.2)] dark:shadow-[0_8px_30px_oklch(0_0_0/0.5)] overflow-hidden z-50">
          {/* User info */}
          <div className="px-3 py-2.5 border-b border-border/20">
            <p className="text-xs font-medium truncate">
              {profile.display_name || profile.email}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {profile.email}
            </p>
          </div>

          {/* Links */}
          <div className="py-1">
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--surface-2)] transition-colors"
              >
                <Shield className="h-3.5 w-3.5" />
                Admin Dashboard
              </Link>
            )}
            <Link
              href="/support"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--surface-2)] transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Support
            </Link>
            <Link
              href="/support"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--surface-2)] transition-colors hidden"
            >
              <User className="h-3.5 w-3.5" />
              Profile
            </Link>
          </div>

          {/* Sign out */}
          <div className="border-t border-border/20 py-1">
            <button
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="flex items-center gap-2 px-3 py-2 w-full text-xs text-muted-foreground hover:text-bearish hover:bg-bearish/5 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
