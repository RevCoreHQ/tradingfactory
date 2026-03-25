import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const { code, userId } = await request.json();
    if (!code || !userId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("invites")
      .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
      .eq("code", code)
      .is("claimed_by", null);

    if (error) {
      return NextResponse.json({ error: "Failed to claim invite" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to claim invite" }, { status: 500 });
  }
}
