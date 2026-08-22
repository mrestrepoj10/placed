import type { ExpressionSpecification } from "maplibre-gl";

import { DAY_MS } from "./dates";

/**
 * The recency scale, in one place because three surfaces have to agree on it:
 * the Activity point colors, the Coverage grid fill, and the legend that names
 * the bands. Change the thresholds here and every view follows.
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

export const RECENCY_BANDS: readonly RecencyBand[] = [
  {
    id: "fresh",
    label: "Under 3 days",
    maxDays: 3,
    color: { light: "#0e7c5a", dark: "#20b083" },
  },
  {
    id: "recent",
    label: "3–7 days",
    maxDays: 7,
    color: { light: "#c07a05", dark: "#e0a233" },
  },
  {
    id: "stale",
    label: "Over 7 days",
    maxDays: Infinity,
    color: { light: "#b3332f", dark: "#e06058" },
  },
];

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
export function bandForAge(ageDays: number): RecencyBand {
  return (
    RECENCY_BANDS.find((band) => ageDays < band.maxDays) ??
    RECENCY_BANDS[RECENCY_BANDS.length - 1]
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
): ExpressionSpecification {
  const expression: unknown[] = [
    "step",
    input,
    recencyColor(RECENCY_BANDS[0], theme),
  ];
  for (let index = 1; index < RECENCY_BANDS.length; index += 1) {
    expression.push(
      RECENCY_BANDS[index - 1].maxDays,
      recencyColor(RECENCY_BANDS[index], theme),
    );
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
): ExpressionSpecification {
  const ageDays: ExpressionSpecification = [
    "/",
    ["-", asOf, ["get", "capturedAt"]],
    DAY_MS,
  ];
  return [
    "case",
    ["has", "capturedAt"],
    stepOverBands(ageDays, theme),
    recencyColor(RECENCY_BANDS[RECENCY_BANDS.length - 1], theme),
  ] as unknown as ExpressionSpecification;
}

/** Colors a coverage cell by the `ageDays` property the grid precomputes. */
export function coverageColorExpression(theme: Theme): ExpressionSpecification {
  return stepOverBands(["get", "ageDays"], theme);
}
