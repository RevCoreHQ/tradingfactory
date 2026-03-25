import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createAdminClient();
  const { data: invites, error } = await supabase
    .from("invites")
    .select("*, claimed_profile:claimed_by(email, display_name)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch invites" }, { status: 500 });
  }

  return NextResponse.json({ invites });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { email, expiresInDays } = await request.json();

  const supabase = createAdminClient();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 7));

  const { data: invite, error } = await supabase
    .from("invites")
    .insert({
      email: email || null,
      created_by: auth.profile.id,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }

  return NextResponse.json({ invite });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { inviteId } = await request.json();
  if (!inviteId) {
    return NextResponse.json({ error: "Missing invite ID" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("invites")
    .delete()
    .eq("id", inviteId)
    .is("claimed_by", null);

  if (error) {
    return NextResponse.json({ error: "Failed to delete invite" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
