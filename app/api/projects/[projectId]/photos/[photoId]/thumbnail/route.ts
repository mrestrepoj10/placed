import { NextResponse } from "next/server";

import { AccApiError, getThumbnailUrl } from "@/lib/acc/client";
import {
  AuthorizationRequiredError,
  getAccessToken,
} from "@/lib/auth/access-token";
import { getVisitorId } from "@/lib/auth/visitor";

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

/**
 * Owns the short-lived-signed-URL problem: fetches a fresh signed thumbnail
 * URL from ACC and 302-redirects to it, so `<img src>` always gets a valid
 * signature and the client does zero expiry bookkeeping. The brief private
 * max-age stays well under the ~60s signature TTL.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/projects/[projectId]/photos/[photoId]/thumbnail">,
) {
  const { projectId, photoId } = await context.params;
  if (!UUID_PATTERN.test(projectId) || !UUID_PATTERN.test(photoId)) {
    return new NextResponse(null, { status: 400 });
  }

  const visitorId = await getVisitorId();
  if (!visitorId) return new NextResponse(null, { status: 401 });

  try {
    const token = await getAccessToken(visitorId);
    const url = await getThumbnailUrl(token, projectId, photoId);
    if (!url) return new NextResponse(null, { status: 404 });
    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (error) {
    if (error instanceof AuthorizationRequiredError) {
      return new NextResponse(null, { status: 401 });
    }
    if (error instanceof AccApiError) {
      // 410 = photo deleted in ACC since we listed it
      return new NextResponse(null, {
        status: error.status === 410 ? 410 : 502,
      });
    }
    throw error;
  }
}
