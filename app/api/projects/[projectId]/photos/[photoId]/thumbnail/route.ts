import { NextResponse } from "next/server";

import { AccApiError, getPhotoAssetCandidates } from "@/lib/acc/client";
import {
  AuthorizationRequiredError,
  getAccessToken,
} from "@/lib/auth/access-token";
import { getVisitorId } from "@/lib/auth/visitor";

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

/**
 * Owns the short-lived-signed-URL problem: fetches the image server-side and
 * streams it from our origin. If ACC has not generated a thumbnail (which can
 * happen for recent gallery uploads), the original image is the fallback.
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
    const candidates = await getPhotoAssetCandidates(token, projectId, photoId);

    for (const candidate of candidates) {
      const asset = await fetch(candidate.url, {
        cache: "no-store",
        headers: candidate.requiresAuthorization
          ? { Authorization: `Bearer ${token}` }
          : undefined,
      });
      if (!asset.ok || !asset.body) continue;

      const contentType = asset.headers.get("content-type") ?? "image/jpeg";
      if (!contentType.toLowerCase().startsWith("image/")) continue;

      return new NextResponse(asset.body, {
        status: 200,
        headers: {
          "Cache-Control": "private, max-age=30",
          "Content-Type": contentType,
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return new NextResponse(null, { status: candidates.length ? 502 : 404 });
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
