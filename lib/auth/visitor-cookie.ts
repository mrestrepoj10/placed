/**
 * Visitor-cookie primitives shared by proxy.ts (which creates the cookie —
 * server components cannot set cookies) and the server-side session reader.
 * Kept free of next/headers so the proxy bundle stays lean.
 */

export const VISITOR_COOKIE = "placed_visitor";

export const VISITOR_ID_PATTERN = /^[0-9a-f]{32}$/;

/** 128-bit random hex id — a session identifier, never a token. */
export function generateVisitorId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
