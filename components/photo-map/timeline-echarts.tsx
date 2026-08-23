"use client";

import * as echarts from "echarts/core";
import { useCallback, useEffect, useRef } from "react";

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
  // leaves the brush alone while it already agrees with the model.
  const appliedRef = useRef<{ start: number; end: number } | null>(null);

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
  // button, a shared link — into the uncontrolled dataZoom. Re-running as the
  // bars grow also re-pins the percentage-based brush while photos stream in.
  useEffect(() => {
    const applied = appliedRef.current;
    if (applied && applied.start === targetStart && applied.end === targetEnd) {
      return;
    }
    const mount = wrapperRef.current?.querySelector<HTMLElement>(
      "[_echarts_instance_]",
    );
    const chart = mount ? echarts.getInstanceByDom(mount) : null;
    if (!chart) return;

    appliedRef.current = { start: targetStart, end: targetEnd };
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
    appliedRef.current = { start: nextStart, end: nextEnd };
    const first = bars[nextStart];
    const last = bars[nextEnd];
    if (!first || !last) return;
    stopPlaying();
    emit(first.index, Math.min(last.index + last.span - 1, dayCount - 1));
  };

  return (
    <div ref={wrapperRef} className="h-32">
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
    </div>
  );
}
