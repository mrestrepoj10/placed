"use client";

import * as echarts from "echarts/core";
import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { EChartsBarChart } from "@/components/evilcharts/charts/echarts-bar-chart";
import type { ChartConfig } from "@/components/evilcharts/ui/echarts-chart";

import { dayFormat, type TimelineModel } from "./use-timeline-model";

/**
 * The dataZoom handles are sized as a fraction of the brush strip, so a short
 * strip leaves a grab target only a few pixels wide. 42 keeps it usable without
 * making this variant taller than it already is.
 */
const BRUSH_HEIGHT = 42;

// Resolved through getComputedStyle on the chart container, so the `var()`
// indirection survives and one entry covers both themes.
const CHART_CONFIG: ChartConfig = {
  count: { label: "Photos", colors: { light: ["var(--foreground)"] } },
};

/**
 * EvilCharts' ECharts bar chart, brushed by its own `dataZoom` slider.
 *
 * The trade this variant makes: `dataZoom` *zooms* — the main plot redraws to
 * the selected range and the full histogram lives in the mini strip underneath,
 * where the original keeps one histogram and dims what's outside. It also owns
 * its brush position internally (there is no controlled range prop), so
 * playback, "All dates" and restored links are pushed back into it with
 * `dispatchAction`.
 */
export function TimelineECharts({ model }: { model: TimelineModel }) {
  const { bars, dayCount, startIndex, endIndex, emit, stopPlaying, dayAt } =
    model;
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Set while we are the ones moving the brush, so the `datazoom` event that
  // dispatch fires doesn't bounce straight back through `emit` — which would
  // cancel playback on its own tick.
  const programmaticRef = useRef(false);
  // The brush's last known bar range, ours or the user's; the sync effect
  // leaves the brush alone while it already agrees with the model. `barCount`
  // is part of that agreement because dataZoom stores the range as PERCENTAGES
  // of the data length: while photos stream in, the same percentages keep
  // pointing at later and later bars, so a range whose bar indices never moved
  // still has to be re-pinned against the longer axis.
  const appliedRef = useRef<{
    start: number;
    end: number;
    barCount: number;
  } | null>(null);

  const data = bars.map((bar) => ({
    day: dayFormat.format(dayAt(bar.index)),
    count: bar.count,
  }));

  // Bars pool a fixed run of days each (only the last may be short), so a day
  // index divides straight down to the column that covers it.
  const barSpan = bars[0]?.span ?? 1;
  const barCount = bars.length;
  const toBar = useCallback(
    (day: number) =>
      Math.min(barCount - 1, Math.max(0, Math.floor(day / barSpan))),
    [barCount, barSpan],
  );

  const targetStart = toBar(startIndex);
  const targetEnd = toBar(endIndex);

  // Push range changes that came from anywhere else — playback, the clear
  // button, a shared link — into the uncontrolled dataZoom, and re-pin it
  // against a bar count that grew while photos streamed in.
  useEffect(() => {
    const applied = appliedRef.current;
    if (
      applied &&
      applied.start === targetStart &&
      applied.end === targetEnd &&
      applied.barCount === barCount
    ) {
      return;
    }
    const mount = wrapperRef.current?.querySelector<HTMLElement>(
      "[_echarts_instance_]",
    );
    const chart = mount ? echarts.getInstanceByDom(mount) : null;
    if (!chart) return;

    appliedRef.current = { start: targetStart, end: targetEnd, barCount };
    const last = Math.max(1, barCount - 1);
    programmaticRef.current = true;
    try {
      chart.dispatchAction({
        type: "dataZoom",
        dataZoomIndex: 0,
        start: (targetStart / last) * 100,
        end: (targetEnd / last) * 100,
      });
    } finally {
      programmaticRef.current = false;
    }
  }, [targetStart, targetEnd, barCount]);

  const handleBrush = ({
    startIndex: nextStart,
    endIndex: nextEnd,
  }: {
    startIndex: number;
    endIndex: number;
  }) => {
    if (programmaticRef.current) return;
    appliedRef.current = { start: nextStart, end: nextEnd, barCount };
    const first = bars[nextStart];
    const last = bars[nextEnd];
    if (!first || !last) return;
    stopPlaying();
    emit(first.index, Math.min(last.index + last.span - 1, dayCount - 1));
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
    stopPlaying();
    if (target === "start") {
      emit(Math.min(Math.max(startIndex + delta, 0), endIndex), endIndex);
    } else {
      emit(
        startIndex,
        Math.max(Math.min(endIndex + delta, dayCount - 1), startIndex),
      );
    }
  };

  const lastBar = Math.max(1, barCount - 1);

  return (
    <div ref={wrapperRef} className="relative h-32">
      <EChartsBarChart
        data={data}
        config={CHART_CONFIG}
        xDataKey="day"
        animation={false}
        barRadius={1}
        className="h-full"
      >
        <EChartsBarChart.Bar dataKey="count" />
        <EChartsBarChart.XAxis hideDots />
        <EChartsBarChart.Tooltip />
        <EChartsBarChart.Brush
          height={BRUSH_HEIGHT}
          formatLabel={(value) => value}
          onChange={handleBrush}
        />
      </EChartsBarChart>

      {/*
        dataZoom draws into a canvas, so it is reachable by pointer only. These
        are the keyboard half of the same brush: focusable handles that sit over
        the strip where dataZoom draws its own, stepping the range a day at a
        time and letting the sync effect above push the result back into the
        chart. `pointer-events-none` keeps them out of the way of dragging, and
        does not affect tab order. Positioned to match the dataZoom's own
        left:8/right:8 inset.
      */}
      {(
        [
          ["start", targetStart, startIndex],
          ["end", targetEnd, endIndex],
        ] as const
      ).map(([target, barIndex, dayIndex]) => (
        <div
          key={target}
          role="slider"
          tabIndex={0}
          aria-label={target === "start" ? "Range start" : "Range end"}
          aria-valuemin={0}
          aria-valuemax={dayCount - 1}
          aria-valuenow={dayIndex}
          aria-valuetext={dayFormat.format(dayAt(dayIndex))}
          onKeyDown={(event) => handleKeyDown(target, event)}
          className="pointer-events-none absolute w-3 -translate-x-1/2 rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          style={{
            left: `calc(8px + (100% - 16px) * ${barIndex / lastBar})`,
            bottom: 6,
            height: BRUSH_HEIGHT,
          }}
        />
      ))}
    </div>
  );
}
