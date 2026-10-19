import type { ExpressionSpecification } from "maplibre-gl";

import { DAY_MS } from "./dates";

/**
 * The recency scale, in one place because three surfaces have to agree on it:
 * the Activity point colors, the Coverage grid fill, and the legend that names
 * the bands. Every view reads the active `RecencyScale` from here.
 *
 * Bands are open-ended upward — `maxDays` is the exclusive top of each band,
 * and the last one catches everything older. The palette runs green → amber →
 * red because staleness is the thing worth spotting: on a live project, a
 * fully red map means nobody has been out there in a week.
 */
export interface RecencyBand {
  id: string;
  label: string;
  /** Exclusive upper bound in days; Infinity on the last band */
  maxDays: number;
  color: { light: string; dark: string };
}

const FRESH = { light: "#0e7c5a", dark: "#20b083" };
const RECENT = { light: "#c07a05", dark: "#e0a233" };
const STALE = { light: "#b3332f", dark: "#e06058" };

export interface RecencyScale {
  id: string;
  bands: readonly RecencyBand[];
}

function scale(
  id: string,
  [freshDays, freshLabel]: [number, string],
  [recentDays, recentLabel]: [number, string],
): RecencyScale {
  return {
    id,
    bands: [
      { id: "fresh", label: `Under ${freshLabel}`, maxDays: freshDays, color: FRESH },
      {
        id: "recent",
        label: `${freshLabel}–${recentLabel}`,
        maxDays: recentDays,
        color: RECENT,
      },
      { id: "stale", label: `Over ${recentLabel}`, maxDays: Infinity, color: STALE },
    ],
  };
}

/**
 * From the field-ops week up to multi-year archives, smallest first. The
 * first is the live scale; the rest exist for projects whose photos are all
 * history, where "over 7 days" would paint every pin the same red.
 */
export const RECENCY_SCALES: readonly RecencyScale[] = [
  {
    id: "days",
    bands: [
      { id: "fresh", label: "Under 3 days", maxDays: 3, color: FRESH },
      { id: "recent", label: "3–7 days", maxDays: 7, color: RECENT },
      { id: "stale", label: "Over 7 days", maxDays: Infinity, color: STALE },
    ],
  },
  scale("weeks", [7, "1 week"], [30, "1 month"]),
  scale("months", [30, "1 month"], [91, "3 months"]),
  scale("quarters", [91, "3 months"], [365, "1 year"]),
  scale("years", [365, "1 year"], [1095, "3 years"]),
];

export const LIVE_RECENCY_SCALE = RECENCY_SCALES[0];

export interface RecencyFrame {
  scale: RecencyScale;
  /**
   * What ages are measured from when the timeline brush doesn't say: now on
   * a live project, the newest photo on an archive one.
   */
  defaultAsOf: number;
  /** True when `defaultAsOf` is the newest photo rather than now */
  fromLatestPhoto: boolean;
}

/**
 * Picks how recency reads for a photo set. A project photographed within the
 * live window keeps the field scale measured from now. Anything older is an
 * archive: ages count back from its newest photo, on the scale whose "stale"
 * threshold sits nearest half the capture span — so the colors divide the
 * project's own history instead of all landing in "Over 7 days".
 *
 * Reads the whole located set, not the filtered one, so brushing or playing
 * the timeline never swaps the scale (and the legend's labels) mid-motion.
 */
export function recencyFrame(
  capturedAt: Iterable<number>,
  now: number,
): RecencyFrame {
  let oldest = Infinity;
  let newest = -Infinity;
  for (const at of capturedAt) {
    if (at < oldest) oldest = at;
    if (at > newest) newest = at;
  }
  const live = LIVE_RECENCY_SCALE;
  const liveWindowDays = live.bands[live.bands.length - 2].maxDays;
  if (!Number.isFinite(newest) || (now - newest) / DAY_MS <= liveWindowDays) {
    return { scale: live, defaultAsOf: now, fromLatestPhoto: false };
  }

  // Aim the "stale" threshold at half the span, so the oldest half of the
  // history reads red and the rest splits between amber and green. Compared
  // on a log scale, since the ladder grows roughly geometrically.
  const target = Math.max((newest - oldest) / DAY_MS / 2, 1);
  let chosen = RECENCY_SCALES[1];
  let best = Infinity;
  for (const candidate of RECENCY_SCALES.slice(1)) {
    const staleAfter = candidate.bands[candidate.bands.length - 2].maxDays;
    const distance = Math.abs(Math.log(staleAfter / target));
    if (distance < best) {
      best = distance;
      chosen = candidate;
    }
  }
  return { scale: chosen, defaultAsOf: newest, fromLatestPhoto: true };
}

/** Coverage cells with no photo at all — drawn hollow, outline only. */
export const NO_COVERAGE = {
  id: "never",
  label: "No photos",
  color: { light: "#8a8781", dark: "#77746e" },
} as const;

export type Theme = "light" | "dark";

export function recencyColor(band: RecencyBand, theme: Theme): string {
  return band.color[theme];
}

/**
 * CSS color that follows the active theme, for DOM swatches in the legend —
 * mirrors `categoryCssColor`.
 */
export function recencyCssColor(band: RecencyBand): string {
  return `light-dark(${band.color.light}, ${band.color.dark})`;
}

export function noCoverageCssColor(): string {
  return `light-dark(${NO_COVERAGE.color.light}, ${NO_COVERAGE.color.dark})`;
}

/** The band a given age falls in, for labelling. */
export function bandForAge(
  ageDays: number,
  bands: readonly RecencyBand[] = LIVE_RECENCY_SCALE.bands,
): RecencyBand {
  return (
    bands.find((band) => ageDays < band.maxDays) ?? bands[bands.length - 1]
  );
}

/**
 * `["step", <input>, band0, cut0, band1, cut1, band2]` over an age-in-days
 * input. Shared by the point layer (which computes age from `capturedAt`) and
 * the coverage grid (which carries a precomputed `ageDays`).
 */
function stepOverBands(
  input: ExpressionSpecification,
  theme: Theme,
  bands: readonly RecencyBand[],
): ExpressionSpecification {
  const expression: unknown[] = ["step", input, recencyColor(bands[0], theme)];
  for (let index = 1; index < bands.length; index += 1) {
    expression.push(bands[index - 1].maxDays, recencyColor(bands[index], theme));
  }
  return expression as unknown as ExpressionSpecification;
}

/**
 * Colors a photo point by its age at `asOf`. Photos whose source dates were
 * unparseable carry no `capturedAt` (see `PhotoFeatureProperties`) and fall
 * into the oldest band rather than breaking the arithmetic.
 */
export function recencyColorExpression(
  theme: Theme,
  asOf: number,
  bands: readonly RecencyBand[] = LIVE_RECENCY_SCALE.bands,
): ExpressionSpecification {
  const ageDays: ExpressionSpecification = [
    "/",
    ["-", asOf, ["get", "capturedAt"]],
    DAY_MS,
  ];
  return [
    "case",
    ["has", "capturedAt"],
    stepOverBands(ageDays, theme, bands),
    recencyColor(bands[bands.length - 1], theme),
  ] as unknown as ExpressionSpecification;
}

/** Colors a coverage cell by the `ageDays` property the grid precomputes. */
export function coverageColorExpression(
  theme: Theme,
  bands: readonly RecencyBand[] = LIVE_RECENCY_SCALE.bands,
): ExpressionSpecification {
  return stepOverBands(["get", "ageDays"], theme, bands);
}
