import { NextResponse, type NextRequest } from "next/server";

import { AccApiError, listPhotoPage } from "@/lib/acc/client";
import {
  AuthorizationRequiredError,
  getAccessToken,
} from "@/lib/auth/access-token";
import { getVisitorId } from "@/lib/auth/visitor";

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

/**
 * The client's window onto the ACC photo gallery: one page of normalized
 * metadata per call, driven by the serial cursor. The APS token never leaves
 * this handler.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/projects/[projectId]/photos">,
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
    const token = await getAccessToken(visitorId);
    const cursor = request.nextUrl.searchParams.get("cursor");
    const page = await listPhotoPage(token, projectId, cursor);
    return NextResponse.json(page);
  } catch (error) {
    if (error instanceof AuthorizationRequiredError) {
      return NextResponse.json(
        { error: "authorization-required" },
        { status: 401 },
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
