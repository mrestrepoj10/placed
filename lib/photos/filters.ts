import {
  PHOTO_CATEGORIES,
  PHOTO_MEDIA_TYPES,
  photoCapturedAt,
  type PhotoCategory,
  type PhotoMediaType,
  type PlacedPhoto,
} from "./types";

/**
 * Every facet the viewer can narrow by. Composition is AND across facets and
 * OR within one: a photo survives when its category is enabled *and* its media
 * type is enabled *and* its title matches *and* it was captured inside the
 * window.
 *
 * Sets carry the full membership rather than "empty means all" — the legend
 * needs to render an explicitly-empty selection as an empty map, not as no
 * filter at all.
 */
export interface PhotoFilters {
  /** Case-insensitive substring matched against the photo title */
  search: string;
  categories: ReadonlySet<PhotoCategory>;
  mediaTypes: ReadonlySet<PhotoMediaType>;
  /** Inclusive capture window in epoch ms; null on either side = open-ended */
  start: number | null;
  end: number | null;
}

export const ALL_CATEGORIES: ReadonlySet<PhotoCategory> = new Set(
  PHOTO_CATEGORIES,
);
export const ALL_MEDIA_TYPES: ReadonlySet<PhotoMediaType> = new Set(
  PHOTO_MEDIA_TYPES,
);

export const DEFAULT_FILTERS: PhotoFilters = {
  search: "",
  categories: ALL_CATEGORIES,
  mediaTypes: ALL_MEDIA_TYPES,
  start: null,
  end: null,
};

/** Facets a caller can exclude to compute counts for that facet's own control. */
export type FilterFacet = "search" | "categories" | "mediaTypes" | "date";

function isFullSet<T>(selected: ReadonlySet<T>, all: ReadonlySet<T>): boolean {
  return selected.size === all.size;
}

/** True when the filters would let every photo through. */
export function isDefaultFilters(filters: PhotoFilters): boolean {
  return (
    filters.search.trim() === "" &&
    isFullSet(filters.categories, ALL_CATEGORIES) &&
    isFullSet(filters.mediaTypes, ALL_MEDIA_TYPES) &&
    filters.start === null &&
    filters.end === null
  );
}

/**
 * `skip` leaves one facet out so a control can count what it would show if the
 * user changed only that facet — the legend's per-category counts stay honest
 * under a date brush, and the timeline histogram doesn't collapse into the
 * window the user is currently dragging.
 */
export function matchesFilters(
  photo: PlacedPhoto,
  filters: PhotoFilters,
  skip?: FilterFacet,
): boolean {
  if (skip !== "categories" && !filters.categories.has(photo.category)) {
    return false;
  }
  if (skip !== "mediaTypes" && !filters.mediaTypes.has(photo.mediaType)) {
    return false;
  }
  if (skip !== "search") {
    const needle = filters.search.trim().toLowerCase();
    if (needle && !(photo.title ?? "").toLowerCase().includes(needle)) {
      return false;
    }
  }
  if (skip !== "date" && (filters.start !== null || filters.end !== null)) {
    const capturedAt = photoCapturedAt(photo);
    // An undateable photo can't be inside a window; excluding it is the
    // honest read, and the stats bar still counts it in the project total.
    if (capturedAt === null) return false;
    if (filters.start !== null && capturedAt < filters.start) return false;
    if (filters.end !== null && capturedAt > filters.end) return false;
  }
  return true;
}
