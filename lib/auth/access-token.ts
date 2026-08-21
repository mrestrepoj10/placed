import "server-only";

import {
  getToken,
  revokeToken,
  startAuthorization,
  UserAuthorizationRequiredError,
} from "@vercel/connect";

/**
 * The auth seam. Everything that talks to Autodesk depends on this module's
 * interface — not on @vercel/connect — so a non-Vercel deployment can swap in
 * a hand-rolled token provider without touching the data layer.
 *
 * The current implementation uses a Vercel Connect Custom OAuth connector:
 * Vercel hosts the OAuth handshake, stores the (single-use, rotating) APS
 * refresh tokens, and auto-refreshes. This code only ever sees short-lived
 * access tokens.
 */

const CONNECTOR = process.env.CONNECT_CONNECTOR ?? "oauth/autodesk";
const SCOPES = ["data:read"];

/** Thrown when the visitor has not yet authorized Autodesk access. */
export class AuthorizationRequiredError extends Error {
  constructor() {
    super("Visitor has not authorized Autodesk access");
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
    return await getToken(CONNECTOR, {
      subject: { type: "user", id: visitorId },
      scopes: SCOPES,
    });
  } catch (error) {
    if (error instanceof UserAuthorizationRequiredError) {
      throw new AuthorizationRequiredError();
    }
    if (isConfigurationError(error)) {
      throw new ConnectNotConfiguredError(error);
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
