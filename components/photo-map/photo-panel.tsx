"use client";

import { ExternalLink, MapPin, Video, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CATEGORY_META, categoryCssColor } from "@/lib/photos/categories";
import type { PlacedPhoto } from "@/lib/photos/types";

interface PhotoPanelProps {
  photo: PlacedPhoto;
  onClose: () => void;
}

const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function PhotoPanel({ photo, onClose }: PhotoPanelProps) {
  const meta = CATEGORY_META[photo.category];

  return (
    <aside
      aria-label="Photo details"
      className="absolute top-3 right-3 z-10 flex max-h-[calc(100dvh-5rem)] w-80 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-lg border bg-background shadow-lg"
    >
      <div className="relative aspect-[4/3] shrink-0 bg-muted">
        {/* Thumbnails resolve through source-owned URLs (proxy or static);
            signed-URL freshness is the source's concern, not the client's */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photo.id}
          src={photo.thumbnailUrl}
          alt={photo.title ?? "Field photo"}
          className="absolute inset-0 h-full w-full object-cover"
        />
        {photo.mediaType === "video" && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">
            <Video className="size-3" aria-hidden /> video
          </span>
        )}
        <Button
          variant="secondary"
          size="icon"
          onClick={onClose}
          aria-label="Close photo details"
          className="absolute top-2 right-2 size-7 bg-background/80 backdrop-blur-sm"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 overflow-y-auto p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-heading text-sm font-semibold leading-snug">
            {photo.title ?? "Untitled"}
          </h2>
        </div>

        <dl className="mt-2 grid gap-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Origin</dt>
            <dd className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: categoryCssColor(photo.category) }}
              />
              {meta.label}
            </dd>
          </div>
          {photo.takenAt && (
            <div className="flex gap-1.5 text-muted-foreground">
              <dt>Taken</dt>
              <dd>{dateTimeFormat.format(new Date(photo.takenAt))}</dd>
            </div>
          )}
          {photo.latitude !== null && photo.longitude !== null && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <dt className="sr-only">Coordinates</dt>
              <dd className="inline-flex items-center gap-1 tabular-nums">
                <MapPin className="size-3" aria-hidden />
                {photo.latitude.toFixed(5)}, {photo.longitude.toFixed(5)}
              </dd>
            </div>
          )}
        </dl>

        {photo.sourceUrl && (
          <Button asChild size="sm" className="mt-3 w-full">
            <a href={photo.sourceUrl} target="_blank" rel="noreferrer">
              Open in Autodesk Build
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </Button>
        )}
      </div>
    </aside>
  );
}
