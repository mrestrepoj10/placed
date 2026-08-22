import type { FeatureCollection, Point } from "geojson";
import {
  hasLocation,
  photoCapturedAt,
  type PhotoCategory,
  type PhotoMediaType,
  type PlacedPhoto,
} from "./types";

/**
 * The feature properties carried into the map. Everything here exists because
 * a MapLibre expression reads it — category coloring, media-type filtering,
 * recency ramps. The full `PlacedPhoto` is still looked up by id from client
 * state on selection, never round-tripped through MapLibre's serialization.
 *
 * Dates are epoch milliseconds, not ISO strings: expressions can do arithmetic
 * on numbers and nothing else.
 */
export interface PhotoFeatureProperties {
  id: string;
  category: PhotoCategory;
  mediaType: PhotoMediaType;
  /**
   * `takenAt` with a per-photo fallback to `createdAt` — the timestamp every
   * time-driven layer reads. Omitted (not null) when neither date parses, so
   * expressions can branch on `["has", "capturedAt"]`; a null would poison the
   * arithmetic instead.
   */
  capturedAt?: number;
  takenAt?: number;
  createdAt?: number;
  [key: string]: unknown;
}

export type PhotoFeatureCollection = FeatureCollection<
  Point,
  PhotoFeatureProperties
>;

export const EMPTY_PHOTO_COLLECTION: PhotoFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function epochMs(iso: string | null): number | undefined {
  if (iso === null) return undefined;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : undefined;
}

/** Located photos only — photos without coordinates never reach the map. */
export function toPhotoFeatureCollection(
  photos: PlacedPhoto[],
): PhotoFeatureCollection {
  return {
    type: "FeatureCollection",
    features: photos.filter(hasLocation).map((photo) => {
      const capturedAt = photoCapturedAt(photo);
      const takenAt = epochMs(photo.takenAt);
      const createdAt = epochMs(photo.createdAt);
      return {
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [photo.longitude, photo.latitude],
        },
        properties: {
          id: photo.id,
          category: photo.category,
          mediaType: photo.mediaType,
          ...(capturedAt !== null && { capturedAt }),
          ...(takenAt !== undefined && { takenAt }),
          ...(createdAt !== undefined && { createdAt }),
        },
      };
    }),
  };
}
