"use client";

import { useEffect } from "react";
import type { GeoJSONSource } from "maplibre-gl";

import { useMap } from "@/components/ui/map";
import { hasLocation, type PlacedPhoto } from "@/lib/photos/types";

const SOURCE_ID = "selected-photo-source";
const LAYER_ID = "selected-photo-ring";

const EMPTY: GeoJSON.FeatureCollection<GeoJSON.Point> = {
  type: "FeatureCollection",
  features: [],
};

/**
 * A ring around the selected photo. Clicking a pin makes the selection obvious
 * on its own; walking the set with the arrow keys does not, and a panel that
 * changes without the map saying where you went is disorienting.
 */
export function SelectedPin({ photo }: { photo: PlacedPhoto | null }) {
  const { map, isLoaded, resolvedTheme } = useMap();
  const located = photo && hasLocation(photo) ? photo : null;

  useEffect(() => {
    if (!map || !isLoaded) return;

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: EMPTY,
    });
    map.addLayer({
      id: LAYER_ID,
      type: "circle",
      source: SOURCE_ID,
      paint: {
        "circle-radius": 12,
        "circle-color": "rgba(0, 0, 0, 0)",
        "circle-stroke-width": 2.5,
      },
    });

    return () => {
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        // style may be mid-reload
      }
    };
  }, [map, isLoaded]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(
      located
        ? {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: [located.longitude, located.latitude],
                },
                properties: {},
              },
            ],
          }
        : EMPTY,
    );
  }, [map, isLoaded, located]);

  useEffect(() => {
    if (!map || !isLoaded || !map.getLayer(LAYER_ID)) return;
    map.setPaintProperty(
      LAYER_ID,
      "circle-stroke-color",
      resolvedTheme === "dark" ? "#fafafa" : "#18181b",
    );
  }, [map, isLoaded, resolvedTheme]);

  return null;
}
