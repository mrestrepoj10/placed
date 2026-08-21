import { NextResponse, type NextRequest } from "next/server";

import { getAuthorizationUrl } from "@/lib/auth/access-token";
import { getVisitorId } from "@/lib/auth/visitor";

/**
 * Kicks off the hosted Autodesk consent flow for this visitor. Vercel Connect
 * runs the OAuth handshake and returns the visitor to `returnTo`.
 */
export async function GET(request: NextRequest) {
  const visitorId = await getVisitorId();
  if (!visitorId) {
    // proxy.ts sets the cookie on this response's round trip; retry once
    return NextResponse.redirect(new URL("/projects", request.nextUrl.origin));
  }

  const returnToParam = request.nextUrl.searchParams.get("returnTo") ?? "";
  // Same-origin paths only — never an open redirect
  const returnTo =
    returnToParam.startsWith("/") && !returnToParam.startsWith("//")
      ? returnToParam
      : "/projects";

  const callbackUrl = new URL(returnTo, request.nextUrl.origin).toString();
  const authorizationUrl = await getAuthorizationUrl(visitorId, callbackUrl);
  return NextResponse.redirect(authorizationUrl);
}
