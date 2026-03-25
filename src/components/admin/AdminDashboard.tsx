"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/auth-provider";
import { Users, Mail, Ticket, Copy, Check, Trash2 } from "lucide-react";
import { Header } from "@/components/dashboard/Header";

type Tab = "users" | "invites" | "tickets";

interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  onboarding_complete: boolean;
  created_at: string;
}

interface Invite {
  id: string;
  code: string;
  email: string | null;
  claimed_by: string | null;
  claimed_profile: { email: string; display_name: string | null } | null;
  expires_at: string;
  created_at: string;
}

interface SupportTicket {
  id: string;
  type: string;
  subject: string;
  description: string;
  status: string;
  admin_notes: string | null;
  profile: { email: string; display_name: string | null } | null;
  created_at: string;
}

export function AdminDashboard() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "users") {
        const res = await fetch("/api/admin/users");
        const data = await res.json();
        setUsers(data.users || []);
      } else if (tab === "invites") {
        const res = await fetch("/api/admin/invites");
        const data = await res.json();
        setInvites(data.invites || []);
      } else {
        const res = await fetch("/api/admin/tickets");
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function toggleRole(userId: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "user" : "admin";
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: newRole }),
    });
    fetchData();
  }

  async function createInvite() {
    await fetch("/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail || null }),
    });
    setInviteEmail("");
    fetchData();
  }

  async function deleteInvite(inviteId: string) {
    await fetch("/api/admin/invites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId }),
    });
    fetchData();
  }

  async function updateTicketStatus(ticketId: string, status: string) {
    await fetch("/api/admin/tickets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, status }),
    });
    fetchData();
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Access denied</p>
      </div>
    );
  }

  const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: "users", label: "Users", icon: Users },
    { key: "invites", label: "Invites", icon: Mail },
    { key: "tickets", label: "Tickets", icon: Ticket },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header mode="overview" />
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <h1 className="text-xl font-bold">Admin Dashboard</h1>

        {/* Tabs */}
        <div className="flex gap-1 bg-[var(--surface-1)] rounded-lg p-1 w-fit border border-border/20">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-all ${
                tab === t.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Users tab */}
            {tab === "users" && (
              <div className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[var(--surface-1)] border border-border/20"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {u.display_name || u.email}
                        </p>
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            u.role === "admin"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {u.role}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <button
                      onClick={() => toggleRole(u.id, u.role)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-border/30 hover:bg-[var(--surface-2)] transition-colors shrink-0"
                    >
                      {u.role === "admin" ? "Demote" : "Promote"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Invites tab */}
            {tab === "invites" && (
              <div className="space-y-4">
                {/* Create invite */}
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Lock to email (optional)"
                    className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-1)] border border-border/30 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    onClick={createInvite}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all shrink-0"
                  >
                    Generate Invite
                  </button>
                </div>

                {/* Invite list */}
                <div className="space-y-2">
                  {invites.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[var(--surface-1)] border border-border/20"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono font-bold">
                            {inv.code}
                          </code>
                          <button
                            onClick={() => copyCode(inv.code)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {copiedCode === inv.code ? (
                              <Check className="h-3.5 w-3.5 text-bullish" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                          {inv.claimed_by && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-bullish/10 text-bullish">
                              Claimed
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {inv.email ? `For: ${inv.email}` : "Open invite"}
                          {inv.claimed_profile &&
                            ` — Claimed by ${inv.claimed_profile.display_name || inv.claimed_profile.email}`}
                          {" · Expires "}
                          {new Date(inv.expires_at).toLocaleDateString()}
                        </p>
                      </div>
                      {!inv.claimed_by && (
                        <button
                          onClick={() => deleteInvite(inv.id)}
                          className="text-muted-foreground hover:text-bearish transition-colors shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {invites.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No invites yet. Generate one above.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Tickets tab */}
            {tab === "tickets" && (
              <div className="space-y-2">
                {tickets.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl bg-[var(--surface-1)] border border-border/20 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              t.type === "bug"
                                ? "bg-bearish/10 text-bearish"
                                : t.type === "feature"
                                ? "bg-primary/10 text-primary"
                                : "bg-amber/10 text-amber"
                            }`}
                          >
                            {t.type}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              t.status === "open"
                                ? "bg-amber/10 text-amber"
                                : t.status === "resolved"
                                ? "bg-bullish/10 text-bullish"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {t.status}
                          </span>
                        </div>
                        <p className="text-sm font-medium mt-1">{t.subject}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t.description}
                        </p>
                        <p className="text-[11px] text-muted-foreground/60 mt-1">
                          By {t.profile?.display_name || t.profile?.email || "Unknown"}{" "}
                          · {new Date(t.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <select
                        value={t.status}
                        onChange={(e) => updateTicketStatus(t.id, e.target.value)}
                        className="text-xs px-2 py-1.5 rounded-lg bg-[var(--surface-2)] border border-border/30 text-foreground shrink-0"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  </div>
                ))}
                {tickets.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No support tickets yet.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
