"use client";

import { useEffect } from "react";
import type { ExpressionSpecification, GeoJSONSource } from "maplibre-gl";

import { useMap } from "@/components/ui/map";
import type { CoverageGrid } from "@/lib/photos/coverage";
import { coverageColorExpression, NO_COVERAGE } from "@/lib/photos/recency";

import {
  COVERAGE_FILL_LAYER_ID as FILL_LAYER_ID,
  COVERAGE_LINE_LAYER_ID as LINE_LAYER_ID,
  PHOTO_LAYER_IDS,
} from "./layer-ids";

const SOURCE_ID = "coverage-source";

/**
 * The coverage grid, managed directly through `useMap()` rather than through
 * `MapGeoJSON`: an empty cell and a covered cell need different fills, strokes
 * and opacities off the same source, which is a job for expressions.
 *
 * Empty cells are the point of the layer, so they get no fill at all and a
 * visible outline — a hole you can see the basemap through.
 */
export function CoverageLayer({ grid }: { grid: CoverageGrid }) {
  const { map, isLoaded, resolvedTheme } = useMap();
  const theme = resolvedTheme === "dark" ? "dark" : "light";
  const cells = grid.cells;

  useEffect(() => {
    if (!map || !isLoaded) return;

    map.addSource(SOURCE_ID, { type: "geojson", data: cells });
    map.addLayer({
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: { "fill-opacity": 0 },
    });
    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      paint: { "line-opacity": 0 },
    });
    // Photo pins stay readable on top of the grid whichever order the two
    // components happened to mount in. `BuildingsLayer` leans on this too: it
    // anchors beneath the fill, and the fill is only ever beneath the pins.
    for (const layerId of PHOTO_LAYER_IDS) {
      if (map.getLayer(layerId)) map.moveLayer(layerId);
    }

    return () => {
      try {
        if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
        if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        // style may be mid-reload
      }
    };
    // `cells` is synced by the effect below; re-adding layers on every data
    // change would flash the grid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(cells);
  }, [map, isLoaded, cells]);

  useEffect(() => {
    if (!map || !isLoaded || !map.getLayer(FILL_LAYER_ID)) return;
    const isEmpty: ExpressionSpecification = ["==", ["get", "count"], 0];
    const color = coverageColorExpression(theme);
    const whenEmpty = <T,>(empty: T, covered: T): ExpressionSpecification =>
      ["case", isEmpty, empty, covered] as unknown as ExpressionSpecification;

    map.setPaintProperty(FILL_LAYER_ID, "fill-color", color);
    map.setPaintProperty(FILL_LAYER_ID, "fill-opacity", whenEmpty(0, 0.42));
    map.setPaintProperty(
      LINE_LAYER_ID,
      "line-color",
      whenEmpty<string | ExpressionSpecification>(
        NO_COVERAGE.color[theme],
        color,
      ),
    );
    map.setPaintProperty(LINE_LAYER_ID, "line-width", whenEmpty(1, 0.5));
    map.setPaintProperty(LINE_LAYER_ID, "line-opacity", whenEmpty(0.5, 0.75));
  }, [map, isLoaded, theme]);

  return null;
}
