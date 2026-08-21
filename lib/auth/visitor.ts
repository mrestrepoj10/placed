import "server-only";

import { cookies } from "next/headers";
import { VISITOR_COOKIE, VISITOR_ID_PATTERN } from "./visitor-cookie";

/**
 * The visitor session is a single httpOnly cookie holding a 128-bit random id.
 * It is a session *identifier*, never a token — it keys this visitor's OAuth
 * grant inside Vercel Connect. Unguessable-by-construction; created by
 * proxy.ts.
 */

/** The visitor id, or null when the cookie is missing or malformed. */
export async function getVisitorId(): Promise<string | null> {
  const value = (await cookies()).get(VISITOR_COOKIE)?.value;
  return value && VISITOR_ID_PATTERN.test(value) ? value : null;
}
