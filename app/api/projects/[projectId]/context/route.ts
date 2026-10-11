import { NextResponse } from "next/server";

import { AccApiError, getProjectContext } from "@/lib/acc/client";
import {
  ACCOUNT_SCOPES,
  AuthorizationRequiredError,
  ConnectNotConfiguredError,
  getAccessToken,
} from "@/lib/auth/access-token";
import { getVisitorId } from "@/lib/auth/visitor";
import { EMPTY_PROJECT_CONTEXT } from "@/lib/photos/project-context";

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

/**
 * Project dates and members for the phase and company legends. Everything
 * here is optional enrichment: when the visitor's grant lacks `account:read`
 * (connected before it was requested) or ACC refuses the Admin API, this
 * answers 200 with an empty context and the map simply offers fewer legends.
 * `access` says which, so the client can tell "nothing to show" from "ask to
 * reconnect".
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/projects/[projectId]/context">,
) {
  const { projectId } = await context.params;
  if (!UUID_PATTERN.test(projectId)) {
    return NextResponse.json({ error: "invalid-project" }, { status: 400 });
  }

  const visitorId = await getVisitorId();
  if (!visitorId) {
    return NextResponse.json({ error: "no-session" }, { status: 401 });
  }

  try {
    const token = await getAccessToken(visitorId, ACCOUNT_SCOPES);
    const project = await getProjectContext(token, projectId);
    return NextResponse.json({ context: project, access: "granted" });
  } catch (error) {
    if (error instanceof AuthorizationRequiredError) {
      return NextResponse.json({
        context: EMPTY_PROJECT_CONTEXT,
        access: "consent-required",
      });
    }
    if (error instanceof ConnectNotConfiguredError) {
      return NextResponse.json(
        { error: "connect-not-configured" },
        { status: 503 },
      );
    }
    if (error instanceof AccApiError) {
      return NextResponse.json(
        { error: "acc-request-failed" },
        { status: error.status === 429 ? 429 : 502 },
      );
    }
    throw error;
  }
}
