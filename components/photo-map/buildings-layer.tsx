"use client";

import { useEffect } from "react";

import { useMap } from "@/components/ui/map";

import { COVERAGE_FILL_LAYER_ID, PHOTO_LAYER_IDS } from "./layer-ids";

/** OpenFreeMap's vector source; the blank, tile-less basemap has none. */
const BASEMAP_SOURCE_ID = "openmaptiles";
const LAYER_ID = "buildings-3d";

/**
 * A step below each basemap's own footprint grey, so a roof still separates
 * from the ground once MapLibre's vertical gradient darkens the walls under
 * it. Keyed by theme the way every colour in `lib/photos` is.
 */
const BUILDING_COLOR = { light: "#dad8d3", dark: "#38383d" } as const;

/**
 * Extruded buildings off the basemap's own `building` tiles: OpenFreeMap ships
 * `render_height` and `render_min_height` in every tile, so 3D costs no extra
 * request and no key. Managed through `useMap()` like the coverage grid, and
 * split the same way — one effect owns the layer, one keeps its colour on the
 * theme — so a theme change never re-adds it.
 *
 * The layer goes beneath everything this app draws. A pin behind a building
 * is a bug, not depth: once a fill-extrusion layer is in the style, MapLibre
 * draws every 2D layer above it with the depth test off, so "above in the
 * layer order" is exactly what keeps pins, rings and grid cells visible. The
 * anchor is the lowest app layer present — the coverage fill when the grid is
 * on screen, else the bottom photo layer — and `CoverageLayer` moves the
 * photo layers above itself on mount, so in whichever order the three
 * components mounted, the stack settles as basemap → buildings → coverage →
 * photos.
 */
export function BuildingsLayer() {
  const { map, isLoaded, resolvedTheme } = useMap();
  const theme = resolvedTheme === "dark" ? "dark" : "light";

  useEffect(() => {
    if (!map || !isLoaded || !map.getSource(BASEMAP_SOURCE_ID)) return;

    const beforeId = [COVERAGE_FILL_LAYER_ID, PHOTO_LAYER_IDS[0]].find((id) =>
      map.getLayer(id),
    );
    map.addLayer(
      {
        id: LAYER_ID,
        type: "fill-extrusion",
        source: BASEMAP_SOURCE_ID,
        "source-layer": "building",
        // Same threshold as OpenFreeMap's own liberty style; below it the
        // basemap's flat footprints carry the block structure on their own.
        minzoom: 14,
        // OpenMapTiles flags a building's outline `hide_3d` when the tile also
        // carries the building:part pieces that make up its real shape, and
        // extruding both would double it up. The flag is absent, not false,
        // on everything else — hence the fallback rather than a bare `!`.
        filter: ["!", ["boolean", ["get", "hide_3d"], false]],
        paint: {
          "fill-extrusion-base": ["get", "render_min_height"],
          "fill-extrusion-height": ["get", "render_height"],
          "fill-extrusion-opacity": 0.8,
        },
      },
      beforeId,
    );

    return () => {
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      } catch {
        // style may be mid-reload
      }
    };
  }, [map, isLoaded]);

  useEffect(() => {
    if (!map || !isLoaded || !map.getLayer(LAYER_ID)) return;
    map.setPaintProperty(
      LAYER_ID,
      "fill-extrusion-color",
      BUILDING_COLOR[theme],
    );
  }, [map, isLoaded, theme]);

  return null;
}
