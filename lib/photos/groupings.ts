import type { ExpressionSpecification } from "maplibre-gl";

import { CATEGORY_META } from "./categories";
import { endOfDay, fromDayKey, startOfDay } from "./dates";
import type { ProjectContext } from "./project-context";
import { photoCapturedAt, type PlacedPhoto } from "./types";

/**
 * The ways the Groups map mode can color points. Origin is always there;
 * phase and company appear only when the project context can answer them, so
 * the legend never offers a lens that would paint every pin the same gray.
 */
export const GROUP_DIMENSIONS = ["origin", "phase", "company"] as const;

export type GroupDimension = (typeof GROUP_DIMENSIONS)[number];

export const GROUP_DIMENSION_META: Record<
  GroupDimension,
  { label: string; title: string }
> = {
  origin: { label: "Origin", title: "Photo origin" },
  phase: { label: "Phase", title: "Project phase" },
  company: { label: "Company", title: "Company" },
};

export function isGroupDimension(
  value: string | null,
): value is GroupDimension {
  return (
    value !== null && (GROUP_DIMENSIONS as readonly string[]).includes(value)
  );
}

type ThemedColor = { light: string; dark: string };

const NEUTRAL: ThemedColor = CATEGORY_META.other.color;

export function themedCssColor(color: ThemedColor): string {
  return `light-dark(${color.light}, ${color.dark})`;
}

// --- Phase ---

export const PHOTO_PHASES = ["before", "during", "after", "undated"] as const;

export type PhotoPhase = (typeof PHOTO_PHASES)[number];

/**
 * Before / during / after read as a progression, so they take three hues from
 * the shared categorical palette that sit far apart for color-vision
 * deficiency; undated photos fall back to the neutral every legend uses.
 */
export const PHASE_META: Record<PhotoPhase, { label: string; color: ThemedColor }> =
  {
    before: { label: "Before start", color: CATEGORY_META["field-report"].color },
    during: { label: "During project", color: CATEGORY_META.gallery.color },
    after: { label: "After end", color: CATEGORY_META.form.color },
    undated: { label: "No capture date", color: NEUTRAL },
  };

/** Inclusive project window in epoch ms; either side may be open. */
export interface ProjectWindow {
  start: number | null;
  end: number | null;
}

function dayKey(value: string | null): number | null {
  // ACC returns plain dates, but tolerate a full timestamp by keeping the day.
  return value ? fromDayKey(value.slice(0, 10)) : null;
}

export function projectWindow(context: ProjectContext): ProjectWindow | null {
  const start = dayKey(context.startDate);
  const end = dayKey(context.endDate);
  if (start === null && end === null) return null;
  return {
    start: start === null ? null : startOfDay(start),
    end: end === null ? null : endOfDay(end),
  };
}

export function phaseOf(photo: PlacedPhoto, window: ProjectWindow): PhotoPhase {
  const at = photoCapturedAt(photo);
  if (at === null) return "undated";
  if (window.start !== null && at < window.start) return "before";
  if (window.end !== null && at > window.end) return "after";
  return "during";
}

// --- Company ---

/** Photos whose uploader isn't a known project member. */
export const UNKNOWN_COMPANY = "__unknown";
/** Members on the project without a company assigned. */
export const NO_COMPANY = "__none";
/** Every company past the colored few, folded into one row. */
export const OTHER_COMPANIES = "__other";

/**
 * Distinct company colors before the rest fold into "Other". Seven is what the
 * palette can keep apart; more slices would just be shades nobody can match
 * to a swatch.
 */
const COMPANY_PALETTE: ThemedColor[] = [
  CATEGORY_META["field-report"].color,
  CATEGORY_META.rfi.color,
  CATEGORY_META.form.color,
  CATEGORY_META.gallery.color,
  CATEGORY_META.meeting.color,
  CATEGORY_META.submittal.color,
  CATEGORY_META.issue.color,
];

export interface GroupEntry {
  key: string;
  label: string;
  color: ThemedColor;
}

/** The raw company key for a photo, before folding into "Other". */
export function rawCompanyOf(
  photo: PlacedPhoto,
  members: Record<string, { companyId: string | null }>,
): string {
  const member = photo.createdBy ? members[photo.createdBy] : undefined;
  if (!member) return UNKNOWN_COMPANY;
  return member.companyId ?? NO_COMPANY;
}

/**
 * The company rows for a project: the busiest companies get palette colors,
 * the long tail becomes one "Other companies" row. Ranked by located-photo
 * count so the colors go to whoever is actually on the map.
 */
export function companyEntries(
  photos: PlacedPhoto[],
  members: Record<string, { companyId: string | null; companyName: string | null }>,
): { entries: GroupEntry[]; keyOf: (photo: PlacedPhoto) => string } {
  const names = new Map<string, string>();
  for (const member of Object.values(members)) {
    if (member.companyId && member.companyName) {
      names.set(member.companyId, member.companyName);
    }
  }

  const counts = new Map<string, number>();
  for (const photo of photos) {
    const key = rawCompanyOf(photo, members);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const named = [...counts.keys()]
    .filter((key) => key !== UNKNOWN_COMPANY && key !== NO_COMPANY)
    .sort(
      (a, b) =>
        (counts.get(b) ?? 0) - (counts.get(a) ?? 0) ||
        (names.get(a) ?? a).localeCompare(names.get(b) ?? b),
    );
  // Leave a palette slot unused rather than fold a single extra company into
  // an "Other" row of one.
  const colored =
    named.length <= COMPANY_PALETTE.length
      ? named
      : named.slice(0, COMPANY_PALETTE.length - 1);
  const coloredSet = new Set(colored);

  const entries: GroupEntry[] = colored.map((key, index) => ({
    key,
    label: names.get(key) ?? "Unnamed company",
    color: COMPANY_PALETTE[index],
  }));
  if (named.length > colored.length) {
    entries.push({ key: OTHER_COMPANIES, label: "Other companies", color: NEUTRAL });
  }
  if (counts.has(NO_COMPANY)) {
    entries.push({ key: NO_COMPANY, label: "No company", color: NEUTRAL });
  }
  if (counts.has(UNKNOWN_COMPANY)) {
    entries.push({ key: UNKNOWN_COMPANY, label: "Unknown uploader", color: NEUTRAL });
  }

  const keyOf = (photo: PlacedPhoto) => {
    const key = rawCompanyOf(photo, members);
    if (key === UNKNOWN_COMPANY || key === NO_COMPANY) return key;
    return coloredSet.has(key) ? key : OTHER_COMPANIES;
  };
  return { entries, keyOf };
}

// --- Map expression ---

/**
 * `["match", ["get", property], key1, color1, …, fallback]` — the shape every
 * grouped coloring shares. MapLibre rejects a match with no cases, so an empty
 * entry list collapses to the fallback color alone.
 */
export function groupColorExpression(
  property: string,
  entries: readonly GroupEntry[],
  theme: "light" | "dark",
): ExpressionSpecification | string {
  if (entries.length === 0) return NEUTRAL[theme];
  const expression: unknown[] = ["match", ["get", property]];
  for (const entry of entries) expression.push(entry.key, entry.color[theme]);
  expression.push(NEUTRAL[theme]);
  return expression as unknown as ExpressionSpecification;
}
