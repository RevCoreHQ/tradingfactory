import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    if (!code) {
      return NextResponse.json({ valid: false, error: "Invite code required" });
    }

    const supabase = createAdminClient();
    const { data: invite } = await supabase
      .from("invites")
      .select("id, code, email, claimed_by, expires_at")
      .eq("code", code)
      .single();

    if (!invite) {
      return NextResponse.json({ valid: false, error: "Invalid invite code" });
    }

    if (invite.claimed_by) {
      return NextResponse.json({ valid: false, error: "Invite already used" });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: "Invite expired" });
    }

    return NextResponse.json({ valid: true, email: invite.email || null });
  } catch {
    return NextResponse.json({ valid: false, error: "Validation failed" });
  }
}
