import "server-only";

import type { PhotoPage } from "@/lib/photos/types";
import {
  isVisibleAccPhoto,
  normalizeAccPhoto,
  type AccPhoto,
} from "./normalize";

/**
 * Thin client over the two APS surfaces placed needs: Data Management for
 * hub/project enumeration and the Photos API for media. All calls take a
 * 3-legged user token from the auth seam — this module never sees
 * credentials.
 */

const APS_BASE = "https://developer.api.autodesk.com";
const PAGE_LIMIT = 50; // Photos API maximum

export class AccApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AccApiError";
  }
}

async function accFetch<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${APS_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new AccApiError(
      response.status,
      `APS request failed: ${response.status} ${path}`,
    );
  }
  return response.json() as Promise<T>;
}

// --- Project enumeration (Data Management API) ---

export interface AccProject {
  /** Bare UUID — the format the Photos API expects (DM's "b." prefix stripped) */
  id: string;
  name: string;
  hubName: string;
}

interface DmEntity {
  id: string;
  attributes: { name: string };
}

/** ACC/BIM 360 hubs and their projects visible to this user. */
export async function listProjects(token: string): Promise<AccProject[]> {
  const hubs = await accFetch<{ data: DmEntity[] }>(token, "/project/v1/hubs");
  const accHubs = hubs.data.filter((hub) => hub.id.startsWith("b."));

  const perHub = await Promise.all(
    accHubs.map(async (hub) => {
      const projects = await accFetch<{ data: DmEntity[] }>(
        token,
        `/project/v1/hubs/${hub.id}/projects`,
      );
      return projects.data.map((project) => ({
        id: project.id.replace(/^b\./, ""),
        name: project.attributes.name,
        hubName: hub.attributes.name,
      }));
    }),
  );

  return perHub
    .flat()
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
}

// --- Photos API ---

interface PhotosFilterResponse {
  results: AccPhoto[];
  pagination?: {
    nextPost?: { body?: { cursorState?: string } };
  };
}

/**
 * One page of the project's photo gallery, normalized. Cursor pagination is
 * serial by design (the API has no parallel page access); callers stream
 * pages and render progressively.
 */
export async function listPhotoPage(
  token: string,
  projectId: string,
  cursor: string | null,
): Promise<PhotoPage> {
  // No `include: ["signedUrls"]` here — thumbnails resolve through the proxy
  // route just-in-time, so the listing stays lean and nothing short-lived is
  // ever handed to the client.
  const body = cursor
    ? { cursorState: cursor }
    : { limit: PAGE_LIMIT, sort: ["createdAt", "desc"] };

  const page = await accFetch<PhotosFilterResponse>(
    token,
    `/construction/photos/v1/projects/${projectId}/photos:filter`,
    { method: "POST", body: JSON.stringify(body) },
  );

  return {
    photos: page.results
      .filter(isVisibleAccPhoto)
      .map((photo) => normalizeAccPhoto(projectId, photo)),
    nextCursor: page.pagination?.nextPost?.body?.cursorState ?? null,
  };
}

export interface PhotoAssetCandidate {
  url: string;
  requiresAuthorization: boolean;
}

/**
 * Asset candidates ordered from smallest/least privileged to largest. ACC can
 * omit signed URLs, so its authenticated asset URLs are retained as fallback.
 * None of these URLs are cached, stored, or returned directly to the browser.
 */
export async function getPhotoAssetCandidates(
  token: string,
  projectId: string,
  photoId: string,
): Promise<PhotoAssetCandidate[]> {
  const result = await accFetch<PhotosFilterResponse>(
    token,
    `/construction/photos/v1/projects/${projectId}/photos:filter`,
    {
      method: "POST",
      body: JSON.stringify({
        filter: { id: [photoId] },
        include: ["signedUrls"],
        limit: 1,
      }),
    },
  );
  const photo = result.results[0];
  if (!photo) return [];

  const candidates: Array<PhotoAssetCandidate | null> = [
    photo.signedUrls?.thumbnailUrl
      ? { url: photo.signedUrls.thumbnailUrl, requiresAuthorization: false }
      : null,
    photo.urls?.thumbnailUrl
      ? { url: photo.urls.thumbnailUrl, requiresAuthorization: true }
      : null,
    photo.signedUrls?.fileUrl
      ? { url: photo.signedUrls.fileUrl, requiresAuthorization: false }
      : null,
    photo.urls?.fileUrl
      ? { url: photo.urls.fileUrl, requiresAuthorization: true }
      : null,
  ];

  return candidates.filter(
    (candidate): candidate is PhotoAssetCandidate => candidate !== null,
  );
}
