import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });

    return NextResponse.json({ isFirstUser: (count ?? 0) === 0 });
  } catch {
    return NextResponse.json({ isFirstUser: false });
  }
}
