import { NextRequest, NextResponse } from "next/server";

/**
 * Lightweight route guard: redirects to /login if the session cookie is
 * absent. This is a fast, edge-safe presence check only — it does not
 * verify the cookie's HMAC signature (that happens server-side in
 * lib/session/session.ts wherever the operator identity is actually used).
 * Its only job is to keep an obviously-logged-out device off the
 * operator screens.
 */
const PROTECTED_PREFIXES = ["/home", "/jobs", "/active-job", "/report-output"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) return NextResponse.next();

  const hasSession = request.cookies.has("shopfloor_session");
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/home/:path*", "/jobs/:path*", "/active-job/:path*", "/report-output/:path*"],
};
