import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createAdminClient();
  const { data: tickets, error } = await supabase
    .from("support_tickets")
    .select("*, profile:user_id(email, display_name)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 });
  }

  return NextResponse.json({ tickets });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { ticketId, status, adminNotes } = await request.json();
  if (!ticketId) {
    return NextResponse.json({ error: "Missing ticket ID" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) updates.status = status;
  if (adminNotes !== undefined) updates.admin_notes = adminNotes;

  const { error } = await supabase
    .from("support_tickets")
    .update(updates)
    .eq("id", ticketId);

  if (error) {
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
