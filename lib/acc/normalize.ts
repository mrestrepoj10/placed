import type {
  PhotoCategory,
  PhotoMediaType,
  PlacedPhoto,
} from "@/lib/photos/types";

/** ACC Photos API media object — the fields placed reads. */
export interface AccPhoto {
  id: string;
  title?: string | null;
  type?: string;
  mediaType?: string;
  createdAt: string;
  takenAt?: string | null;
  deletedAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  signedUrls?: { fileUrl?: string; thumbnailUrl?: string };
}

/**
 * Origin types hidden by default — markups and logos are project artifacts,
 * not field photos.
 */
export const HIDDEN_ACC_TYPES = new Set(["MARKUP", "LOGO"]);

const TYPE_TO_CATEGORY: Record<string, PhotoCategory> = {
  "FIELD-REPORT": "field-report",
  ISSUE: "issue",
  FORM: "form",
  RFI: "rfi",
  GALLERY: "gallery",
  ASSET: "asset",
  MEETING: "meeting",
  SUBMITTAL: "submittal",
};

const MEDIA_TYPE: Record<string, PhotoMediaType> = {
  NORMAL: "photo",
  VIDEO: "video",
  PHOTOSPHERE: "photosphere",
  INFRARED: "infrared",
};

/**
 * Deep link into the Autodesk Build photo gallery. This URL shape is not
 * documented by Autodesk — verified empirically against ACC Build; if it
 * drifts, degrade to the project gallery URL.
 */
function buildSourceUrl(projectId: string, photoId: string): string {
  return `https://acc.autodesk.com/build/photos/projects/${projectId}?photoId=${photoId}`;
}

export function normalizeAccPhoto(
  projectId: string,
  photo: AccPhoto,
): PlacedPhoto {
  return {
    id: photo.id,
    title: photo.title?.trim() || null,
    category: TYPE_TO_CATEGORY[photo.type ?? ""] ?? "other",
    mediaType: MEDIA_TYPE[photo.mediaType ?? ""] ?? "photo",
    takenAt: photo.takenAt ?? null,
    createdAt: photo.createdAt,
    latitude: photo.latitude ?? null,
    longitude: photo.longitude ?? null,
    thumbnailUrl: `/api/projects/${projectId}/photos/${photo.id}/thumbnail`,
    sourceUrl: buildSourceUrl(projectId, photo.id),
  };
}

/** Photos worth showing: not deleted, not a markup/logo artifact. */
export function isVisibleAccPhoto(photo: AccPhoto): boolean {
  return !photo.deletedAt && !HIDDEN_ACC_TYPES.has(photo.type ?? "");
}
