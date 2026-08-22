/**
 * The normalized photo domain model. Every photo source (ACC, demo) maps its
 * records into `PlacedPhoto`, and everything downstream — map, legend, inspect
 * panel — depends only on these types, never on a source's wire format.
 */

/** Origin module the photo was added with, normalized across sources. */
export const PHOTO_CATEGORIES = [
  "field-report",
  "issue",
  "form",
  "rfi",
  "gallery",
  "asset",
  "meeting",
  "submittal",
  "other",
] as const;

export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

/** Capture kind, normalized across sources. */
export const PHOTO_MEDIA_TYPES = [
  "photo",
  "video",
  "photosphere",
  "infrared",
] as const;

export type PhotoMediaType = (typeof PHOTO_MEDIA_TYPES)[number];

export interface PlacedPhoto {
  id: string;
  title: string | null;
  category: PhotoCategory;
  mediaType: PhotoMediaType;
  /** ISO datetime the photo was captured (EXIF-derived), when known */
  takenAt: string | null;
  /** ISO datetime the record was created in the source system */
  createdAt: string;
  /** WGS84 decimal degrees; null when the source has no geolocation */
  latitude: number | null;
  longitude: number | null;
  /**
   * App-relative URL that always resolves to a viewable thumbnail — a static
   * asset for demo photos, a proxy route (which handles short-lived signed
   * URLs) for ACC photos. Safe to put in an <img src> at any time.
   */
  thumbnailUrl: string;
  /** Deep link into the system of record; null when there is none */
  sourceUrl: string | null;
}

/**
 * The moment a photo represents: EXIF capture time when the device recorded
 * one, the record's creation time otherwise. Every time-driven view — the
 * timeline, recency coloring, the coverage grid — reads photos through this,
 * so the fallback lives in exactly one place.
 *
 * Returns null when neither date parses, which real exports occasionally hit;
 * callers drop those photos from time-based views rather than dating them to
 * the epoch.
 */
export function photoCapturedAt(
  photo: Pick<PlacedPhoto, "takenAt" | "createdAt">,
): number | null {
  const taken = photo.takenAt === null ? NaN : Date.parse(photo.takenAt);
  if (Number.isFinite(taken)) return taken;
  const created = Date.parse(photo.createdAt);
  return Number.isFinite(created) ? created : null;
}

export function hasLocation(
  photo: PlacedPhoto,
): photo is PlacedPhoto & { latitude: number; longitude: number } {
  return photo.latitude !== null && photo.longitude !== null;
}

/** One page of a photo listing, shaped for cursor-driven progressive loading. */
export interface PhotoPage {
  photos: PlacedPhoto[];
  /** Opaque cursor for the next page; null when this is the last page */
  nextCursor: string | null;
}
