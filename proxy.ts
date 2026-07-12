import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/session-cookie";

/**
 * Edge-safe UX gate only: a cookie's presence is not proof of a valid
 * session. The authoritative check is `getCurrentUser()` in
 * `app/(protected)/layout.tsx`, which verifies the session against the
 * database. This never imports Prisma or any Node-only module so it stays
 * eligible for the Edge runtime.
 */
export function proxy(request: NextRequest) {
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/account/:path*",
    "/activity/:path*",
    "/admin/:path*",
    "/moderator/:path*",
    "/storage/:path*",
    "/users/:path*",
    "/products/:path*",
    "/organizations/:path*",
    "/departments/:path*",
    "/assets/:path*",
    "/audit/:path*",
  ],
};
