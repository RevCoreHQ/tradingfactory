import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = await createClient();
  const { data: tickets, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 });
  }

  return NextResponse.json({ tickets });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { type, subject, description } = await request.json();
  if (!type || !subject || !description) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({
      user_id: auth.user.id,
      type,
      subject,
      description,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
  }

  return NextResponse.json({ ticket });
}
