import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AuthResult {
  user: { id: string; email: string };
  profile: { id: string; email: string; role: string; display_name: string | null };
}

/**
 * Require authenticated user for API routes.
 * Returns AuthResult on success, or a 401 NextResponse on failure.
 */
export async function requireAuth(): Promise<AuthResult | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use admin client to bypass RLS for profile fetch
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, role, display_name")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 401 });
  }

  return {
    user: { id: user.id, email: user.email! },
    profile,
  };
}

/** Require admin role. Returns AuthResult or 403. */
export async function requireAdmin(): Promise<AuthResult | NextResponse> {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;
  if (result.profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return result;
}
