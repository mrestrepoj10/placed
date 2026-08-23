"use client";

import dynamic from "next/dynamic";
import { Pause, Play, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  dayFormat,
  dayYearFormat,
  useTimelineModel,
  type TimelineProps,
} from "./use-timeline-model";

/**
 * ECharts is a few hundred KB and measures its container before it can draw
 * anything, so the chart itself is split out and kept off the server: the
 * prerendered shell ships the frame, and the histogram fills it in on the
 * client.
 */
const TimelineChart = dynamic(
  () => import("./timeline-echarts").then((mod) => mod.TimelineECharts),
  { ssr: false, loading: () => <div className="h-32" /> },
);

/**
 * The date facet, drawn on the axis it filters: a photos-per-day histogram with
 * a brush over it. Dragging the range sets the date window; the play button
 * sweeps the right edge forward so the map fills in the way the project did. A
 * full-width selection means "no date filter" and is written back as `null`,
 * keeping default share links clean.
 *
 * The range semantics live in `useTimelineModel`, the drawing and the brush in
 * `TimelineECharts`; this is the chrome between them.
 */
export function Timeline(props: TimelineProps) {
  const model = useTimelineModel(props);
  if (!model) return null;

  return (
    <div
      data-timeline
      className="pointer-events-auto rounded-lg border bg-background/90 px-3 pt-1.5 pb-2 shadow-sm backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 pb-1 text-[11px] text-muted-foreground">
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={model.togglePlay}
          aria-label={model.playing ? "Pause playback" : "Play through time"}
          className="rounded-md"
        >
          {model.playing ? (
            <Pause className="size-3 fill-current" />
          ) : (
            <Play className="size-3 fill-current" />
          )}
        </Button>
        <span className="font-medium text-foreground tabular-nums">
          {model.rangeLabel}
        </span>
        <span className="tabular-nums">
          {model.selectedCount.toLocaleString("en-US")} photo
          {model.selectedCount === 1 ? "" : "s"}
        </span>
        {model.brushed && (
          <Button
            size="xs"
            variant="ghost"
            onClick={model.clear}
            className="ml-auto rounded-md text-muted-foreground"
          >
            <X className="size-3" aria-hidden />
            All dates
          </Button>
        )}
      </div>

      <TimelineChart model={model} />

      <div className="flex justify-between pt-0.5 text-[10px] text-muted-foreground tabular-nums">
        <span>{dayFormat.format(model.dayAt(0))}</span>
        <span>{dayYearFormat.format(model.dayAt(model.dayCount - 1))}</span>
      </div>
    </div>
  );
}
