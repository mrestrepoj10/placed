/**
 * Local-calendar day arithmetic. The timeline bins by the day a photo was
 * taken *where it was taken* — near enough, the viewer's day — so every helper
 * here goes through `Date` rather than dividing epoch milliseconds, which
 * would drift by an hour across a daylight-saving boundary.
 */

export const DAY_MS = 86_400_000;

export function startOfDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function endOfDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export function addDays(ms: number, days: number): number {
  const date = new Date(ms);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

/** Whole days from one local midnight to another; negative when `to` is earlier. */
export function daysBetween(fromDayStart: number, toDayStart: number): number {
  return Math.round((toDayStart - fromDayStart) / DAY_MS);
}

/** `YYYY-MM-DD` in local time — the URL's date format. */
export function toDayKey(ms: number): string {
  const date = new Date(ms);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Parses `YYYY-MM-DD` to local midnight; null when it isn't a real date. */
export function fromDayKey(key: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date.getTime();
}
