import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createClient } from "@supabase/supabase-js";

const PUBLIC_ROUTES = ["/login", "/signup"];
const AUTH_API_PREFIX = "/api/auth";
const ADMIN_ROUTES = ["/brain", "/admin"];

/** Service-role client for middleware profile checks (bypasses RLS) */
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth API routes — they handle their own auth
  if (pathname.startsWith(AUTH_API_PREFIX)) {
    return NextResponse.next();
  }

  // Refresh session and get user
  const { user, supabaseResponse } = await updateSession(request);

  // Public routes: if logged in, redirect to home
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    if (user) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return supabaseResponse;
  }

  // All other routes require auth
  if (!user) {
    // API routes get 401 JSON; pages get redirected to login
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check profile for admin routes and onboarding
  if (
    ADMIN_ROUTES.some((r) => pathname.startsWith(r)) ||
    (!pathname.startsWith("/welcome") && !pathname.startsWith("/api"))
  ) {
    // Use service-role client to bypass RLS for middleware checks
    const admin = getAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role, onboarding_complete")
      .eq("id", user.id)
      .single();

    // Admin route check
    if (ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
      if (!profile || profile.role !== "admin") {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }

    // Onboarding redirect (skip for /welcome, /api, and /admin routes)
    if (
      profile &&
      !profile.onboarding_complete &&
      !pathname.startsWith("/welcome") &&
      !pathname.startsWith("/api") &&
      !ADMIN_ROUTES.some((r) => pathname.startsWith(r))
    ) {
      return NextResponse.redirect(new URL("/welcome", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
