"use client";

import type { MapLayerMouseEvent } from "maplibre-gl";
import { useEffect, useState } from "react";

import { MapPopup, useMap } from "@/components/ui/map";
import { CATEGORY_META, categoryCssColor } from "@/lib/photos/categories";
import { photoCapturedAt, type PlacedPhoto } from "@/lib/photos/types";

import { PHOTO_POINT_LAYER_ID } from "./layer-ids";

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

interface HoverTarget {
  id: string;
  longitude: number;
  latitude: number;
}

/**
 * Hover preview for individual pins: title, date, and the thumbnail itself, so
 * scanning a site doesn't mean clicking every point. The thumbnail is the same
 * URL the inspect panel uses, and the proxy route caches it, so re-hovering a
 * pin costs nothing after the first look.
 *
 * Clusters are deliberately left alone — a breakdown of what's inside one is a
 * different, heavier interaction.
 */
export function PhotoHoverCard({
  photosById,
}: {
  photosById: ReadonlyMap<string, PlacedPhoto>;
}) {
  const { map, isLoaded } = useMap();
  const [target, setTarget] = useState<HoverTarget | null>(null);

  useEffect(() => {
    if (!map || !isLoaded) return;

    const handleMove = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const [longitude, latitude] = feature.geometry.coordinates;
      const id = feature.properties?.id;
      if (typeof id !== "string") return;
      setTarget((current) =>
        current?.id === id ? current : { id, longitude, latitude },
      );
    };
    const handleLeave = () => setTarget(null);

    map.on("mousemove", PHOTO_POINT_LAYER_ID, handleMove);
    map.on("mouseleave", PHOTO_POINT_LAYER_ID, handleLeave);
    // A pin can slide out from under a stationary cursor while the map moves.
    map.on("movestart", handleLeave);

    return () => {
      map.off("mousemove", PHOTO_POINT_LAYER_ID, handleMove);
      map.off("mouseleave", PHOTO_POINT_LAYER_ID, handleLeave);
      map.off("movestart", handleLeave);
    };
  }, [map, isLoaded]);

  const photo = target ? photosById.get(target.id) : null;
  if (!target || !photo) return null;

  const capturedAt = photoCapturedAt(photo);

  return (
    <MapPopup
      longitude={target.longitude}
      latitude={target.latitude}
      offset={14}
      closeOnClick={false}
      focusAfterOpen={false}
      className="border-0 bg-transparent p-0 shadow-none"
    >
      <div
        data-slot="photo-hover-card"
        className="w-44 overflow-hidden rounded-md border bg-background shadow-md"
      >
        <div className="aspect-[4/3] bg-muted">
          {/* Thumbnails resolve through source-owned URLs (proxy or static) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={photo.id}
            src={photo.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
        <div className="px-2 py-1.5">
          <p className="truncate text-xs font-medium leading-tight">
            {photo.title ?? "Untitled"}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: categoryCssColor(photo.category) }}
            />
            <span className="truncate">
              {CATEGORY_META[photo.category].label}
              {capturedAt !== null && ` · ${dateFormat.format(capturedAt)}`}
            </span>
          </p>
        </div>
      </div>
    </MapPopup>
  );
}
