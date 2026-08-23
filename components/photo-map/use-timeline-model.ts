"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { addDays, endOfDay } from "@/lib/photos/dates";
import {
  buildBars,
  buildHistogram,
  countInRange,
  toIndex,
  type Bar,
  type Histogram,
} from "@/lib/photos/timeline-data";
import type { PlacedPhoto } from "@/lib/photos/types";

/** Playback tick interval, and the wall-clock length of a whole sweep. */
const PLAY_INTERVAL_MS = 110;
const PLAY_SWEEP_MS = 9_000;

export const dayFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
export const dayYearFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export interface TimelineProps {
  /**
   * The photos the histogram is built from — everything the other facets let
   * through, but *not* the date facet, so the bars stay put while brushing.
   */
  photos: PlacedPhoto[];
  start: number | null;
  end: number | null;
  onChange: (start: number | null, end: number | null) => void;
}

export interface TimelineModel {
  histogram: Histogram;
  bars: Bar[];
  barMax: number;
  dayCount: number;
  /** Selected range as day indices — always concrete, even when the range is open-ended. */
  startIndex: number;
  endIndex: number;
  /** Publishes a range by day index, folding full-width selections back to `null`. */
  emit: (startIndex: number, endIndex: number) => void;
  playing: boolean;
  togglePlay: () => void;
  stopPlaying: () => void;
  clear: () => void;
  /** True when a date filter is actually applied. */
  brushed: boolean;
  selectedCount: number;
  dayAt: (index: number) => number;
  /** The header's "Mar 2, 2026 – Aug 21, 2026". */
  rangeLabel: string;
}

/**
 * Everything the date facet means, independent of how it's drawn: the binned
 * histogram, the brushed range in day indices, playback, and the write-back
 * rules. Each variant renders this and calls `emit`; none of them owns range
 * semantics, so switching variants can't change what gets filtered.
 *
 * Returns null when there is nothing datable to draw.
 */
export function useTimelineModel({
  photos,
  start,
  end,
  onChange,
}: TimelineProps): TimelineModel | null {
  const histogram = useMemo(
    () => buildHistogram(photos, start, end),
    [photos, start, end],
  );
  const { bars, max: barMax } = useMemo(
    () => buildBars(histogram?.counts ?? []),
    [histogram],
  );
  // Counted from the range rather than from the drawn bars: the two agree
  // everywhere the axis covers the range, and where it can't, this is the
  // number the map is actually showing.
  const selectedCount = useMemo(
    () => countInRange(photos, start, end),
    [photos, start, end],
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

  const stopPlaying = useCallback(() => setPlaying(false), []);

  const togglePlay = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (!histogram) return;
    // Restart from a one-day window when the sweep has nowhere left to go.
    if (endIndex >= dayCount - 1) emit(startIndex, startIndex);
    setPlaying(true);
  }, [playing, histogram, endIndex, dayCount, startIndex, emit]);

  const clear = useCallback(() => {
    setPlaying(false);
    onChange(null, null);
  }, [onChange]);

  const dayAt = useCallback(
    (index: number) => (histogram ? addDays(histogram.firstDay, index) : 0),
    [histogram],
  );

  if (!histogram) return null;

  return {
    histogram,
    bars,
    barMax,
    dayCount,
    startIndex,
    endIndex,
    emit,
    playing,
    togglePlay,
    stopPlaying,
    clear,
    brushed: start !== null || end !== null,
    selectedCount,
    dayAt,
    rangeLabel: `${dayYearFormat.format(start ?? dayAt(0))} – ${dayYearFormat.format(
      end ?? dayAt(dayCount - 1),
    )}`,
  };
}
