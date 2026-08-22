import type { FeatureCollection, Polygon } from "geojson";

import { DAY_MS } from "./dates";
import { hasLocation, photoCapturedAt, type PlacedPhoto } from "./types";

/**
 * Coverage asks the question the pin map can't: *where has nobody been?* The
 * grid tiles the photo extent at a fixed ground size and colors each cell by
 * its most recent photo. Cells with no photo at all are drawn hollow — those
 * holes are the answer.
 */

/** Target cell size on the ground. */
export const COVERAGE_CELL_METERS = 50;

/**
 * Ceiling on drawn cells. A single stray coordinate can stretch the extent
 * across a continent; rather than emit millions of polygons, the cell size
 * doubles until the grid fits, and the legend reports what it actually drew.
 */
export const MAX_COVERAGE_CELLS = 12_000;

const METERS_PER_DEGREE_LAT = 111_320;

export interface CoverageCellProperties {
  count: number;
  /** Epoch ms of the newest photo in the cell; 0 when the cell is empty */
  latestAt: number;
  /** Whole-day age of that photo at the grid's as-of time; -1 when empty */
  ageDays: number;
  [key: string]: unknown;
}

export interface CoverageGrid {
  cells: FeatureCollection<Polygon, CoverageCellProperties>;
  /** The cell size actually used, after any widening */
  cellMeters: number;
  /** Cells holding at least one photo */
  coveredCells: number;
  totalCells: number;
  /** The instant ages were measured against */
  asOf: number;
}

interface Bucket {
  count: number;
  latestAt: number;
}

/**
 * Builds the grid from photos that already passed every filter, aging each
 * cell against `asOf` — the timeline's right edge when the viewer has brushed
 * one, otherwise now.
 */
export function buildCoverageGrid(
  photos: PlacedPhoto[],
  asOf: number,
  /**
   * Photos defining the grid's footprint, when that differs from the photos
   * being counted. Passing the unfiltered set keeps the tiles fixed as filters
   * change: narrowing to one week should open holes in the grid, not shrink it
   * around the week's photos and quietly drop the rest of the site.
   */
  extentPhotos: PlacedPhoto[] = photos,
): CoverageGrid | null {
  const located = photos.filter(hasLocation);
  const extent = extentPhotos.filter(hasLocation);
  if (extent.length === 0) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const photo of extent) {
    if (photo.latitude < minLat) minLat = photo.latitude;
    if (photo.latitude > maxLat) maxLat = photo.latitude;
    if (photo.longitude < minLng) minLng = photo.longitude;
    if (photo.longitude > maxLng) maxLng = photo.longitude;
  }

  // Local flat-earth scaling: good to a fraction of a percent over any single
  // project, and it keeps cells square on the ground rather than in degrees.
  const midLat = (minLat + maxLat) / 2;
  const cosLat = Math.max(Math.cos((midLat * Math.PI) / 180), 0.01);

  let cellMeters = COVERAGE_CELL_METERS;
  let latStep = 0;
  let lngStep = 0;
  let firstRow = 0;
  let firstCol = 0;
  let rows = 0;
  let cols = 0;
  // The grid is anchored to (0, 0) rather than to the extent, so cells keep
  // their footprint as filters change the photos inside them.
  for (;;) {
    latStep = cellMeters / METERS_PER_DEGREE_LAT;
    lngStep = cellMeters / (METERS_PER_DEGREE_LAT * cosLat);
    firstRow = Math.floor(minLat / latStep);
    firstCol = Math.floor(minLng / lngStep);
    rows = Math.floor(maxLat / latStep) - firstRow + 1;
    cols = Math.floor(maxLng / lngStep) - firstCol + 1;
    if (rows * cols <= MAX_COVERAGE_CELLS) break;
    cellMeters *= 2;
  }

  const buckets = new Map<number, Bucket>();
  for (const photo of located) {
    const row = Math.floor(photo.latitude / latStep) - firstRow;
    const col = Math.floor(photo.longitude / lngStep) - firstCol;
    const key = row * cols + col;
    const capturedAt = photoCapturedAt(photo) ?? 0;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      if (capturedAt > bucket.latestAt) bucket.latestAt = capturedAt;
    } else {
      buckets.set(key, { count: 1, latestAt: capturedAt });
    }
  }

  const features: FeatureCollection<Polygon, CoverageCellProperties>["features"] =
    [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const bucket = buckets.get(row * cols + col);
      const south = (firstRow + row) * latStep;
      const west = (firstCol + col) * lngStep;
      const north = south + latStep;
      const east = west + lngStep;
      features.push({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
        properties: {
          count: bucket?.count ?? 0,
          latestAt: bucket?.latestAt ?? 0,
          ageDays: bucket
            ? Math.max(0, Math.floor((asOf - bucket.latestAt) / DAY_MS))
            : -1,
        },
      });
    }
  }

  return {
    cells: { type: "FeatureCollection", features },
    cellMeters,
    coveredCells: buckets.size,
    totalCells: features.length,
    asOf,
  };
}
