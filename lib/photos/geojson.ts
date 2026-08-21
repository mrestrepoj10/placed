import type { FeatureCollection, Point } from "geojson";
import { hasLocation, type PhotoCategory, type PlacedPhoto } from "./types";

/**
 * The feature properties carried into the map. Kept minimal — the full
 * `PlacedPhoto` is looked up by id from client state on selection, not
 * round-tripped through MapLibre's serialization.
 */
export interface PhotoFeatureProperties {
  id: string;
  category: PhotoCategory;
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

/** Located photos only — photos without coordinates never reach the map. */
export function toPhotoFeatureCollection(
  photos: PlacedPhoto[],
): PhotoFeatureCollection {
  return {
    type: "FeatureCollection",
    features: photos.filter(hasLocation).map((photo) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [photo.longitude, photo.latitude],
      },
      properties: { id: photo.id, category: photo.category },
    })),
  };
}
