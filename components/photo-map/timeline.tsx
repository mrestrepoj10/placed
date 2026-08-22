"use client";

import { Pause, Play, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { Button } from "@/components/ui/button";
import {
  addDays,
  daysBetween,
  endOfDay,
  startOfDay,
} from "@/lib/photos/dates";
import { photoCapturedAt, type PlacedPhoto } from "@/lib/photos/types";

/** Playback tick interval, and the wall-clock length of a whole sweep. */
const PLAY_INTERVAL_MS = 110;
const PLAY_SWEEP_MS = 9_000;
/**
 * Most columns the histogram draws. A day per column is the intent; a project
 * (or a stray bad date) spanning years gets its days pooled into columns
 * instead of drawing thousands of sub-pixel bars, which read as missing data.
 */
const MAX_BARS = 400;

const dayFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const dayYearFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

interface TimelineProps {
  /**
   * The photos the histogram is built from — everything the other facets let
   * through, but *not* the date facet, so the bars stay put while brushing.
   */
  photos: PlacedPhoto[];
  start: number | null;
  end: number | null;
  onChange: (start: number | null, end: number | null) => void;
}

interface Histogram {
  /** Local midnight of the first day with a photo */
  firstDay: number;
  /** Photos per day, indexed from `firstDay` */
  counts: number[];
}

/** One drawn column: a run of days, and the photos inside it. */
interface Bar {
  /** First day index the column covers */
  index: number;
  /** How many days it pools */
  span: number;
  count: number;
}

function buildBars(counts: number[]): { bars: Bar[]; max: number } {
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

function buildHistogram(photos: PlacedPhoto[]): Histogram | null {
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

  const firstDay = startOfDay(min);
  const dayCount = daysBetween(firstDay, startOfDay(max)) + 1;
  const counts = new Array<number>(dayCount).fill(0);
  for (const stamp of stamps) {
    const index = daysBetween(firstDay, startOfDay(stamp));
    if (index >= 0 && index < dayCount) counts[index] += 1;
  }
  return { firstDay, counts };
}

/** The day index a timestamp falls on, clamped into the histogram. */
function toIndex(histogram: Histogram, ms: number): number {
  const index = daysBetween(histogram.firstDay, startOfDay(ms));
  return Math.min(Math.max(index, 0), histogram.counts.length - 1);
}

type DragTarget = "start" | "end" | "window";

/**
 * The date facet, drawn on the axis it filters: a photos-per-day histogram with
 * a two-handle brush over it. Dragging either handle sets the range; the play
 * button sweeps the right handle forward so the map fills in the way the
 * project did. A full-width selection means "no date filter" and is written
 * back as `null`, keeping default share links clean.
 */
export function Timeline({ photos, start, end, onChange }: TimelineProps) {
  const histogram = useMemo(() => buildHistogram(photos), [photos]);
  const { bars, max: barMax } = useMemo(
    () => buildBars(histogram?.counts ?? []),
    [histogram],
  );
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ target: DragTarget; grabOffset: number } | null>(
    null,
  );
  const [playing, setPlaying] = useState(false);

  const dayCount = histogram?.counts.length ?? 0;
  const startIndex =
    histogram && start !== null ? toIndex(histogram, start) : 0;
  const endIndex =
    histogram && end !== null ? toIndex(histogram, end) : dayCount - 1;

  const emit = useCallback(
    (nextStart: number, nextEnd: number) => {
      if (!histogram) return;
      // A handle still parked on an end of the data means "open-ended", not
      // "pinned to the earliest day loaded so far" — photos are still
      // streaming in, and later pages can carry earlier dates.
      onChange(
        nextStart <= 0 ? null : addDays(histogram.firstDay, nextStart),
        nextEnd >= dayCount - 1
          ? null
          : endOfDay(addDays(histogram.firstDay, nextEnd)),
      );
    },
    [histogram, dayCount, onChange],
  );

  // Playback sweeps the right handle from the left edge of the window to the
  // right edge of the data, then stops.
  useEffect(() => {
    if (!playing || !histogram) return;
    const step = Math.max(
      1,
      Math.round(dayCount / (PLAY_SWEEP_MS / PLAY_INTERVAL_MS)),
    );
    const timer = setInterval(() => {
      const next = endIndex + step;
      if (next >= dayCount - 1) {
        setPlaying(false);
        emit(startIndex, dayCount - 1);
        return;
      }
      emit(startIndex, next);
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playing, histogram, dayCount, startIndex, endIndex, emit]);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (!histogram) return;
    // Restart from a one-day window when the sweep has nowhere left to go.
    if (endIndex >= dayCount - 1) emit(startIndex, startIndex);
    setPlaying(true);
  };

  const indexFromPointer = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track || dayCount === 0) return 0;
      const rect = track.getBoundingClientRect();
      const fraction = (clientX - rect.left) / rect.width;
      const index = Math.floor(fraction * dayCount);
      return Math.min(Math.max(index, 0), dayCount - 1);
    },
    [dayCount],
  );

  const handlePointerDown = (
    target: DragTarget,
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPlaying(false);
    dragRef.current = {
      target,
      grabOffset: indexFromPointer(event.clientX) - startIndex,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const index = indexFromPointer(event.clientX);
    if (drag.target === "start") {
      emit(Math.min(index, endIndex), endIndex);
    } else if (drag.target === "end") {
      emit(startIndex, Math.max(index, startIndex));
    } else {
      // Slide the whole window, preserving its width against both edges.
      const width = endIndex - startIndex;
      const nextStart = Math.min(
        Math.max(index - drag.grabOffset, 0),
        dayCount - 1 - width,
      );
      emit(nextStart, nextStart + width);
    }
  };

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (
    target: "start" | "end",
    event: ReactKeyboardEvent,
  ) => {
    const delta =
      event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    event.stopPropagation();
    setPlaying(false);
    if (target === "start") {
      emit(Math.min(Math.max(startIndex + delta, 0), endIndex), endIndex);
    } else {
      emit(
        startIndex,
        Math.max(Math.min(endIndex + delta, dayCount - 1), startIndex),
      );
    }
  };

  if (!histogram) return null;

  const dayAt = (index: number) => addDays(histogram.firstDay, index);
  const leftPercent = (startIndex / dayCount) * 100;
  const rightPercent = ((endIndex + 1) / dayCount) * 100;
  const brushed = start !== null || end !== null;
  const selectedCount = histogram.counts
    .slice(startIndex, endIndex + 1)
    .reduce((total, count) => total + count, 0);
  // Sub-pixel gaps look like missing data; only separate columns when there is
  // room for a gap to read as one.
  const gap = bars.length > 90 ? 0 : 0.18;

  return (
    <div
      data-timeline
      className="pointer-events-auto rounded-lg border bg-background/90 px-3 pt-1.5 pb-2 shadow-sm backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 pb-1 text-[11px] text-muted-foreground">
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={togglePlay}
          aria-label={playing ? "Pause playback" : "Play through time"}
          className="rounded-md"
        >
          {playing ? (
            <Pause className="size-3 fill-current" />
          ) : (
            <Play className="size-3 fill-current" />
          )}
        </Button>
        <span className="font-medium text-foreground tabular-nums">
          {dayYearFormat.format(dayAt(startIndex))} –{" "}
          {dayYearFormat.format(dayAt(endIndex))}
        </span>
        <span className="tabular-nums">
          {selectedCount.toLocaleString("en-US")} photo
          {selectedCount === 1 ? "" : "s"}
        </span>
        {brushed && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              setPlaying(false);
              onChange(null, null);
            }}
            className="ml-auto rounded-md text-muted-foreground"
          >
            <X className="size-3" aria-hidden />
            All dates
          </Button>
        )}
      </div>

      <div
        ref={trackRef}
        className="relative h-12 touch-none select-none"
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${dayCount} 100`}
          preserveAspectRatio="none"
          aria-hidden
        >
          {bars.map((bar) => {
            const height = bar.count === 0 ? 0 : (bar.count / barMax) * 100;
            const inRange =
              bar.index + bar.span - 1 >= startIndex && bar.index <= endIndex;
            return (
              <rect
                key={bar.index}
                x={bar.index + (gap * bar.span) / 2}
                y={100 - height}
                width={bar.span * (1 - gap)}
                height={height}
                className={
                  inRange ? "fill-foreground/70" : "fill-muted-foreground/25"
                }
              />
            );
          })}
        </svg>

        {/* Out-of-range shading, then the draggable window on top */}
        <div
          className="absolute inset-y-0 left-0 bg-background/55"
          style={{ width: `${leftPercent}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-background/55"
          style={{ width: `${100 - rightPercent}%` }}
        />
        <div
          className="absolute inset-y-0 cursor-grab border-x border-primary/40 active:cursor-grabbing"
          style={{
            left: `${leftPercent}%`,
            width: `${rightPercent - leftPercent}%`,
          }}
          onPointerDown={(event) => handlePointerDown("window", event)}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />

        {(
          [
            ["start", leftPercent, startIndex],
            ["end", rightPercent, endIndex],
          ] as const
        ).map(([target, percent, index]) => (
          <div
            key={target}
            role="slider"
            tabIndex={0}
            aria-label={target === "start" ? "Range start" : "Range end"}
            aria-valuemin={0}
            aria-valuemax={dayCount - 1}
            aria-valuenow={index}
            aria-valuetext={dayFormat.format(dayAt(index))}
            className="absolute inset-y-0 z-10 w-3 -translate-x-1/2 cursor-ew-resize touch-none rounded-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            style={{ left: `${percent}%` }}
            onPointerDown={(event) => handlePointerDown(target, event)}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={(event) => handleKeyDown(target, event)}
          >
            <span
              aria-hidden
              className="absolute inset-y-1 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-primary"
            />
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-0.5 text-[10px] text-muted-foreground tabular-nums">
        <span>{dayFormat.format(dayAt(0))}</span>
        <span>{dayYearFormat.format(dayAt(dayCount - 1))}</span>
      </div>
    </div>
  );
}
