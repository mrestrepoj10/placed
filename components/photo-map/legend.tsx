"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { CoverageGrid } from "@/lib/photos/coverage";
import {
  GROUP_DIMENSION_META,
  type GroupDimension,
} from "@/lib/photos/groupings";
import type { MapMode } from "@/lib/photos/map-modes";
import {
  NO_COVERAGE,
  noCoverageCssColor,
  RECENCY_BANDS,
  recencyCssColor,
} from "@/lib/photos/recency";
import { cn } from "@/lib/utils";

/** One row of a grouped legend — an origin, a phase, or a company. */
export interface LegendEntry {
  key: string;
  label: string;
  /** Theme-following CSS color for the swatch */
  color: string;
  count: number;
  active: boolean;
}

interface LegendProps {
  mode: MapMode;
  /** The grouping on screen in Groups mode */
  dimension: GroupDimension;
  /** Groupings this project can answer, in arrow order; always has origin */
  dimensions: readonly GroupDimension[];
  onDimensionChange: (dimension: GroupDimension) => void;
  /** Rows for the current grouping; rows at zero are hidden */
  entries: readonly LegendEntry[];
  onToggle: (key: string) => void;
  /** Context line under the rows, e.g. the project dates phases are cut at */
  groupCaption?: string;
  /** Origins filtered out, mentioned in the other legends' captions */
  hiddenOrigins: number;
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
  actions,
  caption,
  children,
  className,
}: {
  title: string;
  /** Controls at the right of the title row */
  actions?: React.ReactNode;
  caption?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-auto w-56 rounded-lg border bg-background/90 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-center gap-1 pt-1.5 pr-1.5 pl-3">
        <p
          aria-live="polite"
          className="min-w-0 flex-1 truncate py-1 font-heading text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {title}
        </p>
        {actions}
      </div>
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
 * grouped colors and their filters, or the recency ramp both time-based modes
 * share — because a legend for a scale you aren't looking at is just clutter.
 * In Groups mode the arrows step through the groupings the project can
 * answer: origin always, phase and company when the project context allows.
 */
export function Legend({
  mode,
  dimension,
  dimensions,
  onDimensionChange,
  entries,
  onToggle,
  groupCaption,
  hiddenOrigins,
  coverage,
  asOf,
  asOfFromBrush,
  className,
}: LegendProps) {
  if (mode === "categories") {
    const visible = entries.filter((entry) => entry.count > 0);
    if (visible.length === 0 && dimensions.length < 2) return null;

    const index = Math.max(0, dimensions.indexOf(dimension));
    const step = (delta: number) =>
      onDimensionChange(
        dimensions[(index + delta + dimensions.length) % dimensions.length],
      );
    const previous =
      dimensions[(index - 1 + dimensions.length) % dimensions.length];
    const next = dimensions[(index + 1) % dimensions.length];

    return (
      <Panel
        title={GROUP_DIMENSION_META[dimension].title}
        caption={groupCaption}
        className={className}
        actions={
          dimensions.length > 1 && (
            <div className="flex shrink-0 items-center">
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Show ${GROUP_DIMENSION_META[previous].label.toLowerCase()} legend`}
                onClick={() => step(-1)}
                className="rounded-md text-muted-foreground"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="w-6 text-center text-[10px] tabular-nums text-muted-foreground">
                {index + 1}/{dimensions.length}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Show ${GROUP_DIMENSION_META[next].label.toLowerCase()} legend`}
                onClick={() => step(1)}
                className="rounded-md text-muted-foreground"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )
        }
      >
        <ul className="pb-1.5">
          {visible.map((entry) => (
            <li key={entry.key}>
              <label className="flex cursor-pointer items-center gap-2 px-3 py-1 text-sm hover:bg-accent/50">
                <Checkbox
                  checked={entry.active}
                  onCheckedChange={() => onToggle(entry.key)}
                  className="size-3.5"
                />
                <Swatch color={entry.color} />
                <span className="flex-1 truncate" title={entry.label}>
                  {entry.label}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {entry.count}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Panel>
    );
  }

  const hiddenCategories = hiddenOrigins;
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
