import "server-only";

import { fromApsHub, fromApsProject } from "@/lib/aps-data-preset";
import type { Hub, Project } from "@/lib/project-types";
import type {
  ProjectContext,
  ProjectMember,
} from "@/lib/photos/project-context";
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
/** Pages of same-titled photos to search for one id before giving up. */
const MAX_TITLE_PAGES = 4;

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

/**
 * The hubs and projects this user can see, in the generic cantera shapes the
 * pickers take. Project ids are bare UUIDs — the format the Photos API
 * expects (Data Management's "b." prefix stripped); hub ids stay as DM
 * returns them.
 */
export interface AccProjectCatalog {
  hubs: Hub[];
  projects: Project[];
}

interface DmDocument {
  id: string;
  attributes?: { name?: string; region?: string };
  relationships?: { hub?: { data?: { id?: string } } };
}

export async function listProjects(token: string): Promise<AccProjectCatalog> {
  const hubsResponse = await accFetch<{ data: DmDocument[] }>(
    token,
    "/project/v1/hubs",
  );
  // ACC/BIM 360 hubs only — the Photos API has no equivalent for Fusion Team
  const hubs = hubsResponse.data
    .filter((hub) => hub.id.startsWith("b."))
    .map(fromApsHub)
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));

  const perHub = await Promise.all(
    hubs.map(async (hub) => {
      const response = await accFetch<{ data: DmDocument[] }>(
        token,
        `/project/v1/hubs/${hub.id}/projects`,
      );
      return response.data.map((doc) => {
        const project = fromApsProject(doc);
        return { ...project, id: project.id.replace(/^b\./, ""), hubId: hub.id };
      });
    }),
  );

  const projects = perHub
    .flat()
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));

  return { hubs, projects };
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

// --- Project context (Admin API) ---

interface AdminProject {
  startDate?: string | null;
  endDate?: string | null;
}

interface AdminProjectUser {
  autodeskId?: string | null;
  name?: string | null;
  companyId?: string | null;
  companyName?: string | null;
}

interface AdminUsersPage {
  results?: AdminProjectUser[];
  pagination?: { totalResults?: number };
}

const USERS_PAGE_LIMIT = 200; // Admin API maximum
/** Enough for any real project team; a runaway loop costs nothing past it. */
const MAX_USER_PAGES = 25;

/**
 * Null when the caller may not read it — a hidden legend, not an error. A 401
 * still throws: that's a stale token, which the caller retries with a fresh
 * one (see `withAccToken`), not a permission answer.
 */
async function optional<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof AccApiError && [403, 404].includes(error.status)) {
      return null;
    }
    throw error;
  }
}

async function listProjectMembers(
  token: string,
  projectId: string,
): Promise<Record<string, ProjectMember>> {
  const members: Record<string, ProjectMember> = {};
  for (let page = 0; page < MAX_USER_PAGES; page += 1) {
    const offset = page * USERS_PAGE_LIMIT;
    const response = await accFetch<AdminUsersPage>(
      token,
      `/construction/admin/v1/projects/${projectId}/users?limit=${USERS_PAGE_LIMIT}&offset=${offset}`,
    );
    const results = response.results ?? [];
    for (const user of results) {
      if (!user.autodeskId) continue;
      members[user.autodeskId] = {
        name: user.name ?? null,
        companyId: user.companyId ?? null,
        companyName: user.companyName ?? null,
      };
    }
    const total = response.pagination?.totalResults ?? 0;
    if (results.length < USERS_PAGE_LIMIT || offset + results.length >= total) {
      break;
    }
  }
  return members;
}

/**
 * The project dates and member list behind the phase and company legends.
 * Each half is independent and optional: a viewer who may read the project
 * but not its members still gets phases. Requires an `account:read` token.
 */
export async function getProjectContext(
  token: string,
  projectId: string,
): Promise<ProjectContext> {
  const [project, members] = await Promise.all([
    optional(
      accFetch<AdminProject>(
        token,
        `/construction/admin/v1/projects/${projectId}?fields=startDate,endDate`,
      ),
    ),
    optional(listProjectMembers(token, projectId)),
  ]);
  return {
    startDate: project?.startDate ?? null,
    endDate: project?.endDate ?? null,
    members,
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
  const base = `/construction/photos/v1/projects/${projectId}`;

  // Measured against ACC, not taken from the docs: photos:filter ignores its
  // `id` facet (it returns the first page, which once served one photo's
  // thumbnail for every pin), and the single-photo GET answers with the
  // title but no id or asset URLs. The title facet does filter, so: read the
  // title by id, search by title, and keep only the result with this id —
  // titles aren't unique, hence the paging.
  let title: string | null | undefined;
  try {
    ({ title } = await accFetch<Pick<AccPhoto, "title">>(
      token,
      `${base}/photos/${photoId}`,
    ));
  } catch (error) {
    if (error instanceof AccApiError && [404, 410].includes(error.status)) {
      return [];
    }
    throw error;
  }
  if (!title) return [];

  let photo: AccPhoto | undefined;
  let body: object = {
    filter: { title },
    include: ["signedUrls"],
    limit: PAGE_LIMIT,
  };
  for (let page = 0; page < MAX_TITLE_PAGES && !photo; page += 1) {
    const result = await accFetch<PhotosFilterResponse>(
      token,
      `${base}/photos:filter`,
      { method: "POST", body: JSON.stringify(body) },
    );
    photo = result.results.find((candidate) => candidate.id === photoId);
    const cursor = result.pagination?.nextPost?.body?.cursorState;
    if (!cursor) break;
    body = { cursorState: cursor };
  }
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
