import "server-only";

import {
  AuthorizationRequiredError,
  getAccessToken,
} from "@/lib/auth/access-token";

import { AccApiError } from "./client";

/**
 * Runs an APS call with this visitor's token, retrying once on a 401.
 *
 * The token layer caches access tokens per server instance and nothing evicts
 * them when a grant is revoked (Disconnect) or rotated, so a cached token can
 * outlive its grant by up to its expiry. A 401 is the signal: mint a fresh
 * token past the cache and try again. When the grant is gone, minting fails
 * with `AuthorizationRequiredError`, which every caller already turns into
 * the Connect card — instead of an error page.
 */
export async function withAccToken<T>(
  visitorId: string,
  run: (token: string) => Promise<T>,
  scopes?: readonly string[],
): Promise<T> {
  const token = await getAccessToken(visitorId, scopes);
  try {
    return await run(token);
  } catch (error) {
    if (!(error instanceof AccApiError && error.status === 401)) throw error;
    const fresh = await getAccessToken(visitorId, scopes, {
      forceRefresh: true,
    });
    // The same token back means Connect itself is still handing out a token
    // APS rejects; retrying would just repeat the 401.
    if (fresh === token) throw new AuthorizationRequiredError(error);
    return run(fresh);
  }
}
