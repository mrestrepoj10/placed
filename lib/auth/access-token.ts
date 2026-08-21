import "server-only";

import { TokenError } from "aec-auth";
import { connectTokenSource } from "aec-auth/connect";
import { revokeToken, startAuthorization } from "@vercel/connect";

/**
 * The auth seam. Everything that talks to Autodesk depends on this module's
 * interface, so a non-Vercel deployment can swap the backend without touching
 * the data layer.
 *
 * Token acquisition runs through aec-auth's Vercel Connect TokenSource:
 * Vercel hosts the OAuth handshake, stores the (single-use, rotating) APS
 * refresh tokens, and auto-refreshes; aec-auth adds an in-process,
 * expiry-aware cache with single-flight de-duplication on top (Connect bills
 * per token request). Swapping to another aec-auth backend (self-hosted
 * vault, Better Auth) means changing only `tokens` below.
 *
 * Consent kickoff and revocation are deliberately outside the TokenSource
 * contract — they stay on @vercel/connect directly.
 */

const CONNECTOR = process.env.CONNECT_CONNECTOR ?? "oauth/autodesk";
const SCOPES = ["data:read"];

const tokens = connectTokenSource({ connectors: { aps: CONNECTOR } });

/** Thrown when the visitor has not yet authorized Autodesk access. */
export class AuthorizationRequiredError extends Error {
  constructor(cause?: unknown) {
    super("Visitor has not authorized Autodesk access", { cause });
    this.name = "AuthorizationRequiredError";
  }
}

/**
 * Thrown when the deployment itself can't reach Vercel Connect — no OIDC
 * token (unlinked local checkout) or no connector. A setup problem for the
 * deployer, not an auth state of the visitor.
 */
export class ConnectNotConfiguredError extends Error {
  constructor(cause: unknown) {
    super("Vercel Connect is not configured for this deployment", { cause });
    this.name = "ConnectNotConfiguredError";
  }
}

function isConfigurationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "VercelOidcTokenError" ||
    /oidc|vc link|vercel link/i.test(error.message)
  );
}

/** A short-lived APS access token for this visitor's Autodesk grant. */
export async function getAccessToken(visitorId: string): Promise<string> {
  try {
    const { token } = await tokens.getToken({
      provider: "aps",
      subject: { type: "user", id: visitorId },
      scopes: SCOPES,
    });
    return token;
  } catch (error) {
    if (error instanceof TokenError) {
      // grant_invalid (revoked / >15-day-idle refresh chain) needs the same
      // remedy as no grant at all: send the visitor back through consent.
      if (error.code === "consent_required" || error.code === "grant_invalid") {
        throw new AuthorizationRequiredError(error);
      }
      if (error.code === "not_configured") {
        throw new ConnectNotConfiguredError(error);
      }
      if (isConfigurationError(error.cause)) {
        throw new ConnectNotConfiguredError(error);
      }
    }
    throw error;
  }
}

/**
 * URL of the hosted consent flow; redirect the visitor there, and they return
 * to `callbackUrl` once the grant is stored.
 */
export async function getAuthorizationUrl(
  visitorId: string,
  callbackUrl: string,
): Promise<string> {
  try {
    const { url } = await startAuthorization(
      CONNECTOR,
      { subject: { type: "user", id: visitorId }, scopes: SCOPES },
      { callbackUrl },
    );
    return url;
  } catch (error) {
    if (isConfigurationError(error)) {
      throw new ConnectNotConfiguredError(error);
    }
    throw error;
  }
}

/** Revoke this visitor's Autodesk grant. */
export async function disconnect(visitorId: string): Promise<void> {
  await revokeToken(CONNECTOR, { subject: { type: "user", id: visitorId } });
}
