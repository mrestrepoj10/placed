"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { CATEGORY_META, categoryCssColor } from "@/lib/photos/categories";
import type { CoverageGrid } from "@/lib/photos/coverage";
import type { MapMode } from "@/lib/photos/map-modes";
import {
  NO_COVERAGE,
  noCoverageCssColor,
  RECENCY_BANDS,
  recencyCssColor,
} from "@/lib/photos/recency";
import { PHOTO_CATEGORIES, type PhotoCategory } from "@/lib/photos/types";
import { cn } from "@/lib/utils";

interface LegendProps {
  mode: MapMode;
  /** Located-photo count per category; categories at zero are hidden */
  counts: Record<PhotoCategory, number>;
  active: ReadonlySet<PhotoCategory>;
  onToggle: (category: PhotoCategory) => void;
  /** The grid on screen, in coverage mode */
  coverage: CoverageGrid | null;
  /** The instant ages are measured from; null before the clock is read */
  asOf: number | null;
  /** True when the timeline brush set `asOf`, false when it's simply now */
  asOfFromBrush: boolean;
  className?: string;
}

const asOfFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function Panel({
  title,
  caption,
  children,
  className,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-auto w-48 rounded-lg border bg-background/90 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      <p className="px-3 pt-2.5 pb-1 font-heading text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      {children}
      {caption && (
        <p className="px-3 pt-0.5 pb-2 text-[11px] leading-snug text-muted-foreground">
          {caption}
        </p>
      )}
    </div>
  );
}

function Swatch({ color, hollow }: { color: string; hollow?: boolean }) {
  return (
    <span
      aria-hidden
      className="size-2.5 shrink-0 rounded-full ring-2 ring-background"
      style={
        hollow
          ? { border: `1.5px solid ${color}` }
          : { backgroundColor: color }
      }
    />
  );
}

/**
 * The key to whatever the map is currently saying. It changes with the mode —
 * origin colors and their filters, or the recency ramp both time-based modes
 * share — because a legend for a scale you aren't looking at is just clutter.
 */
export function Legend({
  mode,
  counts,
  active,
  onToggle,
  coverage,
  asOf,
  asOfFromBrush,
  className,
}: LegendProps) {
  if (mode === "categories") {
    const visible = PHOTO_CATEGORIES.filter((category) => counts[category] > 0);
    if (visible.length === 0) return null;

    return (
      <Panel title="Photo origin" className={className}>
        <ul className="pb-1.5">
          {visible.map((category) => (
            <li key={category}>
              <label className="flex cursor-pointer items-center gap-2 px-3 py-1 text-sm hover:bg-accent/50">
                <Checkbox
                  checked={active.has(category)}
                  onCheckedChange={() => onToggle(category)}
                  className="size-3.5"
                />
                <Swatch color={categoryCssColor(category)} />
                <span className="flex-1 truncate">
                  {CATEGORY_META[category].label}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {counts[category]}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Panel>
    );
  }

  const hiddenCategories = PHOTO_CATEGORIES.filter(
    (category) => counts[category] > 0 && !active.has(category),
  ).length;
  const asOfLabel = `as of ${
    asOfFromBrush && asOf !== null ? asOfFormat.format(asOf) : "today"
  }`;
  const caption =
    mode === "coverage" && coverage
      ? `${Math.round(coverage.cellMeters)} m cells · ${coverage.coveredCells.toLocaleString("en-US")} of ${coverage.totalCells.toLocaleString("en-US")} covered · ${asOfLabel}`
      : `Time since capture, ${asOfLabel}`;

  return (
    <Panel
      title={mode === "coverage" ? "Coverage age" : "Photo age"}
      caption={
        hiddenCategories > 0
          ? `${caption}. ${hiddenCategories} origin${hiddenCategories === 1 ? "" : "s"} still filtered out.`
          : caption
      }
      className={className}
    >
      <ul className="pb-1">
        {RECENCY_BANDS.map((band) => (
          <li
            key={band.id}
            className="flex items-center gap-2 px-3 py-1 text-sm"
          >
            <Swatch color={recencyCssColor(band)} />
            <span className="flex-1 truncate">{band.label}</span>
          </li>
        ))}
        {mode === "coverage" && (
          <li className="flex items-center gap-2 px-3 py-1 text-sm">
            <Swatch color={noCoverageCssColor()} hollow />
            <span className="flex-1 truncate">{NO_COVERAGE.label}</span>
          </li>
        )}
      </ul>
    </Panel>
  );
}
