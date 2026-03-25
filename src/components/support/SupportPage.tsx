"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/dashboard/Header";
import { Send } from "lucide-react";

interface Ticket {
  id: string;
  type: string;
  subject: string;
  description: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

export function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [type, setType] = useState<"bug" | "feature" | "question">("bug");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [success, setSuccess] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      const res = await fetch("/api/support/tickets");
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch {
      // silently fail
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSuccess(false);

    await fetch("/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, subject, description }),
    });

    setSubject("");
    setDescription("");
    setSuccess(true);
    setSubmitting(false);
    fetchTickets();
    setTimeout(() => setSuccess(false), 3000);
  }

  return (
    <div className="min-h-screen bg-background">
      <Header mode="overview" />
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-8">
        <h1 className="text-xl font-bold">Support</h1>

        {/* Submit form */}
        <form
          onSubmit={handleSubmit}
          className="p-5 rounded-xl bg-[var(--surface-1)] border border-border/20 space-y-4"
        >
          <h2 className="text-sm font-semibold">Report an Issue or Request</h2>

          <div className="flex gap-2">
            {(["bug", "feature", "question"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  type === t
                    ? t === "bug"
                      ? "bg-bearish/10 text-bearish border-bearish/30"
                      : t === "feature"
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-amber/10 text-amber border-amber/30"
                    : "bg-[var(--surface-2)] text-muted-foreground border-border/30"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            placeholder="Subject"
            className="w-full px-3 py-2.5 rounded-lg bg-background border border-border/30 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
            placeholder="Describe the issue or request..."
            className="w-full px-3 py-2.5 rounded-lg bg-background border border-border/30 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />

          <div className="flex items-center justify-between">
            {success && (
              <p className="text-xs text-bullish">Ticket submitted successfully!</p>
            )}
            <div className="flex-1" />
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>

        {/* Past tickets */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Your Tickets
          </h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground/60 text-center py-8">
              No tickets submitted yet.
            </p>
          ) : (
            tickets.map((t) => (
              <div
                key={t.id}
                className="p-4 rounded-xl bg-[var(--surface-1)] border border-border/20 space-y-1"
              >
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
                        : t.status === "in_progress"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-sm font-medium">{t.subject}</p>
                <p className="text-xs text-muted-foreground">{t.description}</p>
                {t.admin_notes && (
                  <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                    <p className="text-[10px] font-bold text-primary uppercase mb-0.5">
                      Admin Response
                    </p>
                    <p className="text-xs text-foreground/80">{t.admin_notes}</p>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground/50 pt-1">
                  {new Date(t.created_at).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
