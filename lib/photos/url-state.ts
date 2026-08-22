import { endOfDay, fromDayKey, startOfDay, toDayKey } from "./dates";
import {
  ALL_CATEGORIES,
  ALL_MEDIA_TYPES,
  DEFAULT_FILTERS,
  type PhotoFilters,
} from "./filters";
import { isMapMode, type MapMode } from "./map-modes";
import {
  PHOTO_CATEGORIES,
  PHOTO_MEDIA_TYPES,
  type PhotoCategory,
  type PhotoMediaType,
} from "./types";

/**
 * The whole view, in the query string:
 *
 *   ?photo=<id>&c=<lng>,<lat>,<zoom>&mode=<mode>
 *   &q=<title search>&cat=<a,b,c>&media=<a,b>&from=<YYYY-MM-DD>&to=<YYYY-MM-DD>
 *
 * Every write is a `history.replaceState` — never a router push — so panning
 * and brushing stay free, and any view a user is looking at is a link they can
 * paste. Defaults are omitted rather than spelled out, which keeps the common
 * "just a photo" share URL short.
 */

export interface MapViewportState {
  center: [number, number];
  zoom: number;
}

export interface MapUrlState {
  photoId: string | null;
  viewport: MapViewportState | null;
  filters: PhotoFilters;
  mode: MapMode;
}

export const DEFAULT_URL_STATE: MapUrlState = {
  photoId: null,
  viewport: null,
  filters: DEFAULT_FILTERS,
  mode: "categories",
};

function readSet<T extends string>(
  params: URLSearchParams,
  key: string,
  all: readonly T[],
  fallback: ReadonlySet<T>,
): ReadonlySet<T> {
  const raw = params.get(key);
  if (raw === null) return fallback;
  const allowed = new Set<string>(all);
  // An explicitly empty list is a real selection ("show nothing"), not a
  // missing one — `?cat=` round-trips an emptied legend.
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter((value): value is T => allowed.has(value)),
  );
}

function writeSet<T extends string>(
  params: URLSearchParams,
  key: string,
  selected: ReadonlySet<T>,
  all: readonly T[],
): void {
  if (selected.size === all.length) {
    params.delete(key);
    return;
  }
  params.set(key, all.filter((value) => selected.has(value)).join(","));
}

export function readUrlState(): MapUrlState {
  if (typeof window === "undefined") return DEFAULT_URL_STATE;
  const params = new URLSearchParams(window.location.search);

  const c = params.get("c")?.split(",").map(Number) ?? [];
  const viewport =
    c.length === 3 && c.every(Number.isFinite)
      ? { center: [c[0], c[1]] as [number, number], zoom: c[2] }
      : null;

  const mode = params.get("mode");
  const from = params.get("from");
  const to = params.get("to");
  const start = from ? fromDayKey(from) : null;
  const end = to ? fromDayKey(to) : null;

  return {
    photoId: params.get("photo"),
    viewport,
    mode: isMapMode(mode) ? mode : "categories",
    filters: {
      search: params.get("q") ?? "",
      categories: readSet<PhotoCategory>(
        params,
        "cat",
        PHOTO_CATEGORIES,
        ALL_CATEGORIES,
      ),
      mediaTypes: readSet<PhotoMediaType>(
        params,
        "media",
        PHOTO_MEDIA_TYPES,
        ALL_MEDIA_TYPES,
      ),
      // Day keys are inclusive on both ends: `from=to=` a single day selects
      // that whole day, which is what the timeline brush means by one bar.
      start: start === null ? null : startOfDay(start),
      end: end === null ? null : endOfDay(end),
    },
  };
}

export function writeUrlState(state: MapUrlState): void {
  const params = new URLSearchParams(window.location.search);

  if (state.photoId) params.set("photo", state.photoId);
  else params.delete("photo");

  if (state.viewport) {
    const [lng, lat] = state.viewport.center;
    params.set(
      "c",
      `${lng.toFixed(5)},${lat.toFixed(5)},${state.viewport.zoom.toFixed(2)}`,
    );
  }

  if (state.mode === "categories") params.delete("mode");
  else params.set("mode", state.mode);

  const { search, categories, mediaTypes, start, end } = state.filters;
  if (search.trim()) params.set("q", search);
  else params.delete("q");

  writeSet(params, "cat", categories, PHOTO_CATEGORIES);
  writeSet(params, "media", mediaTypes, PHOTO_MEDIA_TYPES);

  if (start === null) params.delete("from");
  else params.set("from", toDayKey(start));
  if (end === null) params.delete("to");
  else params.set("to", toDayKey(end));

  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    query ? `?${query}` : window.location.pathname,
  );
}
