import { NextResponse, type NextRequest } from "next/server";

import {
  generateVisitorId,
  VISITOR_COOKIE,
  VISITOR_ID_PATTERN,
} from "@/lib/auth/visitor-cookie";

/**
 * Thin gate: guarantee every request carries a visitor id cookie. No token
 * exchange, no auth decisions — those live in server code behind the auth
 * seam.
 */
export function proxy(request: NextRequest) {
  const existing = request.cookies.get(VISITOR_COOKIE)?.value;
  if (existing && VISITOR_ID_PATTERN.test(existing)) {
    return NextResponse.next();
  }

  const visitorId = generateVisitorId();

  // Set on the request too, so this same render pass can already read it
  request.cookies.set(VISITOR_COOKIE, visitorId);
  const response = NextResponse.next({ request });
  response.cookies.set({
    name: VISITOR_COOKIE,
    value: visitorId,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export const proxyConfig = {
  // Everything except static assets — API routes need the cookie too
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|ico|mjs)).*)"],
};
