import { daysBetween, startOfDay } from "./dates";
import { photoCapturedAt, type PlacedPhoto } from "./types";

/**
 * The timeline's data model, shared by every variant. Binning, pooling and the
 * index↔date mapping live here so the three renderings can only ever disagree
 * about pixels — never about which photos a brushed range selects.
 */

/**
 * Most columns the histogram draws. A day per column is the intent; a project
 * (or a stray bad date) spanning years gets its days pooled into columns
 * instead of drawing thousands of sub-pixel bars, which read as missing data.
 */
export const MAX_BARS = 400;
/**
 * Ceiling on the axis when an active range reaches outside the photos. Brushing
 * can only ever select inside the data, so this only bites on a hand-edited
 * URL; past it the axis falls back to the photos' own extent.
 */
const MAX_DOMAIN_DAYS = 20 * 366;

export interface Histogram {
  /** Local midnight of the first day with a photo */
  firstDay: number;
  /** Photos per day, indexed from `firstDay` */
  counts: number[];
}

/** One drawn column: a run of days, and the photos inside it. */
export interface Bar {
  /** First day index the column covers */
  index: number;
  /** How many days it pools */
  span: number;
  count: number;
}

export function buildBars(counts: number[]): { bars: Bar[]; max: number } {
  const span = Math.max(1, Math.ceil(counts.length / MAX_BARS));
  const bars: Bar[] = [];
  let max = 0;
  for (let index = 0; index < counts.length; index += span) {
    const width = Math.min(span, counts.length - index);
    let count = 0;
    for (let offset = 0; offset < width; offset += 1) {
      count += counts[index + offset];
    }
    if (count > max) max = count;
    bars.push({ index, span: width, count });
  }
  return { bars, max };
}

/**
 * Bins photos by local day. The axis spans the photos, widened to cover an
 * active range: without that, a range sitting outside the current photos would
 * clamp both handles onto the nearest day and the strip would describe a window
 * it isn't filtering by.
 */
export function buildHistogram(
  photos: PlacedPhoto[],
  start: number | null,
  end: number | null,
): Histogram | null {
  let min = Infinity;
  let max = -Infinity;
  const stamps: number[] = [];
  for (const photo of photos) {
    const capturedAt = photoCapturedAt(photo);
    if (capturedAt === null) continue;
    stamps.push(capturedAt);
    if (capturedAt < min) min = capturedAt;
    if (capturedAt > max) max = capturedAt;
  }
  if (stamps.length === 0) return null;

  const dataFirstDay = startOfDay(min);
  const dataLastDay = startOfDay(max);
  let firstDay =
    start === null ? dataFirstDay : Math.min(dataFirstDay, startOfDay(start));
  let lastDay =
    end === null ? dataLastDay : Math.max(dataLastDay, startOfDay(end));
  if (daysBetween(firstDay, lastDay) + 1 > MAX_DOMAIN_DAYS) {
    firstDay = dataFirstDay;
    lastDay = dataLastDay;
  }

  const dayCount = daysBetween(firstDay, lastDay) + 1;
  const counts = new Array<number>(dayCount).fill(0);
  for (const stamp of stamps) {
    const index = daysBetween(firstDay, startOfDay(stamp));
    if (index >= 0 && index < dayCount) counts[index] += 1;
  }
  return { firstDay, counts };
}

/** The day index a timestamp falls on, clamped into the histogram. */
export function toIndex(histogram: Histogram, ms: number): number {
  const index = daysBetween(histogram.firstDay, startOfDay(ms));
  return Math.min(Math.max(index, 0), histogram.counts.length - 1);
}

/** Photos inside the range — counted from the range, not from the drawn bars. */
export function countInRange(
  photos: PlacedPhoto[],
  start: number | null,
  end: number | null,
): number {
  let total = 0;
  for (const photo of photos) {
    const capturedAt = photoCapturedAt(photo);
    if (capturedAt === null) continue;
    if (start !== null && capturedAt < start) continue;
    if (end !== null && capturedAt > end) continue;
    total += 1;
  }
  return total;
}
